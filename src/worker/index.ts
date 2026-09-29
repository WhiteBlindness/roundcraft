import { Hono } from 'hono'

import {
  createOrResumeAttempt,
  getAttempt,
} from './attempts'
import type { Bindings } from './bindings'
import { listCases } from './cases'
import { completeDebrief } from './debrief-complete'
import { recordEvent } from './events'
import { createFairnessReport } from './fairness-reports'
import { commitFollowupAnswer } from './followup-commit'
import { deleteHistory } from './history'
import { jsonError } from './http'
import { errorLogFields, logEvent, requestLogContext } from './log'
import { createPracticeAttempt } from './practice-attempts'
import { commitMainAnswer } from './main-commit'
import { getProgress } from './progress'
import { enforceRateLimit } from './rate-limit'
import { createOrRenewSession } from './session'
import { getToday } from './today'

interface AppEnvironment {
  Bindings: Bindings
  Variables: { requestId: string }
}

const api = new Hono<AppEnvironment>()

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
  // One request id per request, shared by the response envelope and the logs.
  context.set('requestId', crypto.randomUUID())

  await next()

  // Errors thrown by handlers are logged (with detail) by onError; every other
  // 5xx, such as a handled 503, gets a generic event here so none is invisible.
  if (context.res.status >= 500 && !context.error) {
    logEvent('error', 'http_5xx', {
      ...requestLogContext(context.req.raw, context.get('requestId')),
      status: context.res.status,
    })
  }

  context.header(
    'Content-Security-Policy',
    createContentSecurityPolicy(context.env.APP_ENV),
  )
  context.header('Permissions-Policy', 'camera=(), geolocation=(), microphone=()')
  context.header('Referrer-Policy', 'no-referrer')
  context.header('X-Content-Type-Options', 'nosniff')
  context.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  context.header('X-Frame-Options', 'DENY')

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
      version: '1',
    },
    error: null,
    meta: {
      request_id: context.get('requestId'),
      api_version: 'v1',
    },
  }),
)

api.post('/api/v1/session', async (context) => {
  const requestId = context.get('requestId')
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
  const requestId = context.get('requestId')
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.TODAY_RATE_LIMITER,
    'today',
    requestId,
  )

  return limited ?? getToday(context.req.raw, context.env, requestId)
})

api.post('/api/v1/attempts', async (context) => {
  const requestId = context.get('requestId')
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'attempt-create',
    requestId,
  )

  return limited ?? createOrResumeAttempt(context.req.raw, context.env, requestId)
})

api.get('/api/v1/attempts/:attemptId', async (context) => {
  const requestId = context.get('requestId')
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'attempt-read',
    requestId,
  )

  return (
    limited ??
    getAttempt(
      context.req.raw,
      context.env,
      requestId,
      context.req.param('attemptId'),
    )
  )
})

api.post('/api/v1/attempts/:attemptId/main-commit', async (context) => {
  const requestId = context.get('requestId')
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'attempt-main-commit',
    requestId,
  )

  return (
    limited ??
    commitMainAnswer(
      context.req.raw,
      context.env,
      requestId,
      context.req.param('attemptId'),
    )
  )
})

api.post('/api/v1/attempts/:attemptId/followup-commit', async (context) => {
  const requestId = context.get('requestId')
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'attempt-followup-commit',
    requestId,
  )

  return (
    limited ??
    commitFollowupAnswer(
      context.req.raw,
      context.env,
      requestId,
      context.req.param('attemptId'),
    )
  )
})

api.post('/api/v1/attempts/:attemptId/debrief-complete', async (context) => {
  const requestId = context.get('requestId')
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'attempt-debrief-complete',
    requestId,
  )

  return (
    limited ??
    completeDebrief(
      context.req.raw,
      context.env,
      requestId,
      context.req.param('attemptId'),
    )
  )
})

api.post('/api/v1/practice-attempts', async (context) => {
  const requestId = context.get('requestId')
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'practice-attempt-create',
    requestId,
  )

  return (
    limited ?? createPracticeAttempt(context.req.raw, context.env, requestId)
  )
})

api.delete('/api/v1/history', async (context) => {
  const requestId = context.get('requestId')
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'history-delete',
    requestId,
  )

  return limited ?? deleteHistory(context.req.raw, context.env, requestId)
})

api.get('/api/v1/progress', async (context) => {
  const requestId = context.get('requestId')
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'progress',
    requestId,
  )

  return limited ?? getProgress(context.req.raw, context.env, requestId)
})

api.get('/api/v1/cases', async (context) => {
  const requestId = context.get('requestId')
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.TODAY_RATE_LIMITER,
    'cases',
    requestId,
  )

  return limited ?? listCases(context.req.raw, context.env, requestId)
})

api.post('/api/v1/fairness-reports', async (context) => {
  const requestId = context.get('requestId')
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'fairness-report',
    requestId,
  )

  return (
    limited ?? createFairnessReport(context.req.raw, context.env, requestId)
  )
})

api.post('/api/v1/events', async (context) => {
  const requestId = context.get('requestId')
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'events',
    requestId,
  )

  return limited ?? recordEvent(context.req.raw, context.env, requestId)
})

api.all('/api/*', (context) =>
  jsonError(
    404,
    'NOT_FOUND',
    'The requested resource is unavailable.',
    context.get('requestId'),
  ),
)

api.all('*', async (context) => {
  if (!context.env.ASSETS) {
    return jsonError(
      404,
      'NOT_FOUND',
      'The requested resource is unavailable.',
      context.get('requestId'),
    )
  }

  return context.env.ASSETS.fetch(context.req.raw)
})

api.onError((error, context) => {
  const requestId = context.get('requestId') ?? crypto.randomUUID()

  logEvent('error', 'unhandled_error', {
    ...requestLogContext(context.req.raw, requestId),
    ...errorLogFields(error),
  })

  return jsonError(
    500,
    'INTERNAL_ERROR',
    'An unexpected error occurred.',
    requestId,
  )
})

export default api
