/**
 * Claude Messages API drafter for memorandum content only.
 *
 * Uses @anthropic-ai/sdk messages.parse + jsonSchemaOutputFormat so the model
 * cannot emit keys outside MEMO_CONTENT_SCHEMA. Layout stays in code.
 */

import Anthropic, {APIError} from "@anthropic-ai/sdk";
import {jsonSchemaOutputFormat} from "@anthropic-ai/sdk/helpers/json-schema";

import {MEMO_CONTENT_SCHEMA, SYSTEM_PROMPT} from "./schema.js";
import {stubDrafter} from "./stub-drafter.js";
import {normalizeContent} from "../content.js";

export {MEMO_CONTENT_SCHEMA, SYSTEM_PROMPT, stubDrafter};

/** Claude model id. ANTHROPIC_MODEL preferred; MEMO_MODEL_PATH is a legacy alias. */
export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL
    ?? process.env.MEMO_MODEL_PATH
    ?? "claude-sonnet-4-5";

/** @deprecated Prefer DEFAULT_MODEL. Kept for callers/tests that still say "path". */
export const DEFAULT_MODEL_PATH = DEFAULT_MODEL;

export const DEFAULT_TIMEOUT_MS = Number(process.env.MEMO_DRAFT_TIMEOUT_MS ?? 120_000);
export const DEFAULT_MAX_TOKENS = Number(process.env.MEMO_MAX_TOKENS ?? 4096);
export const DEFAULT_MAX_RETRIES = Number(process.env.MEMO_DRAFT_RETRIES ?? 2);

/** Whether drafting can run given an API key (defaults to env). */
export async function modelAvailable(apiKey = process.env.ANTHROPIC_API_KEY) {
    return Boolean(apiKey && String(apiKey).trim());
}

function withTimeout(promise, ms) {
    if (!ms || ms <= 0) return promise;
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Drafting timed out after ${ms} ms`)), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
    if (!err) return false;
    if (err.status === 408 || err.status === 409 || err.status === 429 || err.status >= 500) return true;
    if (err instanceof APIError && (err.status === 429 || err.status >= 500)) return true;
    const msg = String(err.message ?? "");
    return /timed out|ECONNRESET|ETIMEDOUT|overloaded|rate limit/i.test(msg);
}

async function withRetries(fn, {maxRetries, label}) {
    let last;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn(attempt);
        } catch (err) {
            last = err;
            if (attempt >= maxRetries || !isRetryable(err)) throw err;
            const backoff = Math.min(8_000, 400 * 2 ** attempt);
            await sleep(backoff);
        }
    }
    throw last ?? new Error(`${label} failed`);
}

function textFromMessage(message) {
    if (message?.parsed_output != null) return message.parsed_output;
    const block = (message?.content ?? []).find((b) => b.type === "text");
    if (!block?.text) {
        throw new Error("Claude returned no text content for the memorandum draft");
    }
    return JSON.parse(block.text);
}

function cacheKey({modelPath, apiKey, timeoutMs, maxTokens, maxRetries}) {
    return JSON.stringify({
        modelPath: modelPath ?? DEFAULT_MODEL,
        apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
        timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxTokens: maxTokens ?? DEFAULT_MAX_TOKENS,
        maxRetries: maxRetries ?? DEFAULT_MAX_RETRIES,
    });
}

const OUTPUT_FORMAT = jsonSchemaOutputFormat(MEMO_CONTENT_SCHEMA);

/**
 * Load a Claude drafter. Prefer getDrafter(), which caches by options.
 *
 * @param {object} [options]
 * @param {string} [options.modelPath]  Claude model id (legacy name; same as model)
 * @param {string} [options.model]      Claude model id
 * @param {string} [options.apiKey]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.maxTokens]
 * @param {number} [options.maxRetries]
 */
export async function loadDrafter({
    model,
    modelPath = model ?? DEFAULT_MODEL,
    apiKey = process.env.ANTHROPIC_API_KEY,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxTokens = DEFAULT_MAX_TOKENS,
    maxRetries = DEFAULT_MAX_RETRIES,
} = {}) {
    if (!(await modelAvailable(apiKey))) {
        throw new Error(
            `No ANTHROPIC_API_KEY set (drafting model would be ${modelPath}). ` +
            `Set ANTHROPIC_API_KEY in the environment, or use --offline / a stub drafter. ` +
            `Everything except the drafting step runs without a key.`);
    }

    const client = new Anthropic({apiKey, maxRetries: 0});
    let queue = Promise.resolve();
    let inFlight = 0;

    function withSession(fn) {
        inFlight += 1;
        const run = queue.then(async () => {
            const history = [];
            const draft = async (request, feedback) => {
                const prompt = feedback?.length
                    ? [
                        "Revise the memorandum content. Keep what already works and fix only these findings:",
                        ...feedback,
                        "",
                        `Original request: ${request}`,
                    ].join("\n")
                    : `Draft the content for this memorandum.\n\nRequest: ${request}`;

                history.push({role: "user", content: prompt});

                const message = await withRetries(
                    () => client.messages.parse({
                        model: modelPath,
                        max_tokens: maxTokens,
                        system: SYSTEM_PROMPT,
                        messages: history,
                        output_config: {format: OUTPUT_FORMAT},
                    }),
                    {maxRetries, label: "Claude draft"},
                );

                const content = normalizeContent(textFromMessage(message));
                const assistantText = (message.content ?? [])
                    .filter((b) => b.type === "text")
                    .map((b) => b.text)
                    .join("") || JSON.stringify(content);
                history.push({role: "assistant", content: assistantText});
                return content;
            };
            return withTimeout(fn(draft), timeoutMs);
        });

        queue = run.then(() => {}, () => {});
        return run.finally(() => { inFlight -= 1; });
    }

    return {
        withSession,
        get pending() { return inFlight; },
        info: {
            model: modelPath,
            modelPath,
            timeoutMs,
            maxTokens,
            maxRetries,
            provider: "anthropic",
        },
        async dispose() {
            await queue.catch(() => {});
        },
    };
}

let shared = null;
let sharedKey = null;

/**
 * Process-wide drafter, keyed by options. A later call with a different model
 * id or API key replaces the cached instance instead of silently ignoring it.
 */
export function getDrafter(options = {}) {
    const key = cacheKey(options);
    if (shared && sharedKey === key) return shared;

    if (shared) {
        // Drop the old promise; dispose asynchronously so callers are not blocked.
        const previous = shared;
        shared = null;
        sharedKey = null;
        previous.then((d) => d.dispose()).catch(() => {});
    }

    sharedKey = key;
    shared = loadDrafter(options).catch((err) => {
        if (sharedKey === key) {
            shared = null;
            sharedKey = null;
        }
        throw err;
    });
    return shared;
}

export async function disposeDrafter() {
    if (!shared) return;
    const drafter = await shared.catch(() => null);
    shared = null;
    sharedKey = null;
    await drafter?.dispose();
}
