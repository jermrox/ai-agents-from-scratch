/**
 * Dataset + content-normalizer smoke tests (no Claude key required).
 *
 * Run: npm run test:datasets
 */

import {assembleMemo, detectMemoType, runMemoAgent} from "./memo-intent.js";
import {validateMemo} from "./memo-validator.js";
import {normalizeContent, contentIssues} from "./content.js";
import {auditDatasets, listFixtures, loadFixtureSync, OFFLINE_CONTENT, OFFLINE_CONTEXT} from "./datasets.js";
import {stubDrafter, disposeDrafter, getDrafter} from "./memo-drafter.js";
import {MEMO_CONTENT_SCHEMA} from "./drafter/schema.js";
import {TEMPLATES} from "./templates.js";

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
    checkTrue("hand numbering is stripped", messy.paragraphs[0].text.startsWith("Purpose"));
    checkTrue("POC soft-check is quiet on a good last paragraph",
        !contentIssues(messy).some((i) => i.includes("point of contact")));
}

{
    const detections = [
        ["exclusive for memorandum to COL Brooks", "exclusiveFor"],
        ["write a letter to Ms. Nguyen about the closure", "letter"],
        ["draft a memorandum of understanding for shared aids", "mou"],
        ["prepare a memorandum of agreement for reimbursable support", "moa"],
        ["document yesterday's staff sync", "record"],
        ["commend SFC Lee for outstanding support", "commendation"],
    ];
    for (const [request, type] of detections) {
        check(`detectMemoType: ${type}`, detectMemoType(request), type);
    }
}

{
    const audit = await auditDatasets();
    checkTrue("every fixture audits clean", audit.every((r) => r.ok));

    const fixtureTypes = new Set(listFixtures().map((f) => f.type));
    const templateTypes = Object.keys(TEMPLATES);
    for (const type of templateTypes) {
        checkTrue(`fixture coverage includes ${type}`, fixtureTypes.has(type));
    }
    check("fixture count matches template count", listFixtures().length, templateTypes.length);

    for (const {id} of listFixtures()) {
        const fixture = loadFixtureSync(id);
        check(`${id} request detects its type`, detectMemoType(fixture.request), fixture.type);

        const memo = assembleMemo(fixture.content, fixture.context);
        const result = validateMemo(memo);
        checkTrue(`${id} has no format/content errors`, result.errors.length === 0);
        checkTrue(`${id} renders at least one page`, result.pages >= 1);
        if (fixture.type === "mou" || fixture.type === "moa") {
            checkTrue(`${id} carries parties`, Array.isArray(memo.parties) && memo.parties.length >= 2);
            checkTrue(`${id} carries signers`, Array.isArray(memo.signers) && memo.signers.length >= 2);
        }
        if (fixture.type === "letter") {
            checkTrue(`${id} carries a salutation`, Boolean(memo.salutation));
        }
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

{
    // Without a key, getDrafter must not cache a failed load forever, and a
    // later call with a different model id must not reuse a prior promise.
    const hadKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await disposeDrafter();
    const first = await getDrafter({modelPath: "model-a"}).catch((e) => e.message);
    const second = await getDrafter({modelPath: "model-b"}).catch((e) => e.message);
    checkTrue("failed getDrafter mentions the requested model id", /model-b/.test(second));
    checkTrue("failed getDrafter still explains the missing key", /ANTHROPIC_API_KEY/.test(first));
    await disposeDrafter();
    if (hadKey !== undefined) process.env.ANTHROPIC_API_KEY = hadKey;
    else delete process.env.ANTHROPIC_API_KEY;
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
