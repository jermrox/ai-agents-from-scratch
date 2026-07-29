/**
 * Example 16 - Army memorandum agent (AR 25-50)
 *
 * The lesson: when the output has a specification, do not ask the model to
 * satisfy it. Split the work.
 *
 *   LLM      -> content only, emitted as a constrained JSON spec
 *   Code     -> layout, from the line counts and inch measurements in AR 25-50
 *   Validator-> checks the result and returns cited findings
 *   Agent    -> feeds *content* findings back to the model and re-drafts
 *
 * A model asked to "write a memo in AR 25-50 format" will produce something
 * that looks right and is wrong on the third line below the office symbol. A
 * model asked to fill in a subject and five paragraphs cannot get the spacing
 * wrong, because it never touches the spacing.
 *
 * Run:
 *   node examples/16_army-memo-agent/army-memo-agent.js --offline
 *   node examples/16_army-memo-agent/army-memo-agent.js "Notify subordinate
 *       commands that range 14 closes for maintenance 3-7 August 2026."
 *
 * Flags:
 *   --offline        skip the model, run the canned spec through the pipeline
 *   --html <path>    write print-ready HTML
 *   --text <path>    write the plain-text rendering
 */

import {fileURLToPath} from "url";
import path from "path";
import fs from "fs/promises";

import {renderText, renderHtmlDocument} from "./memo-formatter.js";
import {validateMemo, formatReport, repairInstructions} from "./memo-validator.js";
import {formatMemoDate, MEMO_TYPES} from "./ar25-50.js";
import {createTemplate, describeTemplates} from "./templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// The contract the model fills in
// ---------------------------------------------------------------------------

/**
 * Paragraphs arrive flat with an explicit `level`, not as a nested tree.
 * A flat list is far easier to constrain with a grammar, and the agent rebuilds
 * the tree - which means the model cannot invent a fifth subdivision level that
 * AR 25-50 (fig 2-1) does not allow.
 */
const MEMO_CONTENT_SCHEMA = {
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

const SYSTEM_PROMPT = `You draft the CONTENT of U.S. Army memorandums. You never format them.

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

// ---------------------------------------------------------------------------
// Flat levels -> paragraph tree
// ---------------------------------------------------------------------------

/**
 * Rebuild the nested paragraph structure the renderer expects, clamping the
 * depth to the third subdivision (AR 25-50, fig 2-1) and repairing levels that
 * skip a rung.
 */
export function buildParagraphTree(flat) {
    const root = [];
    const stack = [{children: root, level: -1}];

    for (const item of flat ?? []) {
        const requested = Number.isFinite(item.level) ? Math.round(item.level) : 0;
        const level = Math.max(0, Math.min(3, requested));

        // Never let a paragraph jump more than one level deeper than its
        // predecessor - a level 3 directly under a level 0 has no parent.
        while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
        const effective = Math.min(level, stack[stack.length - 1].level + 1);

        const node = {text: (item.text ?? "").trim(), children: []};
        stack[stack.length - 1].children.push(node);
        stack.push({children: node.children, level: effective});
    }

    return prune(root);
}

/** Drop empty children arrays so the tree compares cleanly in tests. */
function prune(nodes) {
    return nodes.map((n) => {
        const children = prune(n.children ?? []);
        return children.length ? {text: n.text, children} : {text: n.text};
    });
}

// ---------------------------------------------------------------------------
// Assembling the full memo
// ---------------------------------------------------------------------------

/**
 * Merge model-authored content with the facts the caller owns. The model never
 * supplies the office symbol, ARIMS number, date, letterhead, or signature -
 * those are matters of record, not of language.
 */
export function assembleMemo(content, context) {
    return {
        type: context.type ?? "standard",
        letterhead: context.letterhead,
        officeSymbol: context.officeSymbol,
        arimsRecordNumber: context.arimsRecordNumber,
        date: context.date ?? formatMemoDate(),
        suspenseDate: context.suspenseDate ?? null,
        addressStyle: context.addressStyle ?? "mixed",
        addressees: content.addressees?.length ? content.addressees : (context.addressees ?? []),
        thru: context.thru ?? [],
        seeDistribution: context.seeDistribution ?? false,
        distribution: context.distribution ?? [],
        subject: content.subject,
        paragraphs: buildParagraphTree(content.paragraphs),
        authorityLine: context.authorityLine ?? null,
        signature: context.signature,
        digitalSignature: context.digitalSignature !== false,
        enclosures: context.enclosures ?? [],
        copiesFurnished: context.copiesFurnished ?? [],
        font: context.font,
    };
}

// ---------------------------------------------------------------------------
// The draft / validate / repair loop
// ---------------------------------------------------------------------------

/**
 * Draft, render, validate, and re-draft until the content findings clear or the
 * pass budget runs out.
 *
 * `draft` is any async (request, feedback) => content function. The offline demo
 * passes a stub; the live path passes the constrained LLM call. Keeping it a
 * parameter is what makes the loop testable without a model.
 */
export async function runMemoAgent({request, context, draft, maxPasses = 3, onPass}) {
    let content = await draft(request, null);
    let best = {memo: assembleMemo(content, context)};
    best.result = validateMemo(best.memo);

    for (let pass = 1; pass < maxPasses; pass++) {
        onPass?.({pass, result: best.result, memo: best.memo});

        const instructions = repairInstructions(best.result);
        if (instructions.length === 0) break;

        content = await draft(request, instructions);
        const memo = assembleMemo(content, context);
        const result = validateMemo(memo);

        // Keep the better draft rather than the latest one - a repair pass can
        // trade one advisory for two, and a stub drafter returns the same text
        // every time.
        if (score(result) >= score(best.result)) break;
        best = {memo, result};
    }

    return best;
}

/** Lower is better: errors dominate, advisories break ties. */
function score(result) {
    return result.errors.length * 100 + result.warnings.length;
}

// ---------------------------------------------------------------------------
// Live path: node-llama-cpp with a JSON-schema grammar
// ---------------------------------------------------------------------------

async function createLlmDrafter() {
    const {getLlama, LlamaChatSession} = await import("node-llama-cpp");

    const llama = await getLlama({debug: false});
    const model = await llama.loadModel({
        modelPath: path.join(__dirname, "..", "..", "models", "Qwen3-1.7B-Q8_0.gguf"),
    });
    const context = await model.createContext({contextSize: 4096});
    const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: SYSTEM_PROMPT,
    });

    // The grammar is the guardrail. The model physically cannot emit prose
    // outside the schema, so the parse below never fails.
    const grammar = await llama.createGrammarForJsonSchema(MEMO_CONTENT_SCHEMA);

    const draft = async (request, feedback) => {
        const prompt = feedback
            ? [
                "Revise the memorandum content. Keep what already works and fix only these findings:",
                ...feedback,
                "",
                `Original request: ${request}`,
            ].join("\n")
            : `Draft the content for this memorandum.\n\nRequest: ${request}`;

        const answer = await session.prompt(prompt, {grammar});
        return grammar.parse(answer);
    };

    const dispose = () => {
        session.dispose();
        context.dispose();
        model.dispose();
        llama.dispose();
    };

    return {draft, dispose};
}

// ---------------------------------------------------------------------------
// Offline path: a canned draft, so the pipeline runs with no model present
// ---------------------------------------------------------------------------

const OFFLINE_CONTENT = {
    subject: "Range 14 Closure for Scheduled Maintenance",
    addressees: [
        "Commander, 1st Battalion, 5th Infantry Regiment, 1234 Warrior Way, Fort Carson, CO  80913-4321",
        "Commander, 2d Battalion, 5th Infantry Regiment, 1236 Warrior Way, Fort Carson, CO  80913-4321",
    ],
    // Two spaces after ending punctuation, per para 1-39b(9). The renderer
    // normalizes this anyway; writing it correctly here keeps the demo report
    // free of advisories that are not about the memorandum.
    paragraphs: [
        {level: 0, text: "Range 14 closes for scheduled surface danger zone maintenance from 3 August 2026 through 7 August 2026.  Reschedule all live-fire iterations before 25 July 2026."},
        {level: 0, text: "Range Control will complete the following work during the closure:"},
        {level: 1, text: "Replace the target lifters on lanes 1 through 12."},
        {level: 1, text: "Regrade the access road and repair the berm on the north impact area."},
        {level: 0, text: "Units holding reservations on the affected dates will submit a revised range request through the Range Facility Management Support System no later than 1500 on 25 July 2026.  Range Control will confirm each new reservation within two duty days."},
        {level: 0, text: "My point of contact for this action is Mr. David Okonkwo, ATZB-RC, at 719-555-0142 or david.a.okonkwo.civ@army.mil."},
    ],
};

const OFFLINE_CONTEXT = {
    letterhead: {
        organization: "Headquarters, 4th Infantry Division",
        streetAddress: "1633 Mekong Street",
        cityStateZip: "Fort Carson, CO  80913-4321",
    },
    officeSymbol: "ATZB-RC",
    arimsRecordNumber: "25-50a",
    date: "17 July 2026",
    suspenseDate: "25 July 2026",
    authorityLine: "FOR THE COMMANDER:",
    signature: {
        name: "MARCUS T. HALE",
        gradeAndBranch: "LTC, IN",
        title: "Director, Plans and Operations",
    },
    enclosures: ["Range 14 Maintenance Schedule"],
    copiesFurnished: ["Garrison Safety Office"],
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
    const args = {
        offline: false, html: null, text: null, docx: null, request: null,
        template: null, spec: null, emitSpec: null, seal: null, list: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--offline") args.offline = true;
        else if (a === "--list-types") args.list = true;
        else if (a === "--html") args.html = argv[++i];
        else if (a === "--text") args.text = argv[++i];
        else if (a === "--docx") args.docx = argv[++i];
        else if (a === "--template") args.template = argv[++i];
        else if (a === "--spec") args.spec = argv[++i];
        else if (a === "--emit-spec") args.emitSpec = argv[++i];
        else if (a === "--seal") args.seal = argv[++i];
        else args.request = args.request ? `${args.request} ${a}` : a;
    }
    return args;
}

/**
 * Pick the memorandum type from what the user actually asked for.
 *
 * Deliberately shallow: it reads the request for the phrases that name a type
 * in AR 25-50 and otherwise returns "standard". Getting this wrong is cheap to
 * correct with --template; getting it wrong *silently* would not be, so the
 * chosen type is always printed back.
 */
export function detectMemoType(request = "") {
    const text = String(request).toLowerCase();
    const rules = [
        [/\bmemorandum of agreement\b|\bmoa\b/, "moa"],
        [/\bmemorandum of understanding\b|\bmou\b/, "mou"],
        [/\bmemorandum for record\b|\bmfr\b|\b(record|document|memorialize|write up)\b[^.]*\b(call|phone call|conversation|meeting|discussion|decision reached|agreement reached)\b/, "record"],
        [/\bdecision memo\w*\b|\bfor decision\b|\bseeking (a )?decision\b|\bapproval memo\w*\b/, "decision"],
        [/\bthru\b|\bthrough the chain of command\b|\bendorse\w*\b/, "thru"],
    ];
    for (const [pattern, type] of rules) {
        if (pattern.test(text)) return type;
    }
    return "standard";
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.list) {
        for (const t of describeTemplates()) {
            console.log(`  ${t.type.padEnd(9)} ${t.title.padEnd(30)} ${t.cite}`);
        }
        return;
    }

    // --template and --spec skip the model entirely: one produces an editable
    // skeleton, the other renders a spec you have already filled in.
    if (args.template || args.spec) {
        const memo = args.spec
            ? JSON.parse(await fs.readFile(args.spec, "utf8"))
            : createTemplate(args.template);
        await emit(memo, args);
        return;
    }

    const offline = args.offline || !args.request;

    const request = args.request ??
        "Notify subordinate battalions that Range 14 closes for maintenance 3-7 August 2026.";

    let drafter;
    if (offline) {
        console.log("Running offline: canned content, real formatter and validator.\n");
        drafter = {draft: async () => OFFLINE_CONTENT, dispose: () => {}};
    } else {
        try {
            drafter = await createLlmDrafter();
        } catch (err) {
            console.error(`Could not start the drafting model: ${err.message}\n`);
            console.error("Run `npm install`, then place Qwen3-1.7B-Q8_0.gguf under models/");
            console.error("(see DOWNLOAD.md). Or use --offline: the formatter, the validator,");
            console.error("and verify.js all run without a model.");
            process.exitCode = 1;
            return;
        }
    }

    // The memorandum type follows the request, and is reported back so a wrong
    // guess is visible rather than silent.
    const type = detectMemoType(request);
    const context = {...OFFLINE_CONTEXT, type};
    if (type === "record") context.letterhead = null;   // plain paper - fig 2-17
    if (type === "record") context.authorityLine = null;

    const {memo, result} = await runMemoAgent({
        request,
        context,
        draft: drafter.draft,
        onPass: ({pass, result}) => {
            const n = result.contentFindings.length;
            if (n > 0) console.log(`Pass ${pass}: ${n} content finding(s), re-drafting.`);
        },
    });

    drafter.dispose();
    await emit(memo, args);
}

/**
 * Render, report, and write whatever outputs were asked for. Shared by the
 * drafting path and the template path so both go through the same validation.
 */
async function emit(memo, args) {
    const text = renderText(memo);
    console.log(text);
    console.log("\n" + "-".repeat(72) + "\n");

    const result = validateMemo(memo);
    console.log(formatReport(result));

    const meta = MEMO_TYPES[memo.type] ?? MEMO_TYPES.standard;
    console.log(`\nType: ${meta.title} (${meta.cite})`);

    if (args.text) {
        await fs.writeFile(args.text, text, "utf8");
        console.log(`Wrote ${args.text}`);
    }
    if (args.html) {
        await fs.writeFile(args.html, renderHtmlDocument(memo), "utf8");
        console.log(`Wrote ${args.html}`);
    }
    if (args.emitSpec) {
        await fs.writeFile(args.emitSpec, JSON.stringify(memo, null, 2) + "\n", "utf8");
        console.log(`Wrote ${args.emitSpec} - edit it and re-run with --spec ${args.emitSpec}`);
    }
    if (args.docx) {
        const {writeDocx} = await import("./memo-docx.js");
        await writeDocx(memo, args.docx, args.seal ? {seal: args.seal} : {});
        console.log(`Wrote ${args.docx}`);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await main();
}

export {MEMO_CONTENT_SCHEMA, SYSTEM_PROMPT, OFFLINE_CONTENT, OFFLINE_CONTEXT};
