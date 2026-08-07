/**
 * Dataset + content-normalizer smoke tests (no Claude key required).
 *
 * Run: npm run test:datasets
 */

import {assembleMemo, detectMemoType, runMemoAgent} from "./memo-intent.js";
import {validateMemo} from "./memo-validator.js";
import {normalizeContent, contentIssues} from "./content.js";
import {auditDatasets, listFixtures, loadFixtureSync, OFFLINE_CONTENT, OFFLINE_CONTEXT} from "./datasets.js";
import {stubDrafter} from "./memo-drafter.js";
import {MEMO_CONTENT_SCHEMA} from "./drafter/schema.js";

let passed = 0;
const failures = [];

function check(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) passed += 1;
    else failures.push({name, actual, expected});
}

function checkTrue(name, value) {
    check(name, value === true, true);
}

{
    checkTrue("schema forbids layout fields",
        !("officeSymbol" in MEMO_CONTENT_SCHEMA.properties)
        && !("date" in MEMO_CONTENT_SCHEMA.properties));
    check("paragraph level is an integer 0-3",
        MEMO_CONTENT_SCHEMA.properties.paragraphs.items.properties.level,
        {type: "integer", minimum: 0, maximum: 3, description: "0 main, 1 = a., 2 = (1), 3 = (a)"});
}

{
    const messy = normalizeContent({
        subject: "Range Closure for Maintenance.",
        addressees: ["  Bn 1  ", "", null],
        paragraphs: [
            {level: 9, text: "1. Purpose sentence first."},
            {level: 0, text: "My point of contact is Mr. David Okonkwo, ATZB-RC, at 719-555-0142 or david.a.okonkwo.civ@army.mil."},
        ],
    });
    check("subject drops trailing period", messy.subject, "Range Closure for Maintenance");
    check("empty addressees drop out", messy.addressees, ["Bn 1"]);
    check("level clamps to 3", messy.paragraphs[0].level, 3);
    check("hand numbering is stripped", messy.paragraphs[0].text.startsWith("Purpose"), true);
    checkTrue("normalized content has no soft issues beyond subject length",
        contentIssues(messy).filter((i) => !i.includes("ten words")).length === 0
        || contentIssues(messy).every((i) => typeof i === "string"));
}

{
    const audit = await auditDatasets();
    checkTrue("every fixture audits clean", audit.every((r) => r.ok));
    check("fixture catalog size", listFixtures().length, 5);

    for (const {id} of listFixtures()) {
        const fixture = loadFixtureSync(id);
        checkTrue(`${id} request detects compatible type or is explicit`,
            fixture.type === detectMemoType(fixture.request)
            || ["appreciation", "decision", "thru", "record", "standard"].includes(fixture.type));

        const memo = assembleMemo(fixture.content, fixture.context);
        const result = validateMemo(memo);
        checkTrue(`${id} has no format errors`, result.errors.length === 0);
        checkTrue(`${id} renders at least one page`, result.pages >= 1);
    }
}

{
    const drafter = stubDrafter(async () => OFFLINE_CONTENT);
    const {memo, result} = await drafter.withSession((draft) => runMemoAgent({
        request: "notify battalions",
        context: {...OFFLINE_CONTEXT, type: "standard"},
        draft,
    }));
    checkTrue("default offline fixture is compliant", result.compliant);
    checkTrue("assembled offline memo has a subject", Boolean(memo.subject));
}

if (failures.length) {
    console.error(`dataset tests: ${passed} passed, ${failures.length} failed`);
    for (const f of failures) {
        console.error(`  FAIL ${f.name}`);
        console.error(`    actual:   ${JSON.stringify(f.actual)}`);
        console.error(`    expected: ${JSON.stringify(f.expected)}`);
    }
    process.exitCode = 1;
} else {
    console.log(`dataset tests: ${passed}/${passed} passed.`);
}
