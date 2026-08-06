/**
 * Public package surface for army-memo.
 *
 * Consumers can import drafting, layout, validation, datasets, and the HTTP
 * server without reaching into individual tutorial-style files.
 */

export {
    MEMO_CONTENT_SCHEMA,
    SYSTEM_PROMPT,
    DEFAULT_MODEL_PATH,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_MAX_TOKENS,
    DEFAULT_MAX_RETRIES,
    modelAvailable,
    loadDrafter,
    getDrafter,
    disposeDrafter,
    stubDrafter,
} from "./memo-drafter.js";

export {
    buildParagraphTree,
    assembleMemo,
    detectMemoType,
    runMemoAgent,
} from "./memo-intent.js";

export {normalizeContent, contentIssues} from "./content.js";
export {
    loadFixture,
    loadFixtureSync,
    loadDefaultFixture,
    listFixtures,
    auditDatasets,
    OFFLINE_CONTENT,
    OFFLINE_CONTEXT,
    DATASETS_ROOT,
} from "./datasets.js";

export {validateMemo, formatReport, repairInstructions} from "./memo-validator.js";
export {renderText, renderHtmlDocument, layoutMemo, DEFAULT_SEAL_PATH} from "./memo-formatter.js";
export {renderDocx, writeDocx} from "./memo-docx.js";
export {createTemplate, describeTemplates, TEMPLATES} from "./templates.js";
export {createMemoServer, serve, parseBody, bodyFromParagraphs, specFromForm} from "./memo-server.js";
export {MEMO_TYPES, formatMemoDate} from "./ar25-50.js";
