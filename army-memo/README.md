# Army Memo

Backend for U.S. Army memorandums that comply with **AR 25-50** (Preparing and Managing Correspondence).

Claude drafts **content only** (subject, addressees, leveled paragraphs). Deterministic code owns layout, validation, and the editable `.docx` deliverable. The model never emits spacing, `MEMORANDUM FOR`, or signature geometry.

This package is structured as its own product root (ready to split into a dedicated repository). It is not a tutorial example.

## Install

```bash
cd army-memo
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY for live drafting
```

## CLI

```bash
# Offline: canned content through the real formatter + validator (no API key)
npm run memo -- --offline --docx /tmp/memo.docx

# Template skeleton
npm run memo -- --template decision --docx /tmp/decision.docx --emit-spec /tmp/decision.json

# Render a filled spec
npm run memo -- --spec /tmp/decision.json --docx /tmp/decision.docx

# Live draft with Claude
npm run memo -- --docx /tmp/memo.docx \
  "Notify subordinate battalions that Range 14 closes for maintenance 3-7 August 2026."

# HTTP API
npm run serve

# Regulation-figure regression suite
npm test
```

## HTTP API

Default bind: `http://127.0.0.1:4250`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness + whether Claude drafting is configured |
| `GET` | `/types` | Memorandum types |
| `POST` | `/draft` | Request text → content + findings (needs `ANTHROPIC_API_KEY` or injected stub) |
| `POST` | `/render` | Memo form/spec → `.docx` (or JSON with `Accept: application/json` / `"preview": true`) |
| `POST` | `/validate` | Spec → cited findings |
| `POST` | `/generate` | Form → HTML/text preview + findings |
| `POST` | `/docx` | Form → Word file |

### Examples

```bash
curl -s http://127.0.0.1:4250/health | jq .

curl -s http://127.0.0.1:4250/types | jq .

curl -s -X POST http://127.0.0.1:4250/draft \
  -H 'content-type: application/json' \
  -d '{"request":"Notify subordinate battalions that Range 14 closes 3-7 August 2026."}' | jq .

curl -s -X POST http://127.0.0.1:4250/validate \
  -H 'content-type: application/json' \
  -d @memo-spec.json | jq .

curl -s -X POST http://127.0.0.1:4250/render \
  -H 'content-type: application/json' \
  -d @memo-form.json -o memo.docx
```

## Environment

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required for live `/draft` and non-`--offline` CLI |
| `ANTHROPIC_MODEL` | Claude model id (default `claude-sonnet-4-5`) |
| `MEMO_MODEL_PATH` | Alias for `ANTHROPIC_MODEL` |
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
