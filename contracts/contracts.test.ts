import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'

const contractDirectory = dirname(fileURLToPath(import.meta.url))

function readJson(relativePath: string): unknown {
  return JSON.parse(
    readFileSync(resolve(contractDirectory, relativePath), 'utf8'),
  )
}

const openApi = readJson('openapi.json') as {
  openapi: string
  paths: Record<string, unknown>
}
const errors = readJson('errors.json') as {
  version: number
  errors: Array<{ code: string; status: number; message: string }>
}

function contractValidator(schemaPath: string) {
  const ajv = new Ajv2020({ allErrors: true, strict: true })

  if (schemaPath !== 'schemas/followup-commit-response.json') {
    ajv.addSchema(readJson('schemas/followup-commit-response.json'))
  }
  if (schemaPath !== 'schemas/attempt-response.json') {
    ajv.addSchema(readJson('schemas/attempt-response.json'))
  }

  return { ajv, validator: ajv.compile(readJson(schemaPath)) }
}

describe('Roundcraft API contracts', () => {
  it('publishes only the approved routes', () => {
    expect(openApi.openapi).toBe('3.1.0')
    expect(Object.keys(openApi.paths).sort()).toEqual([
      '/attempts',
      '/attempts/{attempt_id}',
      '/attempts/{attempt_id}/debrief-complete',
      '/attempts/{attempt_id}/followup-commit',
      '/attempts/{attempt_id}/main-commit',
      '/cases',
      '/events',
      '/fairness-reports',
      '/history',
      '/practice-attempts',
      '/progress',
      '/session',
      '/today',
    ])
    expect(JSON.stringify(openApi)).not.toMatch(
      /rubric|future|preferred_action|server_scoring/i,
    )
  })

  it('keeps a unique, versioned and safe error catalogue', () => {
    const codes = errors.errors.map(({ code }) => code)

    expect(errors.version).toBe(1)
    expect(new Set(codes).size).toBe(codes.length)
    expect(errors.errors.every(({ status }) => status >= 400 && status < 600)).toBe(
      true,
    )
    expect(errors.errors.every(({ message }) => !message.includes('D1'))).toBe(true)
  })

  it.each([
    ['schemas/session-response.json', 'examples/session.success.json'],
    ['schemas/today-response.json', 'examples/today.success.json'],
    ['schemas/today-response.json', 'examples/today.unavailable.json'],
    ['schemas/attempt-response.json', 'examples/attempt.success.json'],
    ['schemas/attempt-response.json', 'examples/attempt.locked.json'],
    ['schemas/attempt-response.json', 'examples/attempt.complete.json'],
    ['schemas/main-commit-response.json', 'examples/main-commit.success.json'],
    ['schemas/followup-commit-response.json', 'examples/followup-commit.success.json'],
    ['schemas/debrief-complete-response.json', 'examples/debrief-complete.success.json'],
    ['schemas/history-delete-response.json', 'examples/history-delete.success.json'],
    ['schemas/progress-response.json', 'examples/progress.success.json'],
    ['schemas/cases-response.json', 'examples/cases.success.json'],
    ['schemas/fairness-report-response.json', 'examples/fairness-report.success.json'],
    ['schemas/events-response.json', 'examples/events.success.json'],
    ['schemas/practice-attempt-response.json', 'examples/practice-attempt.success.json'],
  ])('validates %s against %s', (schemaPath, examplePath) => {
    const { ajv, validator } = contractValidator(schemaPath)

    expect(validator(readJson(examplePath)), ajv.errorsText(validator.errors)).toBe(
      true,
    )
  })

  it.each([
    ['schemas/session-response.json', 'examples/session.invalid.json'],
    ['schemas/today-response.json', 'examples/today.invalid.json'],
    ['schemas/attempt-response.json', 'examples/attempt.invalid.json'],
    ['schemas/main-commit-response.json', 'examples/main-commit.invalid.json'],
    ['schemas/followup-commit-response.json', 'examples/followup-commit.invalid.json'],
    ['schemas/debrief-complete-response.json', 'examples/debrief-complete.invalid.json'],
    ['schemas/history-delete-response.json', 'examples/history-delete.invalid.json'],
    ['schemas/progress-response.json', 'examples/progress.invalid.json'],
    ['schemas/cases-response.json', 'examples/cases.invalid.json'],
    ['schemas/fairness-report-response.json', 'examples/fairness-report.invalid.json'],
    ['schemas/events-response.json', 'examples/events.invalid.json'],
    ['schemas/practice-attempt-response.json', 'examples/practice-attempt.invalid.json'],
  ])('rejects invalid example %s against %s', (schemaPath, examplePath) => {
    const { validator } = contractValidator(schemaPath)

    expect(validator(readJson(examplePath))).toBe(false)
  })
})
