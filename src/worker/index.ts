import { Hono } from 'hono'

import type { Bindings } from './bindings'
import { enforceRateLimit } from './rate-limit'
import { createOrRenewSession } from './session'
import { getToday } from './today'

const api = new Hono<{ Bindings: Bindings }>()

function createContentSecurityPolicy(environment: string): string {
  const isLocal = environment === 'local'

  return [
    "default-src 'self'",
    "base-uri 'none'",
    isLocal ? "connect-src 'self' ws:" : "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    isLocal
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self'",
    isLocal ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
  ].join('; ')
}

api.use('*', async (context, next) => {
  await next()

  context.header(
    'Content-Security-Policy',
    createContentSecurityPolicy(context.env.APP_ENV),
  )
  context.header('Permissions-Policy', 'camera=(), geolocation=(), microphone=()')
  context.header('Referrer-Policy', 'no-referrer')
  context.header('X-Content-Type-Options', 'nosniff')

  const isPublicToday =
    context.req.method === 'GET' && context.req.path === '/api/v1/today'

  if (context.req.path.startsWith('/api/') && !isPublicToday) {
    context.header('Cache-Control', 'private, no-store')
  }
})

api.get('/api/v1/health', (context) =>
  context.json({
    ok: true,
    data: {
      status: 'ok',
      environment: context.env.APP_ENV,
    },
    error: null,
    meta: {
      request_id: crypto.randomUUID(),
      api_version: 'v1',
    },
  }),
)

api.post('/api/v1/session', async (context) => {
  const requestId = crypto.randomUUID()
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.SESSION_RATE_LIMITER,
    'session',
    requestId,
  )

  return (
    limited ?? createOrRenewSession(context.req.raw, context.env, requestId)
  )
})

api.get('/api/v1/today', async (context) => {
  const requestId = crypto.randomUUID()
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.TODAY_RATE_LIMITER,
    'today',
    requestId,
  )

  return limited ?? getToday(context.req.raw, context.env, requestId)
})

api.all('*', async (context) => {
  if (!context.env.ASSETS) {
    return context.json(
      {
        ok: false,
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource is unavailable.',
        },
        meta: {
          request_id: crypto.randomUUID(),
          api_version: 'v1',
        },
      },
      404,
    )
  }

  return context.env.ASSETS.fetch(context.req.raw)
})

export default api
