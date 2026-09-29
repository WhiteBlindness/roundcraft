import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/content/**/*.test.ts'],
    exclude: ['scripts/content/**/*.d1.test.ts'],
    // node:sqlite is still flagged experimental on Node 22.
    execArgv: ['--no-warnings=ExperimentalWarning'],
  },
})
