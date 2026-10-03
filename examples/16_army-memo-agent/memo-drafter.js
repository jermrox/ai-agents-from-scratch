/**
 * The drafting model, as a service rather than a one-shot.
 *
 * The CLI could afford to load a model, ask it one thing, and throw it away.
 * A server cannot: loading a 1.7B model takes seconds, and a llama.cpp context
 * sequence is not safe to prompt from two places at once. So this module owns
 * exactly three things the CLI never had to think about.
 *
 *   loaded once      `getDrafter()` caches the load promise, so the model is
 *                    read from disk once per process no matter how many
 *                    requests arrive - including the ones that arrive while it
 *                    is still loading.
 *
 *   one at a time    `withSession()` serializes jobs through a promise chain.
 *                    Two concurrent prompts on one sequence interleave their
 *                    tokens and corrupt both answers.
 *
 *   no bleed         Each job starts from a cleared chat history. Within a job
 *                    the repair passes deliberately share it - the model needs
 *                    to see the draft it is being asked to fix - but one
 *                    request's memorandum must never inform the next one's.
 *                    Without the reset the context also grows until it
 *                    overflows, which shows up as a server that works fine for
 *                    an hour and then stops.
 *
 * The grammar is what makes the whole arrangement safe. The model is
 * constrained to the JSON schema below, so it physically cannot emit prose
 * outside it and the parse cannot fail - which is why the layout code never
 * has to defend itself against what the model said.
 *
 * None of this is required to run the example. The formatter, the validator,
 * the templates, the .docx and verify.js all work with no model at all; only
 * the words need one.
 */

import fs from "fs/promises";
import path from "path";
import {fileURLToPath} from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where the model lives. `MEMO_MODEL_PATH` overrides it, so a deployment can
 * point at a mounted volume without editing anything.
 */
export const DEFAULT_MODEL_PATH = process.env.MEMO_MODEL_PATH
    ?? path.join(__dirname, "..", "..", "models", "Qwen3-1.7B-Q8_0.gguf");

export const DEFAULT_CONTEXT_SIZE = Number(process.env.MEMO_CONTEXT_SIZE ?? 4096);

/** How long one drafting job may take before it is abandoned. */
export const DEFAULT_TIMEOUT_MS = Number(process.env.MEMO_DRAFT_TIMEOUT_MS ?? 120_000);

/**
 * The only thing the model is allowed to produce.
 *
 * Paragraphs arrive flat with an explicit `level`, not as a nested tree. A flat
 * list is far easier to constrain with a grammar, and buildParagraphTree()
 * rebuilds the nesting - which means the model cannot invent a fifth
 * subdivision level that figure 2-1 does not allow.
 *
 * Note what is *not* here: no office symbol, no date, no signature block, no
 * numbering, no spacing. Those are matters of record or matters of layout, and
 * a model has no standing to supply either. `level` is the subdivision depth
 * (para 2-4b(4)), not a label - figure 2-1's "1.", "a.", "(1)" come from the
 * renderer.
 */
export const MEMO_CONTENT_SCHEMA = {
    type: "object",
    properties: {
        subject: {
            type: "string",
            description: "Ten words or less, no acronyms, no closing period.",
        },
        addressees: {
            type: "array",
            items: {type: "string"},
            description: "Offices expected to complete the action.",
        },
        paragraphs: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    level: {type: "number", description: "0 main, 1 = a., 2 = (1), 3 = (a)"},
                    text: {type: "string", description: "Sentence text only, no numbering."},
                },
                required: ["level", "text"],
            },
        },
    },
    required: ["subject", "addressees", "paragraphs"],
};

export const SYSTEM_PROMPT = `You draft the CONTENT of U.S. Army memorandums. You never format them.

Write in the Army style required by AR 25-50:
- Bottom line up front: purpose sentence first, then the recommendation or main point.
- Active voice. Put the actor before the verb.
- Short words, sentences averaging about 15 words, paragraphs no longer than 10 lines.
- Use "I," "you," and "we" rather than "this office" or "this headquarters."
- Never begin a sentence with "It is," "There is," or "There are."
- Capitalize Soldier, Family, and Civilian in their Army senses.
- Military time only, four digits, and never the word "hours" after it.
- The LAST paragraph is always the point of contact: grade, first and last name,
  office symbol, telephone number, and email address.
- Subject line: ten words or less, no acronyms, no closing period.

Do not number your paragraphs. Do not write "MEMORANDUM FOR", "SUBJECT:", dates,
signature blocks, or any layout. Set the level field instead: 0 for a main
paragraph, 1 for an "a." subparagraph, 2 for "(1)", 3 for "(a)". If you use
level 1 under a paragraph, use it at least twice.`;

/** Whether a model file is actually there, without throwing if it is not. */
export async function modelAvailable(modelPath = DEFAULT_MODEL_PATH) {
    try {
        const stat = await fs.stat(modelPath);
        return stat.isFile();
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// The drafter
// ---------------------------------------------------------------------------

/**
 * Load the model and return a drafter. Prefer `getDrafter()`, which caches
 * this - calling it twice loads the model twice.
 */
export async function loadDrafter({
    modelPath = DEFAULT_MODEL_PATH,
    contextSize = DEFAULT_CONTEXT_SIZE,
    timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
    if (!(await modelAvailable(modelPath))) {
        throw new Error(
            `No model at ${modelPath}. Place a GGUF there (see DOWNLOAD.md), or set ` +
            `MEMO_MODEL_PATH. Everything except the drafting step runs without one.`);
    }

    const {getLlama, LlamaChatSession} = await import("node-llama-cpp");

    const llama = await getLlama({debug: false});
    const model = await llama.loadModel({modelPath});
    const context = await model.createContext({contextSize});
    const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: SYSTEM_PROMPT,
    });
    const grammar = await llama.createGrammarForJsonSchema(MEMO_CONTENT_SCHEMA);

    // Jobs run one at a time. Each link in this chain is the previous job's
    // completion, so a queue forms naturally and nothing interleaves.
    let queue = Promise.resolve();
    let inFlight = 0;

    /**
     * Run `fn(draft)` with sole use of the model and a cleared history.
     * `draft(request, feedback)` is the shape runMemoAgent() expects.
     */
    function withSession(fn) {
        inFlight += 1;
        const run = queue.then(async () => {
            session.resetChatHistory();
            const draft = async (request, feedback) => {
                const prompt = feedback?.length
                    ? [
                        "Revise the memorandum content. Keep what already works and fix only these findings:",
                        ...feedback,
                        "",
                        `Original request: ${request}`,
                    ].join("\n")
                    : `Draft the content for this memorandum.\n\nRequest: ${request}`;

                return grammar.parse(await session.prompt(prompt, {grammar}));
            };
            return withTimeout(fn(draft), timeoutMs);
        });

        // The queue must advance even when a job fails, or one error wedges
        // every request behind it for the life of the process.
        queue = run.then(() => {}, () => {});
        return run.finally(() => { inFlight -= 1; });
    }

    return {
        withSession,
        get pending() { return inFlight; },
        info: {modelPath, contextSize, timeoutMs},
        async dispose() {
            await queue.catch(() => {});
            session.dispose();
            await context.dispose();
            await model.dispose();
            await llama.dispose();
        },
    };
}

let shared = null;

/**
 * The process-wide drafter. Concurrent callers share one load rather than
 * racing to start several - the second request during a cold start waits for
 * the first one's model instead of loading its own.
 */
export function getDrafter(options) {
    shared ??= loadDrafter(options).catch((err) => {
        shared = null;          // a failed load must not be cached forever
        throw err;
    });
    return shared;
}

/** Release the shared drafter, if one was ever loaded. */
export async function disposeDrafter() {
    if (!shared) return;
    const drafter = await shared.catch(() => null);
    shared = null;
    await drafter?.dispose();
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

// ---------------------------------------------------------------------------
// A drafter that needs no model
// ---------------------------------------------------------------------------

/**
 * Wrap a plain `(request, feedback) => content` function in the same interface.
 *
 * This is what makes the draft/validate/repair loop testable without a model,
 * and it is the seam a different backend would use - a hosted API, a larger
 * local model, a canned fixture. The loop does not know or care which it has.
 */
export function stubDrafter(draft) {
    let queue = Promise.resolve();
    return {
        withSession(fn) {
            const run = queue.then(() => fn(draft));
            queue = run.then(() => {}, () => {});
            return run;
        },
        pending: 0,
        info: {modelPath: null, contextSize: null, timeoutMs: null},
        async dispose() {},
    };
}
