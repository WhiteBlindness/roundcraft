import { jsonError, sha256Base64Url } from './http'
import { errorLogFields, logEvent, requestLogContext } from './log'

export async function enforceRateLimit(
  request: Request,
  limiter: RateLimit | undefined,
  scope: string,
  requestId: string,
): Promise<Response | null> {
  if (!limiter) {
    return null
  }

  const networkActor = request.headers.get('cf-connecting-ip') ?? 'unidentified'
  const actorKey = await sha256Base64Url(`${scope}:${networkActor}`)

  try {
    const { success } = await limiter.limit({ key: actorKey })

    if (success) return null

    logEvent('warn', 'rate_limited', {
      ...requestLogContext(request, requestId),
      scope,
    })

    return jsonError(
      429,
      'RATE_LIMITED',
      'Too many requests. Please try again later.',
      requestId,
    )
  } catch (error) {
    logEvent('error', 'rate_limiter_failed', {
      ...requestLogContext(request, requestId),
      scope,
      ...errorLogFields(error),
    })

    return jsonError(
      503,
      'SERVICE_UNAVAILABLE',
      'The service is temporarily unavailable.',
      requestId,
    )
  }
}
