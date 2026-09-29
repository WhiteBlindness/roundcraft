import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const wrangler = JSON.parse(
  readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''),
) as { assets: { run_worker_first: string[] } }

// Every path the client router (getInitialPage in src/client/App.tsx) serves.
// Each must reach the Worker so it receives the CSP and other security headers.
const spaRoutes = [
  '/',
  '/today',
  '/cases',
  '/progress',
  '/settings',
  '/privacy',
  '/terms',
  '/cookies',
]

describe('Worker asset routing', () => {
  it('runs the Worker first for the API and every SPA route', () => {
    const patterns = wrangler.assets.run_worker_first

    expect(patterns).toContain('/api/*')
    expect(patterns).toContain('/cases/*')
    for (const route of spaRoutes) {
      expect(patterns, route).toContain(route)
    }
  })
})
