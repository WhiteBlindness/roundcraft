# Repository rules

Rules for anyone (human or coding agent) changing Roundcraft. They apply to every session, local or cloud.

## Start from the real state

- Inspect `git status`, the current branch, uncommitted work and recent commits before changing anything.
- Current code plus the locked product decisions below are authoritative. The planning documents (`CS2_Daily_Platform_Phase_*.md`, `Roundcraft_Phase_3_Technical_Architecture.md`) explain intent but may lag the code.
- Preserve working implementation. Do not rewrite functioning code only to fit a different architecture.
- Never discard uncommitted work (`git reset --hard`, `git clean`, `git checkout .`) without explicit instruction.

## Product contract

- One deep tactical case per release. No arcade of shallow mini-games.
- Case flow: brief → evidence choice → main call → new information → follow-up → reveal → review ("Your line" vs "What actually happened", ending with "What to remember").
- Fact states `confirmed`, `last_seen`, `inferred`, `unknown` must stay meaningful.
- Official scoring is deterministic and server-side only: 50 main call, 20 evidence, 30 follow-up. No generative-model judgement in official scores.
- Phase-gated disclosure is a security requirement: the browser must not receive follow-up content before the main call is locked, or reveal/rubric content before the follow-up is locked. Hiding data in React is not enough.
- Keep the physical public projections separate per phase (`case_public_briefs`, `case_followups`, `case_reveals`, `case_rubrics`). Rubrics never leave the server.
- Never invent tactical rules, case content, reviewer identities, legal details or metrics.

## Engineering rules

- Architecture: browser → Cloudflare Worker (Hono) → D1. No extra services, databases or queues without a demonstrated need.
- Contracts first: update `contracts/openapi.json`, schemas and examples before or together with a route change.
- Parameterised SQL only. No string concatenation with request data.
- Migrations are append-only. Never edit an applied migration (`0001_initial.sql` and later). New migrations must be safe to apply to production data.
- Add a dependency only with a written justification in the PR.
- All existing checks must pass: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`, `npm run content:validate`.

## Case content

- Cases are authored as JSON under `content/cases/` and validated with `npm run content:validate`.
- Editorial status must be honest: `draft` → `technically_validated` → `tactically_reviewed` → `ready`. Only a named human CS2 reviewer can move a case to `tactically_reviewed`.
- Generated SQL comes from `npm run content:build`; do not hand-edit generated seed SQL.

## Case mining (tools/case-miner)

- Offline editorial tooling only. Never run demo parsing in the Worker, store demos in D1, or add parsing dependencies to the app.
- Raw demos, parsed rounds and candidate bundles stay in the git-ignored `data-local/`. Commit only provenance manifests (`content/sources/`), code, tests and reviewed-for-commit drafts.
- Legitimate sources only (see `tools/case-miner/docs/content-sources.md`). No HLTV automation, no HTML scraping, no bypassing authentication, rate limits or download approvals.
- Keep demo ground truth and player-known information separate. A brief is built only from what the deciding team could know at the decision tick.
- The historical line in a demo is the reveal, never the answer key. Generated drafts stay `draft` until a human reviewer changes them.
- Never put player names, Steam IDs or other identities from a demo into committed files.

## Git and publishing

- Never force-push. Never rewrite published history.
- A push to `main` runs CI and, if it passes, applies D1 migrations to production and deploys the Worker. Treat every push to `main` as a production release.
- Do not push, deploy, or run `wrangler ... --remote` without explicit authorisation from the owner.
- Before any push: review the staged diff, run the checks above, confirm public docs match reality, scan for secrets and private material, and exclude unrelated files.
- Never commit secrets, credentials, `.dev.vars`, personal data, private prompts or internal-only infrastructure details.
- Commit messages, PR descriptions and public docs describe the product and engineering result. Keep tooling or process commentary out of them.
