/**
 * Public drafter entry for the package and for verify.js.
 * Implementation lives under ./drafter/.
 */

export {
    MEMO_CONTENT_SCHEMA,
    SYSTEM_PROMPT,
    DEFAULT_MODEL_PATH,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_MAX_TOKENS,
    modelAvailable,
    loadDrafter,
    getDrafter,
    disposeDrafter,
    stubDrafter,
} from "./drafter/claude-drafter.js";
