/**
 * Claude Messages API drafter for memorandum content only.
 *
 * Same seam as the old local GGUF path: withSession(fn) serializes jobs, each
 * job starts from a cleared conversation, and draft(request, feedback) returns
 * schema-shaped JSON. Layout, spacing, and signature blocks stay out of reach.
 */

import Anthropic from "@anthropic-ai/sdk";

import {MEMO_CONTENT_SCHEMA, SYSTEM_PROMPT} from "./schema.js";
import {stubDrafter} from "./stub-drafter.js";

export {MEMO_CONTENT_SCHEMA, SYSTEM_PROMPT, stubDrafter};

/** Model id. ANTHROPIC_MODEL preferred; MEMO_MODEL_PATH kept as an alias. */
export const DEFAULT_MODEL_PATH = process.env.ANTHROPIC_MODEL
    ?? process.env.MEMO_MODEL_PATH
    ?? "claude-sonnet-4-5";

export const DEFAULT_TIMEOUT_MS = Number(process.env.MEMO_DRAFT_TIMEOUT_MS ?? 120_000);
export const DEFAULT_MAX_TOKENS = Number(process.env.MEMO_MAX_TOKENS ?? 4096);

/**
 * Whether drafting can run (API key present). The optional argument is ignored
 * and kept only so older call sites that passed a model path still type-check.
 */
export async function modelAvailable(_ignored) {
    return Boolean(process.env.ANTHROPIC_API_KEY && String(process.env.ANTHROPIC_API_KEY).trim());
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

function textFromMessage(message) {
    if (message?.parsed_output) return message.parsed_output;
    const block = (message?.content ?? []).find((b) => b.type === "text");
    if (!block?.text) {
        throw new Error("Claude returned no text content for the memorandum draft");
    }
    return JSON.parse(block.text);
}

/**
 * Load a Claude drafter. Prefer getDrafter(), which caches the client.
 *
 * @param {object} [options]
 * @param {string} [options.modelPath]  Claude model id (name kept for the old seam)
 * @param {string} [options.apiKey]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.maxTokens]
 */
export async function loadDrafter({
    modelPath = DEFAULT_MODEL_PATH,
    apiKey = process.env.ANTHROPIC_API_KEY,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxTokens = DEFAULT_MAX_TOKENS,
} = {}) {
    if (!(await modelAvailable(apiKey))) {
        throw new Error(
            `No ANTHROPIC_API_KEY set (drafting model would be ${modelPath}). ` +
            `Set ANTHROPIC_API_KEY in the environment, or use --offline / a stub drafter. ` +
            `Everything except the drafting step runs without a key.`);
    }

    const client = new Anthropic({apiKey});
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

                const message = await client.messages.parse({
                    model: modelPath,
                    max_tokens: maxTokens,
                    system: SYSTEM_PROMPT,
                    messages: history,
                    output_config: {
                        format: {
                            type: "json_schema",
                            schema: {
                                ...MEMO_CONTENT_SCHEMA,
                                additionalProperties: false,
                            },
                        },
                    },
                });

                const content = textFromMessage(message);
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
        info: {modelPath, contextSize: null, timeoutMs, maxTokens},
        async dispose() {
            await queue.catch(() => {});
        },
    };
}

let shared = null;

export function getDrafter(options) {
    shared ??= loadDrafter(options).catch((err) => {
        shared = null;
        throw err;
    });
    return shared;
}

export async function disposeDrafter() {
    if (!shared) return;
    const drafter = await shared.catch(() => null);
    shared = null;
    await drafter?.dispose();
}
