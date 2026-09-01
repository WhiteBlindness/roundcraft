export interface ApiMeta {
  readonly request_id: string
  readonly api_version: 'v1'
}

export type ApiErrorCode =
  | 'INVALID_REQUEST'
  | 'SESSION_INVALID'
  | 'REQUEST_FORBIDDEN'
  | 'RATE_LIMITED'
  | 'NO_CURRENT_EDITION'
  | 'SERVICE_UNAVAILABLE'

export function apiMeta(requestId: string): ApiMeta {
  return { request_id: requestId, api_version: 'v1' }
}

export function jsonSuccess(
  data: unknown,
  requestId: string,
  init?: ResponseInit,
): Response {
  return Response.json(
    { ok: true, data, error: null, meta: apiMeta(requestId) },
    init,
  )
}

export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId: string,
): Response {
  return Response.json(
    {
      ok: false,
      data: null,
      error: { code, message },
      meta: apiMeta(requestId),
    },
    { status },
  )
}

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )

  return encodeBase64Url(new Uint8Array(digest))
}
