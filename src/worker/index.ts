import { Hono } from 'hono'

interface Bindings {
  readonly APP_ENV: string
  readonly ASSETS?: Fetcher
  readonly DB?: D1Database
}

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

  if (context.req.path.startsWith('/api/')) {
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
