/**
 * Army memorandum CLI (AR 25-50).
 *
 *   Claude   -> content only, structured JSON
 *   Code     -> layout from AR 25-50 line counts and inch measurements
 *   Validator-> cited findings (content vs format)
 *   Agent    -> feeds content findings back and re-drafts
 *
 * Run:
 *   node bin/memo.js --offline
 *   node bin/memo.js --fixture mfr-staff-sync --docx memo.docx
 *   node bin/memo.js --docx memo.docx "Notify subordinate battalions..."
 *
 * Flags:
 *   --offline           skip Claude; use default fixture content
 *   --fixture <id>      offline path using a datasets/ fixture
 *   --list-fixtures     list golden fixtures
 *   --html / --text / --docx
 *   --serve             HTTP API on :4250
 *   --verify            AR 25-50 figure regression suite
 */

import "dotenv/config";
import fs from "fs/promises";

import {renderText, renderHtmlDocument} from "./memo-formatter.js";
import {validateMemo, formatReport} from "./memo-validator.js";
import {MEMO_TYPES} from "./ar25-50.js";
import {createTemplate, describeTemplates} from "./templates.js";
import {buildParagraphTree, assembleMemo, detectMemoType, runMemoAgent} from "./memo-intent.js";
import {
    getDrafter, disposeDrafter, stubDrafter,
    MEMO_CONTENT_SCHEMA, SYSTEM_PROMPT,
} from "./memo-drafter.js";
import {
    OFFLINE_CONTENT, OFFLINE_CONTEXT,
    loadFixtureSync, listFixtures, loadDefaultFixtureSync,
} from "./datasets.js";
import {isDirectRun} from "./runtime.js";

export {buildParagraphTree, assembleMemo, detectMemoType, runMemoAgent};
export {OFFLINE_CONTENT, OFFLINE_CONTEXT, MEMO_CONTENT_SCHEMA, SYSTEM_PROMPT};

/** Flags that take a value, mapped to the field they fill. */
const VALUE_FLAGS = {
    "--fixture": "fixture",
    "--html": "html",
    "--text": "text",
    "--docx": "docx",
    "--template": "template",
    "--spec": "spec",
    "--emit-spec": "emitSpec",
    "--seal": "seal",
    "--port": "port",
    "--host": "host",
    "--model": "model",
    "--unit": "unit",
    "--save-unit": "saveUnit",
};

const BOOLEAN_FLAGS = {
    "--offline": "offline",
    "--list-types": "list",
    "--list-fixtures": "listFixtures",
    "--serve": "serve",
    "--verify": "verify",
    "--help": "help",
    "-h": "help",
};

export function parseArgs(argv) {
    const args = {
        offline: false, html: null, text: null, docx: null, request: null,
        template: null, spec: null, emitSpec: null, seal: null, list: false,
        listFixtures: false, fixture: null, help: false,
        serve: false, verify: false, port: undefined, host: undefined, model: null,
        unit: null, saveUnit: null,
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];

        if (a in BOOLEAN_FLAGS) {
            args[BOOLEAN_FLAGS[a]] = true;
            continue;
        }

        if (a in VALUE_FLAGS) {
            const value = argv[i + 1];
            // A missing value used to swallow the next flag: `--docx --offline`
            // wrote a file called "--offline".
            if (value === undefined || value.startsWith("--")) {
                throw new Error(`${a} needs a value`);
            }
            i += 1;
            if (a === "--port") {
                const port = Number(value);
                if (!Number.isInteger(port) || port < 0 || port > 65535) {
                    throw new Error(`--port must be a port number, got "${value}"`);
                }
                args.port = port;
            } else {
                args[VALUE_FLAGS[a]] = value;
            }
            continue;
        }

        if (a.startsWith("--")) throw new Error(`Unknown flag ${a}`);
        args.request = args.request ? `${args.request} ${a}` : a;
    }
    return args;
}

const USAGE = `army-memo - AR 25-50 memorandums (Claude drafts words, code owns layout)

Usage:
  memo [request text]            draft with Claude (needs ANTHROPIC_API_KEY)
  memo --offline                 use the default golden fixture
  memo --fixture <id>            use a named fixture (see --list-fixtures)
  memo --template <type>         start from an editable skeleton
  memo --spec <file.json>        render a spec you already filled in

Output:
  --docx <path>                  Word deliverable
  --html <path>                  print-ready HTML
  --text <path>                  plain-text rendering
  --emit-spec <file.json>        write the spec out for editing

Unit profile:
  --unit <file.json>             apply a saved unit profile
  --save-unit <file.json>        save this memorandum's unit details

Other:
  --list-types                   memorandum types
  --list-fixtures                golden fixtures
  --serve [--port N] [--host H]  HTTP API (default 127.0.0.1:4250)
  --model <id>                   Claude model id (or ANTHROPIC_MODEL)
  --seal <path>                  override the letterhead seal
  --verify                       AR 25-50 figure regression suite
  -h, --help                     this help`;

/** Read and parse a JSON file, reporting the path rather than a stack trace. */
async function readJsonFile(filePath, what) {
    let raw;
    try {
        raw = await fs.readFile(filePath, "utf8");
    } catch (err) {
        throw new Error(`Could not read ${what} ${filePath}: ${err.code ?? err.message}`);
    }
    try {
        return JSON.parse(raw);
    } catch (err) {
        throw new Error(`${what} ${filePath} is not valid JSON: ${err.message}`);
    }
}

export async function main(argv = process.argv.slice(2)) {
    let args;
    try {
        args = parseArgs(argv);
    } catch (err) {
        console.error(`${err.message}\n`);
        console.error(USAGE);
        process.exitCode = 2;
        return;
    }

    if (args.help) {
        console.log(USAGE);
        return;
    }

    if (args.verify) {
        await import("./verify.js");
        return;
    }

    if (args.serve) {
        const {serve} = await import("./api/server.js");
        await serve({port: args.port, host: args.host, seal: args.seal, modelPath: args.model});
        return;
    }

    if (args.list) {
        const types = describeTemplates();
        const typeWidth = Math.max(...types.map((t) => t.type.length));
        const titleWidth = Math.max(...types.map((t) => t.title.length));
        for (const t of types) {
            console.log(`  ${t.type.padEnd(typeWidth)} ${t.title.padEnd(titleWidth)} ${t.cite}`);
        }
        return;
    }

    if (args.listFixtures) {
        for (const f of listFixtures()) {
            const mark = f.default ? "*" : " ";
            console.log(`  ${mark} ${f.id.padEnd(20)} ${f.type.padEnd(14)} ${f.request}`);
        }
        return;
    }

    if (args.template || args.spec) {
        const memo = args.spec
            ? await readJsonFile(args.spec, "spec")
            : createTemplate(args.template);
        await emit(memo, args);
        return;
    }

    const fixture = args.fixture
        ? loadFixtureSync(args.fixture)
        : (args.offline || !args.request ? loadDefaultFixtureSync() : null);
    const offline = Boolean(args.offline || args.fixture || !args.request);

    const request = args.request ?? fixture?.request ??
        "Notify subordinate battalions that Range 14 closes for maintenance 3-7 August 2026.";

    let drafter;
    if (offline) {
        const content = fixture?.content ?? OFFLINE_CONTENT;
        console.log(`Running offline fixture "${fixture?.id ?? "range-closure"}": real formatter and validator.\n`);
        drafter = stubDrafter(async () => content);
    } else {
        try {
            drafter = await getDrafter(args.model ? {modelPath: args.model} : undefined);
        } catch (err) {
            console.error(`Could not start the Claude drafter: ${err.message}\n`);
            console.error("Set ANTHROPIC_API_KEY (and optionally ANTHROPIC_MODEL).");
            console.error("Or use --offline / --fixture: the formatter, validator, and .docx run without Claude.");
            process.exitCode = 1;
            return;
        }
    }

    const type = fixture?.type ?? detectMemoType(request);
    const baseContext = fixture?.context ?? {...OFFLINE_CONTEXT, type};
    const context = {...baseContext, type};

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

async function emit(memo, args) {
    const {applyProfile, profileFrom, validateProfile, outstandingFields} =
        await import("./unit-profile.js");

    if (args.unit) {
        const profile = await readJsonFile(args.unit, "unit profile");
        const bad = validateProfile(profile);
        for (const f of bad) console.error(`  ${args.unit}: ${f.message}  [${f.cite}]`);
        memo = applyProfile(memo, profile);
    }

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
    if (args.saveUnit) {
        const profile = profileFrom(memo);
        await fs.writeFile(args.saveUnit, JSON.stringify(profile, null, 2) + "\n", "utf8");
        console.log(`Wrote ${args.saveUnit} - reuse it with --unit ${args.saveUnit}`);
    }

    const unitOutstanding = outstandingFields(memo, "unit");
    const memoOutstanding = outstandingFields(memo, "memorandum").filter((f) => !f.optional);
    if (unitOutstanding.length || memoOutstanding.length) {
        console.log("\nStill to be supplied - each is a click-to-type slot in the .docx,");
        console.log("editable as text with the formatting locked:\n");
        for (const [scope, fields] of [["your unit", unitOutstanding],
                                       ["this memorandum", memoOutstanding]]) {
            if (!fields.length) continue;
            console.log(`  ${scope}`);
            for (const f of fields) console.log(`    ${f.label.padEnd(20)} ${f.hint}  [${f.cite}]`);
        }
        if (unitOutstanding.length) {
            console.log("\n  Your unit's details do not change between memorandums.");
            console.log("  Fill them in once and keep them with --save-unit unit.json,");
            console.log("  then pass --unit unit.json next time.");
        }
    }
}

if (isDirectRun(import.meta.url)) {
    await main();
}
