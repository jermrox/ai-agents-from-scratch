# Army Memo

Backend for U.S. Army memorandums that comply with **AR 25-50** (Preparing and Managing Correspondence).

Claude drafts **content only** (subject, addressees, leveled paragraphs) via the Anthropic Messages API structured outputs. Deterministic code owns layout, validation, and the editable `.docx` deliverable.

This package is structured as its own product root (ready to split into a dedicated repository). It is not a tutorial example.

## Install

```bash
cd army-memo
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY for live drafting
```

## Datasets

Golden fixtures live in [`datasets/`](datasets/): Claude-shaped **content** plus matters-of-record **context**.

```bash
npm run memo -- --list-fixtures
npm run memo -- --fixture mfr-staff-sync --docx /tmp/mfr.docx
npm run test:datasets
```

| Fixture | Type |
| --- | --- |
| `range-closure` (default) | standard |
| `decision-range` | decision |
| `mfr-staff-sync` | record |
| `thru-endorsement` | thru |
| `appreciation` | appreciation |

## CLI

```bash
# Offline: default fixture through the real formatter + validator (no API key)
npm run memo -- --offline --docx /tmp/memo.docx

# Template skeleton
npm run memo -- --template decision --docx /tmp/decision.docx --emit-spec /tmp/decision.json

# Live draft with Claude
npm run memo -- --docx /tmp/memo.docx \
  "Notify subordinate battalions that Range 14 closes for maintenance 3-7 August 2026."

# HTTP API
npm run serve

# Full AR 25-50 suite + dataset tests
npm test
```

## SDK surface

```js
import {
  getDrafter, runMemoAgent, assembleMemo, validateMemo, writeDocx, loadFixtureSync,
} from "army-memo";
```

Claude path uses `client.messages.parse` + `jsonSchemaOutputFormat(MEMO_CONTENT_SCHEMA)` with retries on 429/5xx.

## HTTP API

Default bind: `http://127.0.0.1:4250`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness + whether Claude drafting is configured |
| `GET` | `/types` | Memorandum types |
| `GET` | `/fixtures` | Golden dataset catalog |
| `GET` | `/fixtures/:id` | Fixture content/context + validation |
| `POST` | `/draft` | Request text → content + findings (`ANTHROPIC_API_KEY`, stub, or `{fixture}` offline) |
| `POST` | `/render` | Memo form/spec → `.docx` (JSON preview with `Accept: application/json`) |
| `POST` | `/validate` | Spec → cited findings |
| `POST` | `/generate` | Form → HTML/text preview + findings |
| `POST` | `/docx` | Form → Word file |

### Examples

```bash
curl -s http://127.0.0.1:4250/health | jq .
curl -s http://127.0.0.1:4250/fixtures | jq .
curl -s -X POST http://127.0.0.1:4250/draft \
  -H 'content-type: application/json' \
  -d '{"fixture":"range-closure"}' | jq .
curl -s -X POST http://127.0.0.1:4250/draft \
  -H 'content-type: application/json' \
  -d '{"request":"Notify subordinate battalions that Range 14 closes 3-7 August 2026."}' | jq .
```

## Environment

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required for live `/draft` and non-`--offline` CLI |
| `ANTHROPIC_MODEL` | Claude model id (default `claude-sonnet-4-5`) |
| `MEMO_MODEL_PATH` | Alias for `ANTHROPIC_MODEL` |
| `MEMO_DRAFT_RETRIES` | Retries on rate-limit/5xx (default `2`) |
| `PORT` / `HOST` | HTTP bind (default `4250` / `127.0.0.1`) |

## Architecture

```text
request ──▶ Claude (JSON schema) ──▶ content
                                      │
                         context ─────┤  office symbol, date, signature, …
                                      ▼
                                 memo spec
                                      ▼
                              layoutMemo()     ← AR 25-50 measurements
                                      ▼
                              validateMemo()   ← cited findings
                                      ▼
                               renderDocx()    ← staffing deliverable
```

Content findings feed back into Claude for repair. Format findings are bugs in the renderer, not the model.

## License

MIT
