// Module resolution hook: src/domain uses extensionless relative imports
// (bundler resolution), which Node's ESM loader rejects. Retry those
// specifiers with a .ts extension (or /index.ts for directories).
function isPathSpecifier(specifier) {
  return (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier.startsWith('/') ||
    specifier.startsWith('file:')
  )
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    if (
      !isPathSpecifier(specifier) ||
      !error ||
      (error.code !== 'ERR_MODULE_NOT_FOUND' &&
        error.code !== 'ERR_UNSUPPORTED_DIR_IMPORT')
    ) {
      throw error
    }

    try {
      return await nextResolve(`${specifier}.ts`, context)
    } catch {
      return nextResolve(`${specifier.replace(/\/$/, '')}/index.ts`, context)
    }
  }
}
