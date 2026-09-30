# Content sources

Where Roundcraft case candidates may come from, what each source requires, and what is stored where. This covers the offline case-miner in `tools/case-miner` only; nothing here runs in the production app.

Some third-party terms could not be re-read at the time of writing. Those points are marked **not verified** and must be checked on the linked page before relying on them.

## Policy

- Use legitimate sources only: official APIs used within their terms, files a person is entitled to hold, and openly licensed corpora.
- Never scrape. Never bypass authentication, rate limits, signed URLs or approval gates. Credentials come from environment variables and are never written to disk or committed.
- HLTV is not automated in any way (see below).
- Liquipedia is used through its MediaWiki API only, for optional context (tournament, team and date metadata). It is not a demo source.
- Costs: free tiers only. Nothing in this pipeline is paid.

## Content lanes

| Lane | Default | Rule |
| --- | --- | --- |
| Demo-grounded synthetic (`synthetic_only`) | Yes | A real demo inspires timings, economy and positions. The case never claims to reproduce the match and never names players or teams. |
| Professional / historical (`professional_allowed`) | No | Only with exact provenance (match, event, date) and confirmed rights for that use. Requires an explicit editorial decision. |

Normalised match data and candidates are anonymised (`p01`..`p10`, no names, no Steam IDs).

## Sources

### FACEIT

- **Data API** (`https://open.faceit.com/data/v4`). A standard server-side API key from the FACEIT Developer portal (App Studio, create an app, generate an API key) is enough to read match details. Match details include `demo_url`, which is a private resource URL and cannot be downloaded directly. Source: <https://docs.faceit.com/docs/data-api/data/>, <https://docs.faceit.com/getting-started/authentication/api-keys/>.
- **Rate limit.** A figure of 10,000 requests per hour appears in secondary sources; the official page could not be re-read: **not verified**. The adapter spaces requests by at least 0.5 s.
- **Downloads API** (demo files). Downloadable FACEIT content is private and only served through signed URLs. The Downloads API exchanges a `resource_url` for a signed `download_url`. It needs a separate application (FACEIT documents roughly 30 days for a response) and an access token with the Downloads API scope. Source: <https://docs.faceit.com/getting-started/Guides/download-api/>.
- **Signed URL lifetime and exact endpoint URL:** **not verified**. The endpoint is therefore taken from the environment (`FACEIT_DOWNLOADS_ENDPOINT`), copied from the documentation FACEIT provides on approval, and the adapter downloads immediately.
- **Reuse terms** for FACEIT demos and metadata: **not verified**. Treat every FACEIT demo as `synthetic_only`, private, not redistributable.
- Demo files are typically compressed (`.dem.gz`, `.dem.zst`). The adapter decompresses gzip with the standard library; zstd needs Python 3.14+ or a manual `zstd -d`.

Setup (once):

1. Create a FACEIT Developer portal app and a server-side API key. Export it as `FACEIT_API_KEY`.
2. Apply for Downloads API access via the form linked from the Downloads API page above.
3. After approval, export the token as `FACEIT_DOWNLOADS_TOKEN` and the documented endpoint as `FACEIT_DOWNLOADS_ENDPOINT`.
4. Without step 2 and 3 the adapter stops with these instructions. Add the demo as a local file instead.

### Liquipedia

- Terms: <https://liquipedia.net/api-terms-of-use> (search snippets of the page were read; the full page could not be re-read, so confirm before heavy use).
- MediaWiki API and LiquipediaDB API share the same terms. The LiquipediaDB API needs an approved key and is not used here.
- Requirements as read: a custom `User-Agent` naming the project with contact details (generic agents are blocked); no more than 1 request per 2 seconds; `action=parse` no more than 1 request per 30 seconds; support gzip; cache results as long as possible; do not fetch generated HTML pages.
- Content licence: CC BY-SA 3.0. Any reuse must carry attribution and share alike. The client returns an attribution string with each result.
- The client (`sources/liquipedia.py`) uses `action=query` wikitext only, enforces at least 2 s between requests (also across runs), refuses `action=parse`, and caches responses under `data-local/cache/liquipedia/`. Set `LIQUIPEDIA_USER_AGENT`, for example `Roundcraft-case-miner/0.1 (https://example.org/; you@example.org)`.

### HLTV

HLTV's terms of use prohibit scraping. The clause as returned by a search of the terms page reads that users may not "conduct, facilitate or organize data mining or web scraping in relation to the Website and/or any of the content" (<https://www.hltv.org/terms>; the page itself could not be fetched here, so re-read it before quoting). The tool does not contact HLTV at all: no scraping, no automated demo download, no API. A person may still supply a demo they obtained legitimately as a local file; it is then handled like any other local file, with the provenance they can actually establish.

### Other legitimate sources

- **Your own Valve matchmaking games.** A player can download demos of their own matches from the game's match history and add them as local files. Other players in those matches are anonymised; the case never names them.
- **Tournament organisers that publish demos with stated terms.** Record the terms and URL in the manifest. Use `professional_allowed` only if the terms permit it.
- **Public parser test corpora.** The parser `LaihoE/demoparser` is MIT licensed (<https://github.com/LaihoE/demoparser>). The regression corpus of `markus-wa/demoinfocs-golang` lives at <https://gitlab.com/markus-wa/cs-demos-2> and carries an MIT licence (`LICENSE.md`, © Markus Walther); its demos are Git LFS archives. An MIT licence covers the repository. It does not necessarily grant rights in the underlying match recording, so corpus demos stay in the `synthetic_only` lane.

## What is stored where

| What | Where | Committed |
| --- | --- | --- |
| Raw demos (`*.dem`, compressed downloads) | `data-local/demos/` | No (git-ignored) |
| Parsed matches, candidates, rendered diagrams | `data-local/parsed/`, `data-local/candidates/` | No |
| Liquipedia response cache | `data-local/cache/liquipedia/` | No |
| Provenance manifests (source, licence, lane, hash; no names) | `content/sources/<source-id>.json` | Yes |
| Credentials | Environment variables only | Never |

Rendered diagrams: the player-known diagram is safe to attach to a brief. The ground-truth diagram is for reviewers only and must never reach players.
