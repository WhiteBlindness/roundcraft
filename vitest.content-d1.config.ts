import { fileURLToPath } from 'node:url'

import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// Minimal shape of scripts/content/lib.ts, declared locally so that this config
// has no extensionless imports (Vite may load configs natively in future).
interface ContentLib {
  loadCases(root: string): { id: string; data?: unknown }[]
  previewWindow(now: Date): unknown
  publishStatements(
    caseFile: unknown,
    options: { mode: 'insert'; window: unknown },
  ): string[]
  contentChecksum(caseFile: unknown): string
}

/**
 * Loads the generated SQL for the technical fixture into a real (miniflare) D1
 * database and plays the case through the Worker. The SQL is rendered here,
 * in Node, because workerd has no filesystem or node:crypto for the generator.
 */
export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const root = fileURLToPath(new URL('./', import.meta.url))
      // lib.ts has no runtime extensionless imports, so Node can load it directly.
      const lib = (await import(
        new URL('./scripts/content/lib.ts', import.meta.url).href
      )) as ContentLib
      const migrations = await readD1Migrations(`${root}migrations`)
      const fixture = lib.loadCases(root).find((entry) => entry.id === 'case_smoke_001')
      // Schema validity of the fixture is asserted by the validator tests.
      const caseFile = fixture?.data
      const statements = lib.publishStatements(caseFile, {
        mode: 'insert',
        window: lib.previewWindow(new Date()),
      })

      return {
        main: './src/worker/index.ts',
        miniflare: {
          compatibilityDate: '2026-09-01',
          d1Databases: {
            DB: 'roundcraft-content-test',
          },
          bindings: {
            APP_ENV: 'test',
            IDENTITY_PEPPER:
              'roundcraft-test-pepper-with-at-least-thirty-two-characters',
            TEST_MIGRATIONS: migrations,
            FIXTURE_STATEMENTS: statements,
            FIXTURE_CHECKSUM: lib.contentChecksum(caseFile),
          },
        },
      }
    }),
  ],
  test: {
    include: ['scripts/content/**/*.d1.test.ts'],
    setupFiles: ['./test/worker-setup.ts'],
  },
})
