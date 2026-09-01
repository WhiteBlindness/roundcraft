import type { Bindings } from './bindings'
import {
  authenticateIdentity,
  createIdentityToken,
  identityCookie,
  identityLifetimeSeconds,
  signIdentityValue,
} from './identity'
import { jsonError, jsonSuccess } from './http'

const maximumBodyBytes = 1024

async function acceptsSessionRequest(request: Request): Promise<boolean> {
  const url = new URL(request.url)
  const contentType = request.headers.get('content-type') ?? ''
  const contentLength = Number(request.headers.get('content-length') ?? 0)

  if (
    request.headers.get('origin') !== url.origin ||
    request.headers.get('sec-fetch-site') !== 'same-origin' ||
    !contentType.toLowerCase().startsWith('application/json') ||
    !Number.isFinite(contentLength) ||
    contentLength > maximumBodyBytes
  ) {
    return false
  }

  try {
    const body = await request.text()
    const parsed = JSON.parse(body) as unknown

    return (
      body.length <= maximumBodyBytes &&
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).length === 0
    )
  } catch {
    return false
  }
}

export async function createOrRenewSession(
  request: Request,
  env: Bindings,
  requestId: string,
): Promise<Response> {
  if (!(await acceptsSessionRequest(request))) {
    return jsonError(
      403,
      'REQUEST_FORBIDDEN',
      'The request was not accepted.',
      requestId,
    )
  }

  if (!env.DB || !env.IDENTITY_PEPPER) {
    return jsonError(
      503,
      'SERVICE_UNAVAILABLE',
      'The service is temporarily unavailable.',
      requestId,
    )
  }

  const now = new Date()
  const existingIdentity = await authenticateIdentity(request, env, now)
  const token = existingIdentity?.token ?? createIdentityToken()
  const expiresAt = existingIdentity
    ? existingIdentity.expiresAt
    : new Date(now.getTime() + identityLifetimeSeconds * 1000).toISOString()

  if (!existingIdentity) {
    const verifier = await signIdentityValue(
      env.IDENTITY_PEPPER,
      `identity:${token}`,
    )

    await env.DB.prepare(
      `INSERT INTO anonymous_identities (
        identity_id, token_verifier, status, created_at, expires_at
      ) VALUES (?, ?, 'active', ?, ?)`,
    )
      .bind(crypto.randomUUID(), verifier, now.toISOString(), expiresAt)
      .run()
  }

  const csrfToken = await signIdentityValue(env.IDENTITY_PEPPER, `csrf:${token}`)
  const response = jsonSuccess(
    { csrf_token: csrfToken, identity_expires_at: expiresAt },
    requestId,
  )
  response.headers.append('Set-Cookie', identityCookie(token))

  return response
}
