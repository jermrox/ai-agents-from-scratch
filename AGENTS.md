# AGENTS.md

## Cursor Cloud specific instructions

This repository is a monorepo with **two independent Node.js (ESM) products**, each with its own
`package.json` / lockfile. There are no npm/pnpm workspaces, so dependencies are installed per
directory. Node 18+ is required (the VM has Node 22).

### Products

- **`army-memo/`** — AR 25-50 Army memorandum backend (CLI `bin/memo.js` + HTTP API
  `src/api/server.js`). This is the focus of this branch and the primary product to run/test. It runs
  fully offline for tests, CLI rendering, layout, validation, and `.docx` output. Only the live Claude
  drafting step needs a key.
- **repo root (`AI Agents From Scratch`)** — 15 tutorial examples under `examples/NN_*/`, run directly
  with `node examples/<folder>/<script>.js`. See `README.md`.

### Running / testing (see each `package.json` scripts + `army-memo/README.md`)

- `army-memo` test/lint: there is no linter; `npm test` (alias for `npm run verify`) runs
  `node src/verify.js`, an AR 25-50 layout regression suite (916 deterministic checks). It needs no
  key and no network.
- `army-memo` CLI offline hello-world: `npm run memo -- --offline --docx /tmp/memo.docx` produces a
  real Word file with "AR 25-50 compliance: PASS".
- `army-memo` HTTP API: `npm run serve` binds `http://127.0.0.1:4250` (override with `PORT`/`HOST`).
  `/health`, `/types`, `/render`, `/validate`, `/generate`, `/docx` all work without a key; only
  `/draft` (and non-`--offline` CLI) needs `ANTHROPIC_API_KEY` and returns HTTP 503 with a clear
  message when it is absent (this is expected, not a bug).

### Non-obvious caveats

- **No API key needed for dev/test.** The intended path here is the offline/local drafting approach;
  the Anthropic key is not required. Everything except the live `/draft` step (tests, CLI `--offline`,
  layout, validation, `.docx`, and all other HTTP endpoints) runs without any key.
- **Live Claude `/draft` is currently broken at the code level (not an env issue).** Even with a valid
  `ANTHROPIC_API_KEY`, `POST /draft` returns HTTP 500 `client.messages.parse is not a function`:
  `src/drafter/claude-drafter.js` calls `client.messages.parse(...)`, which does not exist in the
  pinned `@anthropic-ai/sdk@0.71.2` (only `messages.create`/`messages.stream` exist). Use the offline /
  stub drafter path for development until the drafter code is updated.
- **Optional validators skip gracefully.** `npm test` prints "lxml is not installed" and "LibreOffice
  not installed" and skips OOXML-schema and rendered-page checks; the 916 core checks still run. These
  extras are not required and are intentionally left uninstalled.
- **Root examples require large model files.** Each `examples/NN_*` script loads a GGUF model from
  `./models/` (gitignored, multi-GB, one or more per example — see `DOWNLOAD.md`). `npm install` at the
  root only installs `node-llama-cpp`/`openai`/`dotenv`; examples cannot run until the specific model
  files are downloaded. These are not fetched during environment setup because of their size.
