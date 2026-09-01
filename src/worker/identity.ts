import type { Bindings } from './bindings'
import { encodeBase64Url } from './http'

export const identityCookieName = '__Host-roundcraft'
export const identityLifetimeSeconds = 90 * 24 * 60 * 60

const tokenPattern = /^[A-Za-z0-9_-]{43}$/

interface IdentityRecord {
  readonly identity_id: string
  readonly expires_at: string
}

export interface AuthenticatedIdentity {
  readonly identityId: string
  readonly expiresAt: string
  readonly token: string
}

export function readIdentityToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')

  if (!cookieHeader) return null

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${identityCookieName}=`))
  const value = cookie?.slice(identityCookieName.length + 1) ?? null

  return value && tokenPattern.test(value) ? value : null
}

export function createIdentityToken(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function signIdentityValue(
  pepper: string,
  value: string,
): Promise<string> {
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

export function identityCookie(token: string): string {
  return `${identityCookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${identityLifetimeSeconds}`
}

export async function authenticateIdentity(
  request: Request,
  env: Bindings,
  now = new Date(),
): Promise<AuthenticatedIdentity | null> {
  if (!env.DB || !env.IDENTITY_PEPPER) return null

  const token = readIdentityToken(request)
  if (!token) return null

  const verifier = await signIdentityValue(
    env.IDENTITY_PEPPER,
    `identity:${token}`,
  )
  const identity = await env.DB.prepare(
    `SELECT identity_id, expires_at
     FROM anonymous_identities
     WHERE token_verifier = ? AND status = 'active' AND expires_at > ?
     LIMIT 1`,
  )
    .bind(verifier, now.toISOString())
    .first<IdentityRecord>()

  return identity
    ? {
        identityId: identity.identity_id,
        expiresAt: identity.expires_at,
        token,
      }
    : null
}

function constantTimeEqual(first: string, second: string): boolean {
  const firstBytes = new TextEncoder().encode(first)
  const secondBytes = new TextEncoder().encode(second)
  const length = Math.max(firstBytes.length, secondBytes.length)
  let difference = firstBytes.length ^ secondBytes.length

  for (let index = 0; index < length; index += 1) {
    difference |= (firstBytes[index] ?? 0) ^ (secondBytes[index] ?? 0)
  }

  return difference === 0
}

export async function verifyCsrfToken(
  request: Request,
  env: Bindings,
  identity: AuthenticatedIdentity,
): Promise<boolean> {
  if (!env.IDENTITY_PEPPER) return false

  const supplied = request.headers.get('x-csrf-token') ?? ''
  const expected = await signIdentityValue(
    env.IDENTITY_PEPPER,
    `csrf:${identity.token}`,
  )

  return constantTimeEqual(supplied, expected)
}
