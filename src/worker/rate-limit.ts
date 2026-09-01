import { jsonError, sha256Base64Url } from './http'

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

    return success
      ? null
      : jsonError(
          429,
          'RATE_LIMITED',
          'Too many requests. Please try again later.',
          requestId,
        )
  } catch {
    return jsonError(
      503,
      'SERVICE_UNAVAILABLE',
      'The service is temporarily unavailable.',
      requestId,
    )
  }
}
