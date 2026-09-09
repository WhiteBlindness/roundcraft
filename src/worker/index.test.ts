import { describe, expect, it } from 'vitest'

import worker from './index'

describe('Roundcraft Worker', () => {
  it('returns a versioned health response with security headers', async () => {
    const response = await worker.fetch(
      new Request('https://roundcraft.test/api/v1/health'),
      { APP_ENV: 'production' },
      {} as ExecutionContext,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      data: { status: 'ok', version: '1' },
      error: null,
      meta: {
        api_version: 'v1',
        request_id: expect.any(String),
      },
    })
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains',
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-security-policy')).toContain(
      "script-src 'self'",
    )
    expect(response.headers.get('content-security-policy')).not.toContain(
      "'unsafe-inline'",
    )
  })

  it('permits Vite development injection only in the local environment', async () => {
    const response = await worker.fetch(
      new Request('https://roundcraft.test/api/v1/health'),
      { APP_ENV: 'local' },
      {} as ExecutionContext,
    )

    expect(response.headers.get('content-security-policy')).toContain(
      "script-src 'self' 'unsafe-inline'",
    )
    expect(response.headers.get('content-security-policy')).toContain(
      "style-src 'self' 'unsafe-inline'",
    )
  })

  it('does not trust the request hostname to weaken production CSP', async () => {
    const response = await worker.fetch(
      new Request('http://127.0.0.1:4173/'),
      { APP_ENV: 'production' },
      {} as ExecutionContext,
    )

    expect(response.headers.get('content-security-policy')).not.toContain(
      "'unsafe-inline'",
    )
  })
})
