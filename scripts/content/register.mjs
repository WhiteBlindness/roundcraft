// Registers the extensionless-import resolver so Node 22 (native type
// stripping) can run TypeScript that shares src/domain with the app.
// Usage: node --import ./scripts/content/register.mjs scripts/content/<tool>.ts
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
