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
import { createPracticeAttempt } from './practice-attempts'
import { commitMainAnswer } from './main-commit'
import { getProgress } from './progress'
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

api.post('/api/v1/attempts', async (context) => {
  const requestId = crypto.randomUUID()
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'attempt-create',
    requestId,
  )

  return limited ?? createOrResumeAttempt(context.req.raw, context.env, requestId)
})

api.get('/api/v1/attempts/:attemptId', async (context) => {
  const requestId = crypto.randomUUID()
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
  const requestId = crypto.randomUUID()
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
  const requestId = crypto.randomUUID()
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
  const requestId = crypto.randomUUID()
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
  const requestId = crypto.randomUUID()
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
  const requestId = crypto.randomUUID()
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'history-delete',
    requestId,
  )

  return limited ?? deleteHistory(context.req.raw, context.env, requestId)
})

api.get('/api/v1/progress', async (context) => {
  const requestId = crypto.randomUUID()
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'progress',
    requestId,
  )

  return limited ?? getProgress(context.req.raw, context.env, requestId)
})

api.get('/api/v1/cases', async (context) => {
  const requestId = crypto.randomUUID()
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.TODAY_RATE_LIMITER,
    'cases',
    requestId,
  )

  return limited ?? listCases(context.req.raw, context.env, requestId)
})

api.post('/api/v1/fairness-reports', async (context) => {
  const requestId = crypto.randomUUID()
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
  const requestId = crypto.randomUUID()
  const limited = await enforceRateLimit(
    context.req.raw,
    context.env.ATTEMPT_RATE_LIMITER,
    'events',
    requestId,
  )

  return limited ?? recordEvent(context.req.raw, context.env, requestId)
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
