import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  errorLogFields,
  logEvent,
  maximumLoggedErrorMessageLength,
  maximumLoggedStringLength,
  redactedValue,
  requestLogContext,
} from './log'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('logEvent', () => {
  it('writes one JSON line with level, event and fields to the matching console method', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    logEvent('info', 'sample_info', { request_id: 'r1', count: 2, ok: true, none: null })
    logEvent('warn', 'sample_warn', { request_id: 'r2' })
    logEvent('error', 'sample_error', { request_id: 'r3' })

    expect(log).toHaveBeenCalledOnce()
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
      level: 'info',
      event: 'sample_info',
      request_id: 'r1',
      count: 2,
      ok: true,
      none: null,
    })
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toMatchObject({
      level: 'warn',
      event: 'sample_warn',
    })
    expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toMatchObject({
      level: 'error',
      event: 'sample_error',
    })
  })

  it('redacts sensitive keys, truncates long strings and ignores reserved keys', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    logEvent('info', 'sample', {
      request_id: 'r1',
      cookie: '__Host-roundcraft=secret-token',
      csrf_token: 'csrf-value',
      Authorization: 'Bearer abc',
      identity_id: 'identity-123',
      ip: '203.0.113.9',
      client_ip: '203.0.113.9',
      answer_json: '{"action_id":"regroup_a"}',
      sql_params: 'p1,p2',
      level: 'error',
      event: 'spoofed',
      long: 'x'.repeat(maximumLoggedStringLength + 50),
    })

    const line = String(log.mock.calls[0]?.[0])
    const entry = JSON.parse(line) as Record<string, unknown>

    expect(entry.level).toBe('info')
    expect(entry.event).toBe('sample')
    for (const key of [
      'cookie',
      'csrf_token',
      'Authorization',
      'identity_id',
      'ip',
      'client_ip',
      'answer_json',
      'sql_params',
    ]) {
      expect(entry[key]).toBe(redactedValue)
    }
    expect(line).not.toContain('secret-token')
    expect(line).not.toContain('203.0.113.9')
    expect(line).not.toContain('regroup_a')
    expect(String(entry.long).length).toBeLessThanOrEqual(
      maximumLoggedStringLength + 1,
    )
    expect(entry.request_id).toBe('r1')
  })
})

describe('requestLogContext', () => {
  it('templates the attempt id out of the route and keeps the request id', () => {
    const attemptId = 'A'.repeat(43)
    const context = requestLogContext(
      new Request(
        `https://roundcraft.test/api/v1/attempts/${attemptId}/main-commit?x=1`,
        { method: 'POST' },
      ),
      'req-1',
    )

    expect(context).toEqual({
      request_id: 'req-1',
      route: 'POST /api/v1/attempts/:attemptId/main-commit',
    })
  })
})

describe('errorLogFields', () => {
  it('keeps only the error name and a truncated message', () => {
    const fields = errorLogFields(
      new TypeError('m'.repeat(maximumLoggedErrorMessageLength + 100)),
    )

    expect(fields.error_name).toBe('TypeError')
    expect(fields.error_message).toHaveLength(maximumLoggedErrorMessageLength)
    expect(errorLogFields('boom')).toEqual({
      error_name: 'string',
      error_message: '',
    })
  })
})
