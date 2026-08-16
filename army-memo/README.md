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
| `commendation` | commendation |
| `exclusive-for` | exclusiveFor |
| `letter-civilian` | letter |
| `mou-training` | mou |
| `moa-support` | moa |

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

### Flags

| Flag | Purpose |
| --- | --- |
| `--offline` | Skip Claude; use the default fixture |
| `--fixture <id>` | Offline run from a named fixture |
| `--list-fixtures` / `--list-types` | Catalogs |
| `--template <type>` | Editable skeleton for a type |
| `--spec <file.json>` | Render a spec you filled in |
| `--emit-spec <file.json>` | Write the spec out for editing |
| `--docx` / `--html` / `--text <path>` | Outputs |
| `--unit` / `--save-unit <file.json>` | Reuse unit details across memorandums |
| `--seal <path>` | Override the letterhead seal |
| `--model <id>` | Claude model id (or `ANTHROPIC_MODEL`) |
| `--serve` `--port` `--host` | Run the HTTP API |
| `--verify` | AR 25-50 figure regression suite |
| `-h`, `--help` | Usage |

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
| `POST` | `/detect` | Request text → detected memo type |
| `POST` | `/render` | Memo form/spec → `.docx` (JSON preview with `Accept: application/json`) |
| `POST` | `/validate` | Spec → cited findings |
| `POST` | `/generate` | Form → HTML/text preview + findings |
| `POST` | `/docx` | Form → Word file |
| `POST` | `/spec` | Form → JSON memo spec |
| `POST` | `/fields` | Field requirements for a memo type |

### Examples

```bash
curl -s http://127.0.0.1:4250/health | jq .
curl -s http://127.0.0.1:4250/fixtures | jq .

# Offline: passing {"fixture": "<id>"} answers from datasets/ without calling Claude
curl -s -X POST http://127.0.0.1:4250/draft \
  -H 'content-type: application/json' \
  -d '{"fixture":"range-closure"}' | jq .

# Live: needs ANTHROPIC_API_KEY (503 without one)
curl -s -X POST http://127.0.0.1:4250/draft \
  -H 'content-type: application/json' \
  -d '{"request":"Notify subordinate battalions that Range 14 closes 3-7 August 2026."}' | jq .
```

Status codes: `400` malformed JSON, `405` wrong method on a POST route, `413` body over 1 MB, `503` drafting not configured, `429`/`502`/`504` passed through from Claude.

## Environment

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required for live `/draft` and non-`--offline` CLI |
| `ANTHROPIC_MODEL` | Claude model id (default `claude-sonnet-4-5`) |
| `MEMO_MODEL_PATH` | Legacy alias for `ANTHROPIC_MODEL` |
| `MEMO_DRAFT_TIMEOUT_MS` | Draft timeout (default `120000`) |
| `MEMO_MAX_TOKENS` | Max draft tokens (default `4096`) |
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
