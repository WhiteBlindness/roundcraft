import { fileURLToPath } from 'node:url'

import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrationsPath = fileURLToPath(
        new URL('./migrations', import.meta.url),
      )
      const migrations = await readD1Migrations(migrationsPath)

      return {
        main: './src/worker/index.ts',
        miniflare: {
          compatibilityDate: '2026-09-01',
          d1Databases: {
            DB: 'roundcraft-test',
          },
          bindings: {
            APP_ENV: 'test',
            IDENTITY_PEPPER:
              'roundcraft-test-pepper-with-at-least-thirty-two-characters',
            TEST_MIGRATIONS: migrations,
          },
        },
      }
    }),
  ],
  test: {
    include: ['src/domain/**/*.test.ts', 'src/worker/**/*.test.ts'],
    setupFiles: ['./test/worker-setup.ts'],
    coverage: {
      // Workerd does not expose the Node inspector required by V8 coverage.
      // Cloudflare therefore requires instrumented Istanbul coverage here.
      provider: 'istanbul',
      reporter: ['text', 'json-summary'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
})
