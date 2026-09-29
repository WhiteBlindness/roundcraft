# Roundcraft: current state and closed-beta readiness

Last updated: 29/09/2026

This document records what is implemented, what was verified, and what still blocks a small closed beta. The planning documents at the repository root (`CS2_Daily_Platform_Phase_*.md`, `Roundcraft_Phase_3_Technical_Architecture.md`) describe intent. Where they differ from the code, the code is authoritative.

## Readiness summary

| Area | State | Notes |
|---|---|---|
| Official attempt lifecycle | Ready | issued → main_locked → decision_complete → debrief_complete, with conditional D1 updates, idempotency receipts and `If-Match` sequences |
| Phase-gated disclosure | Ready | Follow-up only after the main lock, reveal only after the follow-up lock, rubric never sent. Verified on real network responses in E2E |
| Scoring | Ready | 50/20/30, integer, server-only, stored once. Main commit is refused unless every follow-up answer is scoreable |
| Identity and security | Ready | `__Host-` HttpOnly SameSite=Strict cookie, HMAC verifier, CSRF, Origin/Sec-Fetch-Site checks, strict bodies, rate limits, CSP on every HTML route |
| Observability | Ready for beta | Structured JSON logs with request ids. Content, rubric, batch, conflict and rate-limit events are logged |
| Content pipeline | Ready | JSON case files, validator, generated checksummed migrations, local preview, withdraw flow, CI checks |
| Production content | **Blocked** | 0 publishable cases (see inventory) |
| Deployment | **Blocked on owner** | Worker and D1 exist, but there is no public route or domain, and production D1 has only `0001` applied and no cases |
| Legal pages | Beta-appropriate | Accurate description of storage and processing. The operator identity and a contact mailbox are not yet provided; the pages point to the issue tracker |

## Case inventory

| Case | Status | Blocking issues |
|---|---|---|
| `case_inferno_banana_001` | draft | Evidence matrix 5/30. Timeline contradiction. One-smoke execute inconsistent with follow-up. Weak distractors. Needs tactical review |
| `case_mirage_a_split_001` | draft, rewrite | Brief fails the schema (6 evidence items). Smoke count and window/ticket-booth claims are wrong |
| `case_economy_postpistol_001` | draft, rewrite | Side contradiction. Wrong rifle price. Rubric contradicts the reveal. Should use the `economy_risk` follow-up type |
| `case_smoke_001` (fixture) | technically validated | Technical fixture for preview and tests only. Can never be published |

`npm run content:validate` prints the current readiness report for every file.

## Deployment facts (read-only inspection, 29/09/2026)

- Worker `roundcraft` exists in the Cloudflare account. `wrangler.jsonc` sets `workers_dev: false` and declares no routes, so it has no public URL unless a custom domain is attached in the dashboard.
- D1 `roundcraft-prod` exists. `d1_migrations` contains only `0001_initial.sql`, with 0 cases, editions, identities and attempts.
- Before this revision, CI failed at the lint step on every push, so the deploy job never ran. CI now runs typecheck, lint, content checks, all tests, build and E2E on pull requests. Pushes to `main` additionally apply migrations and deploy.
- `0002_seed_cases.sql` was never applied remotely. It is now a no-op, and its draft cases live in `content/cases/`.

## Owner actions before a closed beta

1. Author or rewrite at least three cases and have each one reviewed by a qualified CS2 player other than the author. Record the review in `editorial.reviewers`.
2. Decide the public entry point (custom domain or `workers.dev`) and configure it.
3. Provide an operator name and contact channel for the privacy page, or confirm the issue tracker is acceptable for a closed beta.
4. Authorise the first production push, which applies migrations and deploys.

## Validation (29/09/2026)

| Command | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass (0 warnings) |
| `npm run content:validate` | pass (fixture clean, 3 drafts not publishable) |
| `npm run content:build -- --check` | pass |
| `npm run test:contract` | 30 passed |
| `npm run test:content` | 79 + 5 (real D1) passed |
| `npm run test:worker` | 141 passed |
| `npm run test:client` | 48 passed |
| `npm run build` | pass |
| `npm run test:e2e` | 5 passed, including a full official attempt against the real Worker and D1 |
