/**
 * Minimal structured logger for the Worker.
 *
 * Workers Logs indexes JSON lines, so every event is a single JSON object with
 * `level` and `event` plus flat, primitive fields. Callers must pass only
 * operational metadata (request id, route, edition id, scope, error name).
 * As a defence in depth, any field whose key looks sensitive is replaced with a
 * fixed marker before it is written, and long strings are truncated. Never log
 * cookies, tokens, CSRF values, IP addresses, identity ids or player answers.
 */

export type LogLevel = 'info' | 'warn' | 'error'
export type LogFields = Record<string, string | number | boolean | null>

export const redactedValue = '[redacted]'
export const maximumLoggedStringLength = 300
export const maximumLoggedErrorMessageLength = 200

const sensitiveKeyPattern =
  /cookie|token|csrf|authoriz|secret|pepper|password|identity|answer|address|idempotency|(^|_)ip($|_)|(^|_)params?($|_)|(^|_)sql($|_)/i
const reservedKeys = new Set(['level', 'event'])

function sanitizeValue(value: string | number | boolean | null): unknown {
  if (typeof value === 'string' && value.length > maximumLoggedStringLength) {
    return `${value.slice(0, maximumLoggedStringLength)}…`
  }

  return value
}

export function logEvent(
  level: LogLevel,
  event: string,
  fields: LogFields,
): void {
  const entry: Record<string, unknown> = { level, event }

  for (const [key, value] of Object.entries(fields)) {
    if (reservedKeys.has(key)) continue

    entry[key] = sensitiveKeyPattern.test(key)
      ? redactedValue
      : sanitizeValue(value)
  }

  const line = JSON.stringify(entry)

  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export interface LogContext {
  readonly request_id: string
  readonly route: string
}

const attemptSegmentPattern = /\/attempts\/[A-Za-z0-9_-]{43}(?=\/|$)/

/**
 * Builds the request_id/route pair attached to every event. The route is
 * method + path with the attempt identifier templated out, so log lines never
 * carry per-user identifiers.
 */
export function requestLogContext(
  request: Request,
  requestId: string,
): LogContext {
  let path = '/'

  try {
    path = new URL(request.url).pathname
  } catch {
    // Keep the neutral fallback; logging must never throw.
  }

  return {
    request_id: requestId,
    route: `${request.method} ${path.replace(attemptSegmentPattern, '/attempts/:attemptId')}`,
  }
}

/** Error name and a truncated message only; never SQL text or bound values. */
export function errorLogFields(error: unknown): {
  error_name: string
  error_message: string
} {
  if (error instanceof Error) {
    return {
      error_name: error.name,
      error_message: error.message.slice(0, maximumLoggedErrorMessageLength),
    }
  }

  return { error_name: typeof error, error_message: '' }
}
