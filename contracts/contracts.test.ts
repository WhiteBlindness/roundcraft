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

describe('Roundcraft API contracts', () => {
  it('publishes only the approved first-slice routes', () => {
    expect(openApi.openapi).toBe('3.1.0')
    expect(Object.keys(openApi.paths).sort()).toEqual(['/session', '/today'])
    expect(JSON.stringify(openApi)).not.toMatch(
      /rubric|future|preferred_action|followup|reveal/i,
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
  ])('validates %s against %s', (schemaPath, examplePath) => {
    const ajv = new Ajv2020({ allErrors: true, strict: true })
    const validator = ajv.compile(readJson(schemaPath))

    expect(validator(readJson(examplePath)), ajv.errorsText(validator.errors)).toBe(
      true,
    )
  })

  it.each([
    ['schemas/session-response.json', 'examples/session.invalid.json'],
    ['schemas/today-response.json', 'examples/today.invalid.json'],
  ])('rejects invalid example %s against %s', (schemaPath, examplePath) => {
    const validator = new Ajv2020({ allErrors: true, strict: true }).compile(
      readJson(schemaPath),
    )

    expect(validator(readJson(examplePath))).toBe(false)
  })
})
