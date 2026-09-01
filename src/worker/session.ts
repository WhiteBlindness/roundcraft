import type { Bindings } from './bindings'
import { encodeBase64Url, jsonError, jsonSuccess } from './http'

const cookieName = '__Host-roundcraft'
const tokenPattern = /^[A-Za-z0-9_-]{43}$/
const identityLifetimeSeconds = 90 * 24 * 60 * 60
const maximumBodyBytes = 1024

interface IdentityRecord {
  readonly identity_id: string
  readonly expires_at: string
}

function readCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')

  if (!cookieHeader) {
    return null
  }

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
  const value = cookie?.slice(cookieName.length + 1) ?? null

  return value && tokenPattern.test(value) ? value : null
}

function createToken(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

async function sign(pepper: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  )

  return encodeBase64Url(new Uint8Array(signature))
}

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

function sessionCookie(token: string): string {
  return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${identityLifetimeSeconds}`
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
  const existingToken = readCookie(request)
  const existingVerifier = existingToken
    ? await sign(env.IDENTITY_PEPPER, `identity:${existingToken}`)
    : null
  const existingIdentity = existingVerifier
    ? await env.DB.prepare(
        `SELECT identity_id, expires_at
         FROM anonymous_identities
         WHERE token_verifier = ? AND status = 'active' AND expires_at > ?
         LIMIT 1`,
      )
        .bind(existingVerifier, now.toISOString())
        .first<IdentityRecord>()
    : null
  const token = existingIdentity && existingToken ? existingToken : createToken()
  const expiresAt = existingIdentity
    ? existingIdentity.expires_at
    : new Date(now.getTime() + identityLifetimeSeconds * 1000).toISOString()

  if (!existingIdentity) {
    const verifier = await sign(env.IDENTITY_PEPPER, `identity:${token}`)

    await env.DB.prepare(
      `INSERT INTO anonymous_identities (
        identity_id, token_verifier, status, created_at, expires_at
      ) VALUES (?, ?, 'active', ?, ?)`,
    )
      .bind(crypto.randomUUID(), verifier, now.toISOString(), expiresAt)
      .run()
  }

  const csrfToken = await sign(env.IDENTITY_PEPPER, `csrf:${token}`)
  const response = jsonSuccess(
    { csrf_token: csrfToken, identity_expires_at: expiresAt },
    requestId,
  )
  response.headers.append('Set-Cookie', sessionCookie(token))

  return response
}
