import { env } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Bindings } from './bindings'
import worker from './index'

const executionContext = {} as ExecutionContext
const origin = 'https://roundcraft.test'
const spaPaths = [
  '/',
  '/today',
  '/cases',
  '/cases/some-case',
  '/progress',
  '/settings',
  '/privacy',
  '/terms',
  '/cookies',
] as const

function withAssets(): Bindings {
  return {
    APP_ENV: 'production',
    ASSETS: {
      fetch: () =>
        Promise.resolve(
          new Response('<!doctype html><title>Roundcraft</title>', {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
        ),
    } as unknown as Fetcher,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('unknown API paths', () => {
  it.each([
    ['GET', '/api/v1/does-not-exist'],
    ['POST', '/api/v2/session'],
    ['GET', '/api/v1/session'],
    ['DELETE', '/api/anything/else'],
  ])('%s %s returns a JSON 404 envelope, never the SPA', async (method, path) => {
    const assetsFetch = vi.fn()
    const response = await worker.fetch(
      new Request(`${origin}${path}`, { method }),
      { APP_ENV: 'production', ASSETS: { fetch: assetsFetch } as unknown as Fetcher },
      executionContext,
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({
      ok: false,
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource is unavailable.',
      },
      meta: { request_id: expect.any(String), api_version: 'v1' },
    })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(assetsFetch).not.toHaveBeenCalled()
  })
})

describe('SPA routes', () => {
  it.each(spaPaths)('%s is served by the Worker with security headers', async (path) => {
    const response = await worker.fetch(
      new Request(`${origin}${path}`),
      withAssets(),
      executionContext,
    )
    const csp = response.headers.get('content-security-policy') ?? ''

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<title>Roundcraft</title>')
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain("'unsafe-inline'")
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })
})

describe('Today caching', () => {
  it('is private, revalidated by ETag and answers 304 with the same policy', async () => {
    const first = await worker.fetch(
      new Request(`${origin}/api/v1/today`),
      env,
      executionContext,
    )
    const etag = first.headers.get('etag') ?? ''
    const second = await worker.fetch(
      new Request(`${origin}/api/v1/today`, {
        headers: { 'if-none-match': etag },
      }),
      env,
      executionContext,
    )

    expect(first.headers.get('cache-control')).toBe('private, no-cache')
    expect(first.headers.get('cache-control')).not.toContain('public')
    expect(etag).toMatch(/^"[A-Za-z0-9_-]{43}"$/)
    expect(second.status).toBe(304)
    expect(second.headers.get('cache-control')).toBe('private, no-cache')
    expect(second.headers.get('etag')).toBe(etag)
  })
})

describe('error logging', () => {
  it('logs an unexpected error once and returns the standard 500 envelope', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const brokenEnv: Bindings = {
      APP_ENV: 'production',
      DB: {
        prepare: () => {
          throw new Error('D1 exploded with SELECT secret FROM somewhere')
        },
      } as unknown as D1Database,
    }

    const response = await worker.fetch(
      new Request(`${origin}/api/v1/cases`, {
        headers: { cookie: '__Host-roundcraft=session-secret' },
      }),
      brokenEnv,
      executionContext,
    )
    const payload = await response.json<{
      error: { code: string }
      meta: { request_id: string }
    }>()
    const lines = error.mock.calls.map(([line]) =>
      JSON.parse(String(line)) as Record<string, unknown>,
    )

    expect(response.status).toBe(500)
    expect(payload.error.code).toBe('INTERNAL_ERROR')
    expect(response.headers.get('content-security-policy')).toContain(
      "default-src 'self'",
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      level: 'error',
      event: 'unhandled_error',
      request_id: payload.meta.request_id,
      route: 'GET /api/v1/cases',
      error_name: 'Error',
    })
    expect(JSON.stringify(lines)).not.toContain('session-secret')
  })

  it('logs a handled 503 with the same request id as the response', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const limiter = {
      limit: () => Promise.reject(new Error('limiter offline')),
    } as unknown as RateLimit

    const response = await worker.fetch(
      new Request(`${origin}/api/v1/today`),
      { APP_ENV: 'production', TODAY_RATE_LIMITER: limiter },
      executionContext,
    )
    const payload = await response.json<{ meta: { request_id: string } }>()
    const events = error.mock.calls.map(
      ([line]) => JSON.parse(String(line)) as Record<string, unknown>,
    )

    expect(response.status).toBe(503)
    expect(events.map(({ event }) => event)).toEqual([
      'rate_limiter_failed',
      'http_5xx',
    ])
    expect(events.every(({ request_id }) => request_id === payload.meta.request_id)).toBe(true)
    expect(events[0]).toMatchObject({ scope: 'today', error_message: 'limiter offline' })
  })

  it('logs rate-limit hits with the scope only, never the client address', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const limiter = {
      limit: () => Promise.resolve({ success: false }),
    } as unknown as RateLimit

    const response = await worker.fetch(
      new Request(`${origin}/api/v1/today`, {
        headers: { 'cf-connecting-ip': '203.0.113.9' },
      }),
      { APP_ENV: 'production', TODAY_RATE_LIMITER: limiter },
      executionContext,
    )
    const payload = await response.json<{ meta: { request_id: string } }>()
    const line = String(warn.mock.calls[0]?.[0])

    expect(response.status).toBe(429)
    expect(JSON.parse(line)).toEqual({
      level: 'warn',
      event: 'rate_limited',
      request_id: payload.meta.request_id,
      route: 'GET /api/v1/today',
      scope: 'today',
    })
    expect(line).not.toContain('203.0.113.9')
  })
})
