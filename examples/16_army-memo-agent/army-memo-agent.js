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
 *   --serve          open the front end on http://localhost:4250
 */

import {fileURLToPath} from "url";
import path from "path";
import fs from "fs/promises";

import {renderText, renderHtmlDocument} from "./memo-formatter.js";
import {validateMemo, formatReport, repairInstructions} from "./memo-validator.js";
import {formatMemoDate, MEMO_TYPES} from "./ar25-50.js";
import {createTemplate, describeTemplates} from "./templates.js";
import {buildParagraphTree, assembleMemo, detectMemoType, runMemoAgent} from "./memo-intent.js";
import {
    getDrafter, disposeDrafter, stubDrafter, modelAvailable,
    MEMO_CONTENT_SCHEMA, SYSTEM_PROMPT, DEFAULT_MODEL_PATH,
} from "./memo-drafter.js";

// Re-exported so the CLI stays the single import for callers that had them
// here. They live in memo-intent.js now because the front end needs them too,
// and a module with a top-level `await main()` cannot be imported from one it
// imports itself.
export {buildParagraphTree, assembleMemo, detectMemoType, runMemoAgent};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// The draft / validate / repair loop
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Live path: node-llama-cpp with a JSON-schema grammar
// ---------------------------------------------------------------------------


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
    // Stating the facts about the signer and letting chapter 6 build the grade
    // line, rather than typing "LTC, IN" and hoping. The rules that depend on
    // those facts - general staff, reserve component, retired, acting - are
    // not ones a drafter should have to remember.
    signature: {
        signer: {
            name: "Marcus T. Hale",
            grade: "LTC",
            branch: "IN",
            title: "Director, Plans and Operations",
        },
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
        serve: false, port: undefined, host: undefined, model: null,
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
        else if (a === "--serve") args.serve = true;
        else if (a === "--port") args.port = Number(argv[++i]);
        else if (a === "--host") args.host = argv[++i];
        else if (a === "--model") args.model = argv[++i];
        else args.request = args.request ? `${args.request} ${a}` : a;
    }
    return args;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    // The front end: pick a type, say what you need, get a memorandum whose
    // matters of record are placeholders you fill in afterwards.
    if (args.serve) {
        const {serve} = await import("./memo-server.js");
        await serve({port: args.port, host: args.host, seal: args.seal, modelPath: args.model});
        return;
    }

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
        drafter = stubDrafter(async () => OFFLINE_CONTENT);
    } else {
        try {
            drafter = await getDrafter(args.model ? {modelPath: args.model} : undefined);
        } catch (err) {
            console.error(`Could not start the drafting model: ${err.message}\n`);
            console.error("Run `npm install`, then place a GGUF under models/ (see DOWNLOAD.md),");
            console.error("or set MEMO_MODEL_PATH. Or use --offline: the formatter, the");
            console.error("validator, the .docx and verify.js all run without a model.");
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

    // One job holds the model for the whole draft/validate/repair loop, so the
    // repair passes see the draft they are fixing.
    const {memo} = await drafter.withSession((draft) => runMemoAgent({
        request,
        context,
        draft,
        onPass: ({pass, result}) => {
            const n = result.contentFindings.length;
            if (n > 0) console.log(`Pass ${pass}: ${n} content finding(s), re-drafting.`);
        },
    }));

    await disposeDrafter();
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
