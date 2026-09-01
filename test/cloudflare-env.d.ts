declare global {
  namespace Cloudflare {
    interface Env {
      readonly IDENTITY_PEPPER: string
      readonly TEST_MIGRATIONS: import('cloudflare:test').D1Migration[]
    }
  }
}

export {}
