export interface Bindings {
  readonly APP_ENV: string
  readonly ASSETS?: Fetcher
  readonly DB?: D1Database
  readonly IDENTITY_PEPPER?: string
  readonly SESSION_RATE_LIMITER?: RateLimit
  readonly TODAY_RATE_LIMITER?: RateLimit
}
