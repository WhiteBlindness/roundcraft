export const maximumStateChangingBodyBytes = 1024

export function acceptsStateChangingHeaders(request: Request): boolean {
  const url = new URL(request.url)
  const contentType = request.headers.get('content-type') ?? ''
  const contentLength = Number(request.headers.get('content-length') ?? 0)

  return (
    request.headers.get('origin') === url.origin &&
    request.headers.get('sec-fetch-site') === 'same-origin' &&
    contentType.toLowerCase().startsWith('application/json') &&
    Number.isFinite(contentLength) &&
    contentLength <= maximumStateChangingBodyBytes
  )
}
