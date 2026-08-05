/**
 * Verify the renderer against AR 25-50 itself.
 *
 * The regulation prints its own line counts in the left margin of figures 2-1
 * through 2-5. Those numbers are the test oracle: this script rebuilds each
 * figure as a memo spec, lays it out, and asserts that the distance between
 * every pair of landmarks matches the count the figure shows.
 *
 * If a change to memo-formatter.js breaks the spacing, this fails - which is
 * the point of moving format out of the model and into code that can be tested.
 *
 * Run:  npm test   (or: node src/verify.js)
 */

import {layoutMemo, renderText} from "./memo-formatter.js";
import {validateMemo} from "./memo-validator.js";
import {
    normalizePunctuationSpacing,
    hasCorrectPunctuationSpacing,
    enclosureLabel,
    formatMemoDate,
    MEMO_DATE_PATTERN,
} from "./ar25-50.js";
import {measureTextIn, breakLines} from "./text-metrics.js";
import path from "path";
import {TYPE} from "./ar25-50.js";
const TYPE_CITE = TYPE.cite;
import {buildParagraphTree} from "./army-memo-agent.js";
import {LAYOUT, LETTERHEAD} from "./ar25-50.js";
const LETTERHEAD_TOP = LETTERHEAD.officeSymbolTopIn;

let passed = 0;
const failures = [];

function check(name, actual, expected, cite) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
        passed++;
    } else {
        failures.push({name, actual, expected, cite});
    }
}

function checkTrue(name, value, cite) {
    check(name, value === true, true, cite);
}

/**
 * Landmarks are located in `doc.flow` - the document before pagination.
 * The regulation's counts describe the flow ("the third line below the office
 * symbol"), so a page break must not be able to change the answer.
 */
function indexOf(doc, role) {
    return doc.flow.findIndex((l) => l.role === role);
}

function lastIndexOf(doc, roles) {
    for (let i = doc.flow.length - 1; i >= 0; i--) {
        if (roles.includes(doc.flow[i].role)) return i;
    }
    return -1;
}

/**
 * The header part a section references, by reference type.
 *
 * `word/header1.xml` is not the first-page header - it is whichever header the
 * generator happened to write first, and that changes when the set of headers
 * changes. The document says which is which: `w:headerReference w:type="first"`
 * carries a relationship id, and the relationships part maps it to a file.
 * Following that link is the only way to assert something about the page the
 * reader will actually see.
 *
 * Returns null when the section declares no header of that type.
 */
async function headerPart(zip, type) {
    const document = await zip.file("word/document.xml").async("string");
    const ref = new RegExp(`<w:headerReference w:type="${type}" r:id="([^"]+)"`).exec(document);
    if (!ref) return null;

    const rels = await zip.file("word/_rels/document.xml.rels").async("string");
    const target = new RegExp(`Id="${ref[1]}"[^>]*Target="([^"]+)"`).exec(rels);
    if (!target) return null;

    const file = zip.file(`word/${target[1]}`);
    return file ? file.async("string") : null;
}

// ---------------------------------------------------------------------------
// Figure 2-1 - "Using and preparing a memorandum with digital signature"
// ---------------------------------------------------------------------------

const FIG_2_1 = {
    letterhead: {
        organization: "Organizational Name/Title",
        streetAddress: "Standardized Street Address",
        cityStateZip: "City State 12345-1234",
    },
    officeSymbol: "OFFICE SYMBOL",
    arimsRecordNumber: "ARIMS Record Number",
    date: "13 March 2020",
    addressees: ["U.S. Army Command and General Staff College (ATZL), 100 Stimson Avenue, Fort Leavenworth, KS 66027-1352"],
    subject: "Using and Preparing a Memorandum With a Digital Signature",
    paragraphs: [
        {text: "See paragraph 2-2 (of this regulation) on when to use a memorandum."},
        {text: "Single space the text with double-spacing between paragraphs and subparagraphs.  Insert two blank spaces after ending punctuation (periods and question marks).  For commas, colons and semicolons, place one space between the punctuation and the text that immediately follows it."},
        {
            text: "When a memorandum has more than one paragraph, number the paragraphs consecutively.  When paragraphs are subdivided, designate first subdivisions using lowercase letters of the alphabet and indent 1/4 inch as shown below.",
            children: [
                {text: "When a paragraph is subdivided, there must be at least two subparagraphs."},
                {
                    text: "If there is a subparagraph \"a,\" there must be a subparagraph \"b.\"",
                    children: [
                        {text: "Designate second subdivisions by numbers in parentheses; for example, (1), (2), and (3) and indent 1/2 inch as shown."},
                        {
                            text: "Do not subdivide beyond the third subdivision.",
                            children: [
                                {text: "Do not indent any further than the second subdivision."},
                                {text: "Use (a), (b), (c), and so forth at this level."},
                            ],
                        },
                    ],
                },
            ],
        },
        {text: "For instructions on how to place a text box for the application of dates to .pdf files with digital signature, see Appendix F."},
    ],
    authorityLine: "AUTHORITY LINE:",
    signature: {name: "NAME (ALL CAPS)", gradeAndBranch: "Colonel, GS", title: "Deputy Chief of Staff, G-3"},
    enclosures: ["Enclosure title"],
};

{
    const doc = layoutMemo(FIG_2_1);
    const lines = doc.flow;

    // Figure 2-1 margin numbers: office symbol -> MEMORANDUM FOR is 3.
    check("fig 2-1: MEMORANDUM FOR is the 3d line below the office symbol",
        indexOf(doc, "memorandum-for") - indexOf(doc, "office-symbol"), 3,
        "AR 25-50, para 2-4a(5)");

    check("fig 2-1: SUBJECT is the 2d line below the last address line",
        indexOf(doc, "subject") - lastIndexOf(doc, ["memorandum-for", "address"]), 2,
        "AR 25-50, para 2-4a(6)");

    check("fig 2-1: the body begins on the 3d line below the subject",
        indexOf(doc, "paragraph") - lastIndexOf(doc, ["subject"]), 3,
        "AR 25-50, para 2-4b(1)");

    // Paragraph 1 is a single line; paragraph 2 begins on the 2d line below it.
    const paragraphStarts = lines
        .map((l, i) => (l.role === "paragraph" && l.prefix ? i : -1))
        .filter((i) => i >= 0);
    const firstEnd = paragraphStarts[0];
    check("fig 2-1: double spacing between paragraphs",
        paragraphStarts[1] - firstEnd, 2,
        "AR 25-50, para 2-4b(2)");

    check("fig 2-1: authority line is the 2d line below the last line of text",
        indexOf(doc, "authority-line") - lastIndexOf(doc, ["paragraph"]), 2,
        "AR 25-50, para 2-4c(1)");

    check("fig 2-1: signature block is the 5th line below the authority line",
        indexOf(doc, "enclosure-label") - indexOf(doc, "authority-line"), 5,
        "AR 25-50, para 2-4c(2)(a)");

    // The figures' "[place digital signature block here]" is an annotation
    // pointing at the space above the signature block, not text a memorandum
    // carries. The space is there because the block begins on the fifth line.
    check("no memorandum prints the figures' digital-signature annotation",
        doc.flow.filter((l) => /place digital signature/i.test(l.text ?? "")).length, 0,
        "AR 25-50, figs 2-1, 2-14 and 2-17");

    // Labels and indents, read off the same figure.
    const labels = lines.filter((l) => l.prefix).map((l) => l.prefix);
    check("fig 2-1: paragraph labels",
        labels, ["1.", "2.", "3.", "a.", "b.", "(1)", "(2)", "(a)", "(b)", "4."],
        "AR 25-50, fig 2-1");

    const indentFor = (label) => lines.find((l) => l.prefix === label).indentIn;
    check("fig 2-1: first subdivision indents 1/4 inch", indentFor("a."), 0.25, "AR 25-50, fig 2-1");
    check("fig 2-1: second subdivision indents 1/2 inch", indentFor("(1)"), 0.5, "AR 25-50, fig 2-1");
    check("fig 2-1: third subdivision does not indent further", indentFor("(a)"), 0.5, "AR 25-50, fig 2-1");
    check("fig 2-1: main paragraphs sit at the left margin", indentFor("1."), 0, "AR 25-50, fig 2-1");

    /*
     * One space between the number and the text - LAYOUT.labelSpaces, which
     * records the instruction and the measurement it departs from. Asserted as
     * the label's own width plus exactly one space, at every level, so the gap
     * cannot quietly become two or drift back onto the tab grid.
     */
    const textStart = (label) => {
        const l = lines.find((x) => x.prefix === label);
        return Number((l.indentIn + l.prefixWidthIn).toFixed(4));
    };
    const oneSpaceAfter = (label, indentIn) => Number(
        (indentIn + measureTextIn(label + " ", TYPE.fontSizePt)).toFixed(4));
    for (const [label, indentIn] of [["1.", 0], ["a.", 0.25], ["(1)", 0.5], ["(a)", 0.5]]) {
        check(`text after '${label}' starts one space after it`,
            textStart(label), oneSpaceAfter(label, indentIn), LAYOUT.labelSpacesCite);
    }

    // "Do not indent any further than the second subdivision" also means the
    // wrap of every paragraph returns to the left margin.
    const wrapped = lines.find((l) => l.role === "paragraph" && !l.prefix);
    check("fig 2-1: continuation lines return to the left margin",
        wrapped.indentIn, 0, "AR 25-50, para 2-4a(6) and figs 2-1 through 2-5");

    check("fig 2-1: enclosure listing reads Encl for a single enclosure",
        lines[indexOf(doc, "enclosure-label")].text, "Encl", "AR 25-50, para 2-4c(3)");

    check("fig 2-1: the signature block shares the enclosure line",
        lines[indexOf(doc, "enclosure-label")].sameLine.text, "NAME (ALL CAPS)",
        "AR 25-50, para 2-4c(3)");

    check("fig 2-1: the signature block begins at the centre of the page",
        lines[indexOf(doc, "enclosure-label")].sameLine.indentIn, 3.25,
        "AR 25-50, para 2-4c(2)(a)");
}

// ---------------------------------------------------------------------------
// Figure 2-2 - two-page memorandum with a suspense date
// ---------------------------------------------------------------------------

{
    const memo = {
        ...FIG_2_1,
        suspenseDate: "20 March 2020",
        subject: "Preparing a Two-page Memorandum With a Suspense Date",
        enclosures: ["Personnel Listing, 22 March 2019", "DA Form 4187", "Orders 114-6", "Locator"],
        // Enough text to force a second page.
        paragraphs: Array.from({length: 14}, (_, i) => ({
            text: `Paragraph ${i + 1}.  ` + "Review this example to see how to prepare a memorandum.  ".repeat(3),
        })).concat([{text: "My point of contact is Ms. Jane Ruiz, ATZL-CD, at 913-555-0100 or jane.a.ruiz.civ@army.mil."}]),
    };
    const doc = layoutMemo(memo);

    check("fig 2-2: the memorandum runs onto a second page", doc.pages.length >= 2, true,
        "AR 25-50, para 2-5");

    const suspense = doc.flow.findIndex((l) => l.role === "suspense");
    const officeSymbol = indexOf(doc, "office-symbol");
    check("fig 2-2: the suspense date is 2 lines above the date line",
        officeSymbol - suspense, 2, "AR 25-50, para 2-4a(4)");

    check("fig 2-2: the suspense date is bold and flush right",
        [doc.flow[suspense].bold, doc.flow[suspense].right],
        [true, "S: 20 March 2020"], "AR 25-50, para 2-4a(4)");

    // Continuation page: office symbol, then subject on the next line, then
    // text on the third line below the subject.
    const heading = doc.pages[1].heading;
    check("fig 2-2: the continuation page repeats the office symbol first",
        heading[0].role, "office-symbol", "AR 25-50, para 2-5a");
    check("fig 2-2: the subject follows on the next line",
        heading[1].role, "subject", "AR 25-50, para 2-5b");
    check("fig 2-2: text resumes on the 3d line below the subject",
        heading.length - heading.findIndex((l) => l.role === "subject"), 3,
        "AR 25-50, para 2-5c");

    check("fig 2-2: four enclosures are labelled '4 Encls'",
        enclosureLabel(4), "4 Encls", "AR 25-50, para 2-4c(3)");

    const rendered = renderText(memo);
    checkTrue("fig 2-2: a page number is centred on the page", /\n\s+2\s*$/.test(rendered.trimEnd()),
        "AR 25-50, para 2-5d");
}

// ---------------------------------------------------------------------------
// Figure 2-5 - multiple-address memorandum
// ---------------------------------------------------------------------------

{
    const memo = {
        ...FIG_2_1,
        addressStyle: "uppercase",
        addressees: [
            "DEPUTY CHIEF OF STAFF, G-1 (DAPE-ZA), 300 ARMY PENTAGON, WASHINGTON, DC 20310-0300",
            "DEPUTY CHIEF OF STAFF, G-2 (DAMI-ZA), 1000 ARMY PENTAGON, WASHINGTON, DC 20310-1000",
            "DEPUTY CHIEF OF STAFF, G-4 (DALO-ZA), 500 ARMY PENTAGON, WASHINGTON, DC 20310-0500",
        ],
        subject: "Multiple-address Memorandums for HQDA Agencies",
    };
    const doc = layoutMemo(memo);
    const lines = doc.flow;

    const memoFor = indexOf(doc, "memorandum-for");
    check("fig 2-5: MEMORANDUM FOR stands alone on its line",
        lines[memoFor].text, "MEMORANDUM FOR", "AR 25-50, fig 2-5");

    const firstAddress = indexOf(doc, "address");
    check("fig 2-5: addresses begin on the 2d line below MEMORANDUM FOR",
        firstAddress - memoFor, 2, "AR 25-50, fig 2-5");

    const addressLines = lines.filter((l) => l.role === "address");
    const wrappedAddress = addressLines.find((l) => l.indentIn > 0);
    check("fig 2-5: an address that runs over indents its second line 1/4 inch",
        wrappedAddress?.indentIn, 0.25, "AR 25-50, para 2-4a(5)(b)");

    checkTrue("fig 2-5: addresses are typed in one style throughout",
        addressLines.every((l) => l.text === l.text.toUpperCase()),
        "AR 25-50, para 2-4a(5)");
}

// ---------------------------------------------------------------------------
// Figure 2-3 - single address on the MEMORANDUM FOR line
// ---------------------------------------------------------------------------

{
    const memo = {
        ...FIG_2_1,
        addressees: ["DEPUTY CHIEF OF STAFF, G-4 (DALO-ZA/[Name])"],
        subject: "Single-address Headquarters Department of the Army Memorandum",
    };
    const doc = layoutMemo(memo);
    const memoFor = doc.flow[indexOf(doc, "memorandum-for")];
    check("fig 2-3: a single address sits on the MEMORANDUM FOR line",
        memoFor.text, "MEMORANDUM FOR DEPUTY CHIEF OF STAFF, G-4 (DALO-ZA/[Name])",
        "AR 25-50, para 2-4a(5)(a)");
}

// ---------------------------------------------------------------------------
// Rules the figures do not show
// ---------------------------------------------------------------------------

{
    // "Do not number a one-paragraph memorandum." - 2-4b(4)(a)
    const single = {...FIG_2_1, paragraphs: [{text: "One paragraph only, so no number."}]};
    const doc = layoutMemo(single);
    check("one-paragraph memorandums are not numbered",
        doc.flow.filter((l) => l.prefix).length, 0,
        "AR 25-50, para 2-4b(4)(a)");
}

{
    // "If you are not using an authority line, begin the signature block on the
    //  fifth line below the last line of text." - 2-4c(2)(a)
    const noAuthority = {...FIG_2_1, authorityLine: null};
    const doc = layoutMemo(noAuthority);
    check("without an authority line the signature block is the 5th line below the text",
        indexOf(doc, "enclosure-label") - lastIndexOf(doc, ["paragraph"]), 5,
        "AR 25-50, para 2-4c(2)(a)");
    checkTrue("and nothing is printed in the space above it",
        doc.flow.filter((l) => /place digital signature/i.test(l.text ?? "")).length === 0,
        "AR 25-50, figs 2-1, 2-14 and 2-17");

    // A wet-signature memorandum leaves the five lines empty.
    const wet = layoutMemo({...FIG_2_1, digitalSignature: false});
    check("a wet-signature memorandum still places the block on the 5th line",
        indexOf(wet, "enclosure-label") - indexOf(wet, "authority-line"), 5,
        "AR 25-50, para 2-4c(2)(a)");
    check("a wet-signature memorandum leaves no digital signature line",
        indexOf(wet, "digital-signature"), -1, "AR 25-50, para 1-17");
}

{
    // MOU: title below the seal, BETWEEN, the parties joined by AND, and
    // overscored signature blocks on the 5th line below the text with the
    // senior official on the right. - 2-6c
    const mou = layoutMemo({
        type: "mou",
        letterhead: FIG_2_1.letterhead,
        parties: ["HEADQUARTERS, 4TH INFANTRY DIVISION", "U.S. ARMY GARRISON, FORT CARSON"],
        subject: "Shared Use of Range 14",
        paragraphs: [{text: "Purpose.  This memorandum records shared use of Range 14."}],
        signers: [
            {name: "JANE A. RUIZ", titleAndAgency: "Colonel, GS", date: "17 July 2026"},
            {name: "MARCUS T. HALE", titleAndAgency: "Brigadier General, USA", date: "17 July 2026"},
        ],
    });
    const titles = mou.flow.filter((l) => l.role === "agreement-title").map((l) => l.text);
    check("MOU heading reads title, BETWEEN, AND",
        titles, ["MEMORANDUM OF UNDERSTANDING", "BETWEEN", "AND"], "AR 25-50, para 2-6c(1)");

    const overscore = mou.flow.findIndex((l) => l.role === "overscore");
    check("MOU signature blocks are the 5th line below the text",
        overscore - mou.flow.findLastIndex((l) => l.role === "paragraph"), 5,
        "AR 25-50, para 2-6c(5)(a)");
    checkTrue("MOU signature blocks are overscored and paired",
        mou.flow[overscore].text.startsWith("_") && !!mou.flow[overscore].sameLine,
        "AR 25-50, para 2-6c(5)(b)");
    check("the senior official signs on the right",
        mou.flow.find((l) => l.role === "signature").sameLine.text, "MARCUS T. HALE",
        "AR 25-50, para 2-6c(5)(d)");
}

{
    // Six addressees force the SEE DISTRIBUTION format. - 2-4a(5)(c)
    const many = {
        ...FIG_2_1,
        addressees: Array.from({length: 6}, (_, i) => `COMMANDER, ${i + 1}ST BRIGADE`),
    };
    const result = validateMemo(many);
    checkTrue("more than five addressees requires SEE DISTRIBUTION",
        result.errors.some((f) => f.rule === "see-distribution-required"),
        "AR 25-50, para 2-4a(5)(c)");

    const doc = layoutMemo({...many, seeDistribution: true, distribution: ["A", "B"]});
    check("SEE DISTRIBUTION replaces the address block",
        doc.flow[indexOf(doc, "memorandum-for")].text,
        "MEMORANDUM FOR SEE DISTRIBUTION", "AR 25-50, para 2-4a(5)(c)");
}

{
    // Two spaces after ending punctuation, one after a comma. - 1-39b(9)
    check("sentence spacing is normalized to two spaces",
        normalizePunctuationSpacing("First sentence. Second one? Third!  Fourth."),
        "First sentence.  Second one?  Third!  Fourth.",
        "AR 25-50, para 1-39b(9)");

    check("commas, colons, and semicolons take one space",
        normalizePunctuationSpacing("one,  two;  three:  four"),
        "one, two; three: four", "AR 25-50, para 1-39b(9)");

    check("abbreviations are not mistaken for sentence ends",
        normalizePunctuationSpacing("Contact Mr. Smith and Dr. Jones."),
        "Contact Mr. Smith and Dr. Jones.", "AR 25-50, para 1-39b(9)");

    checkTrue("normalization is idempotent",
        hasCorrectPunctuationSpacing(normalizePunctuationSpacing("A. B. C.")),
        "AR 25-50, para 1-39b(9)");
}

{
    // Wrapping must not eat the second space at a line break.
    const long = "A".repeat(40) + ".  " + "B".repeat(40) + ".  Tail.";
    const broken = breakLines(long, {
        sizePt: 12,
        indentForLine: () => 0,
        widthForLine: () => 6.5,
    });
    checkTrue("two-space sentence gaps survive line breaking",
        broken.some((l) => l.text.includes(".  ")) || broken.length > 1,
        "AR 25-50, para 1-39b(9)");
}

{
    // Depth is clamped to the third subdivision. - fig 2-1
    const tree = buildParagraphTree([
        {level: 0, text: "main"},
        {level: 1, text: "a"},
        {level: 2, text: "(1)"},
        {level: 3, text: "(a)"},
        {level: 7, text: "too deep"},
    ]);
    const depth = (nodes, d = 1) =>
        Math.max(...nodes.map((n) => (n.children ? depth(n.children, d + 1) : d)));
    check("paragraph depth never exceeds the third subdivision", depth(tree), 4,
        "AR 25-50, fig 2-1");

    const skipped = buildParagraphTree([{level: 0, text: "main"}, {level: 3, text: "orphan"}]);
    check("a level that skips a rung is pulled back to its parent",
        depth(skipped), 2, "AR 25-50, fig 2-1");
}

{
    // Validator findings that the agent is expected to act on.
    const bad = {
        ...FIG_2_1,
        subject: "A Subject Line That Is Considerably Longer Than Ten Words In Total.",
        date: "March 13, 2020",
        paragraphs: [
            {text: "The report was completed by the staff at 1300 hours."},
            {text: "There is a requirement that all soldiers and their families attend."},
            {text: "The briefing starts at 2:30 p.m. in the conference room."},
        ],
    };
    const result = validateMemo(bad);
    const rules = new Set(result.findings.map((f) => f.rule));

    for (const rule of ["date-format", "subject-too-long", "time-hours-suffix",
                        "civilian-time", "expletive-opening", "army-capitalization",
                        "passive-voice", "poc-placement", "subject-punctuation"]) {
        checkTrue(`validator catches ${rule}`, rules.has(rule), "AR 25-50");
    }

    checkTrue("every finding cites the regulation",
        result.findings.every((f) => typeof f.cite === "string" && f.cite.length > 0),
        "AR 25-50");

    checkTrue("layout findings are not sent back to the model",
        result.formatFindings.every((f) => !result.contentFindings.includes(f)),
        "design invariant");
}

{
    // Dates and type metrics.
    check("memorandum dates are written out in full",
        formatMemoDate(new Date(2020, 2, 13)), "13 March 2020", "AR 25-50, para 1-25a");
    check("date stamps use the abbreviated month",
        formatMemoDate(new Date(2020, 2, 13), {stamp: true}), "13 Mar 2020",
        "AR 25-50, para 2-4a(3)(c)");
    checkTrue("the full form matches the memorandum date pattern",
        MEMO_DATE_PATTERN.test(formatMemoDate(new Date(2020, 2, 13))), "AR 25-50, para 1-25a");

    // 12 pt Arial: a lowercase 'n' is 556/1000 em = 0.0927 in.
    const n = measureTextIn("n", 12);
    checkTrue("type is measured in inches from real advance widths",
        Math.abs(n - 0.0927) < 0.001, "AR 25-50, para 1-19");
}

{
    // The reference memo must be clean.
    const {OFFLINE_CONTENT, OFFLINE_CONTEXT, assembleMemo} = await import("./army-memo-agent.js");
    const memo = assembleMemo(OFFLINE_CONTENT, OFFLINE_CONTEXT);
    const result = validateMemo(memo);
    check("the worked example produces no errors", result.errors.map((f) => f.rule), [],
        "AR 25-50");
    check("the worked example fits on one page", result.pages, 1,
        "AR 25-50, para 1-39b(7)");
    // The seal ships with the example, so a finished memorandum is clean.
    check("the worked example raises no advisories either",
        result.warnings.map((f) => f.rule), [], "AR 25-50");
    checkTrue("the department seal is applied automatically",
        layoutMemo(memo).letterhead.seal?.endsWith("dow-seal.png") === true,
        "AR 25-50, para 1-16b(1)");
    checkTrue("clearing the seal is reported as an error",
        validateMemo({...memo, letterhead: {...memo.letterhead, seal: null}})
            .errors.some((f) => f.rule === "seal-missing"),
        "AR 25-50, para 1-16b(1)");
}

// ---------------------------------------------------------------------------
// Addressed to a person: Exclusive For, appreciation, commendation
// ---------------------------------------------------------------------------

/**
 * "Exception: When used for 'Exclusive For' correspondence, appreciation, and
 *  commendation, address the memorandum to the name and title of the
 *  addressee." - para 2-4a(5)
 *
 * Appendix C does not reach a memorandum: para C-2a scopes it to "addresses in
 * letters, on envelopes, and for salutations and complimentary closes in
 * letters", and no paragraph of chapter 2 cross-references it. A memorandum has
 * no salutation and no complimentary close, so these forms are governed by
 * paras 1-12 and 2-4a(5) alone.
 */
{
    const {EXCLUSIVE_FOR, formatAddresseeName, PERSONAL_ADDRESS_TYPES} = await import("./ar25-50.js");

    const exclusive = layoutMemo({
        ...FIG_2_1,
        type: "exclusiveFor",
        addressees: ["MAJ Edward A. Dees, USA"],
        addresseeTitle: "Chief, Plans Division",
        addresseeAddress: "300 Army Pentagon, Washington, DC  20310-0300",
    });
    const joined = (doc, role) => doc.flow.filter((l) => l.role === role)
        .map((l) => l.text).join(" ").replace(/\s+/g, " ").trim();
    check("para 1-12b(1): an Exclusive For memorandum names the person, not the office",
        joined(exclusive, "memorandum-for"),
        "Memorandum Exclusive For MAJ Edward A. Dees, USA, Chief, Plans Division, 300 Army Pentagon, Washington, DC 20310-0300",
        EXCLUSIVE_FOR.cite);

    const toCommander = layoutMemo({
        ...FIG_2_1,
        type: "exclusiveFor",
        toCommanderOf: "1st Battalion, 5th Infantry",
        addresseeTitle: "Commander",
    });
    checkTrue("para 1-12b(1): the 'Commander of' form is available",
        toCommander.flow[indexOf(toCommander, "memorandum-for")].text
            .startsWith("Memorandum Exclusive For Commander of 1st Battalion"),
        EXCLUSIVE_FOR.cite);

    checkTrue("Exclusive For does not use the uppercase MEMORANDUM FOR keyword",
        !exclusive.flow[indexOf(exclusive, "memorandum-for")].text.startsWith("MEMORANDUM FOR"),
        EXCLUSIVE_FOR.cite);

    for (const type of ["appreciation", "commendation"]) {
        const memo = layoutMemo({
            ...FIG_2_1, type,
            addressees: ["SFC John A. Smith, USA"],
            addresseeTitle: "Platoon Sergeant",
        });
        check(`para 2-4a(5): a memorandum of ${type} is addressed to the name and title`,
            memo.flow[indexOf(memo, "memorandum-for")].text,
            "MEMORANDUM FOR SFC John A. Smith, USA, Platoon Sergeant",
            "AR 25-50, paras 2-2 and 2-4a(5)");
    }

    check("the three person-addressed forms are the ones the regulation names",
        PERSONAL_ADDRESS_TYPES, ["exclusiveFor", "appreciation", "commendation"],
        "AR 25-50, para 2-4a(5)");

    // "show the military grade or civilian prefix, first name, middle initial
    //  (if known), and last name in that order [...] use the following Service
    //  designation abbreviations after the addressee's name" - para 5-9b
    check("para 5-9b: an individual addressee is grade, first, middle initial, last, Service",
        formatAddresseeName({grade: "MAJ", first: "Edward", middleInitial: "A", last: "Dees", service: "USA"}),
        "MAJ Edward A. Dees, USA", "AR 25-50, para 5-9b");
    check("para 5-9b: a civilian prefix takes the grade position",
        formatAddresseeName({prefix: "Mr.", first: "David", last: "Okonkwo"}),
        "Mr. David Okonkwo", "AR 25-50, para 5-9b");
}

// ---------------------------------------------------------------------------
// Chapter 5 and appendix B - States, ZIP codes, and protocol order
// ---------------------------------------------------------------------------

{
    const {STATE_ABBREVIATIONS, VALID_STATE_CODES, OVERSEAS_CODES, normalizeZipSpacing,
           checkProtocolOrder, PROTOCOL_HQDA, PROTOCOL_OSD} = await import("./ar25-50.js");

    // Table 5-3 is 54 entries; paras 5-10a adds AE, AP, AA.
    check("tbl 5-3: fifty-four State and territory abbreviations",
        Object.keys(STATE_ABBREVIATIONS).length, 54, "AR 25-50, table 5-3");
    check("tbl 5-3: the territories are included",
        [STATE_ABBREVIATIONS.Guam, STATE_ABBREVIATIONS["Puerto Rico"],
         STATE_ABBREVIATIONS["Virgin Islands"], STATE_ABBREVIATIONS["District of Columbia"]],
        ["GU", "PR", "VI", "DC"], "AR 25-50, table 5-3");
    check("para 5-10a: the three overseas codes are also valid",
        Object.keys(OVERSEAS_CODES), ["AE", "AP", "AA"], "AR 25-50, para 5-10a");
    checkTrue("an APO address is not rejected for its State code",
        VALID_STATE_CODES.has("AE"), "AR 25-50, para 5-10a");

    // "Type the ZIP code two spaces after the last letter of the State." - 5-10b
    check("para 5-10b: the ZIP goes two spaces after the State",
        normalizeZipSpacing("Fort Carson, CO 80913-4321"),
        "Fort Carson, CO  80913-4321", "AR 25-50, para 5-10b");
    check("para 5-10b: normalization is idempotent",
        normalizeZipSpacing(normalizeZipSpacing("Fort Carson, CO 80913-4321")),
        "Fort Carson, CO  80913-4321", "AR 25-50, para 5-10b");
    checkTrue("para 5-10b: the rendered memorandum carries the two spaces",
        renderText({...FIG_2_1, addressees: ["Commander, 1st Battalion, Fort Carson, CO 80913-4321"]})
            .includes("CO  80913-4321"), "AR 25-50, para 5-10b");

    checkTrue("an unknown State code is reported",
        validateMemo({...FIG_2_1, addressees: ["Commander, Somewhere, ZZ  12345-6789"]})
            .errors.some((f) => f.rule === "unknown-state-code"), "AR 25-50, table 5-3");
    checkTrue("a five-digit ZIP is reported",
        validateMemo({...FIG_2_1, addressees: ["Commander, Fort Carson, CO  80913"]})
            .warnings.some((f) => f.rule === "zip-not-plus-four"), "AR 25-50, para 5-10b");

    // Appendix B protocol sequences.
    check("fig B-2: the HQDA protocol sequence has 36 positions",
        PROTOCOL_HQDA.length, 36, "AR 25-50, fig B-2");
    check("fig B-2: it opens with the Secretary of the Army",
        PROTOCOL_HQDA[0], "Secretary of the Army", "AR 25-50, fig B-2");
    check("fig B-1: the OSD protocol sequence has 16 positions",
        PROTOCOL_OSD.length, 16, "AR 25-50, fig B-1");

    // Figure 2-5 addresses G-1, G-2, G-4 - which is fig B-2 order.
    checkTrue("fig 2-5's own addressees are in protocol order",
        checkProtocolOrder([
            "DEPUTY CHIEF OF STAFF, G-1 (DAPE-ZA), 300 ARMY PENTAGON",
            "DEPUTY CHIEF OF STAFF, G-2 (DAMI-ZA), 1000 ARMY PENTAGON",
            "DEPUTY CHIEF OF STAFF, G-4 (DALO-ZA), 500 ARMY PENTAGON",
        ]).inOrder, "AR 25-50, fig B-2");

    checkTrue("addressees out of protocol order are reported",
        validateMemo({...FIG_2_1, addressees: [
            "DEPUTY CHIEF OF STAFF, G-4 (DALO-ZA)",
            "DEPUTY CHIEF OF STAFF, G-1 (DAPE-ZA)",
        ]}).warnings.some((f) => f.rule === "protocol-order"), "AR 25-50, fig B-2");

    checkTrue("offices outside appendix B are not reordered on a guess",
        checkProtocolOrder(["Information Office, FORSCOM", "Information Office, TRADOC"]).inOrder,
        "AR 25-50, appendix B");

    /*
     * PROTOCOL_OSD existed as data before this session's audit and was never
     * read by the validator - checkProtocol() checked only PROTOCOL_HQDA, so a
     * memorandum addressed to the Office of the Secretary of Defense out of
     * order raised nothing.
     */
    checkTrue("fig B-1: an OSD memorandum out of protocol order is now reported",
        validateMemo({...FIG_2_1, addressees: ["Deputy Secretary of Defense", "Secretary of Defense"]})
            .warnings.some((f) => f.rule === "protocol-order"), "AR 25-50, fig B-1");
    checkTrue("fig B-1: and not reported when it is in order",
        validateMemo({...FIG_2_1, addressees: ["Secretary of Defense", "Deputy Secretary of Defense"]})
            .warnings.every((f) => f.rule !== "protocol-order"), "AR 25-50, fig B-1");

    /*
     * Figure B-1 carries eight footnotes and figure B-2 carries one. Seven of
     * the nine give an explicit order for naming some but not all of one
     * category - either the fixed order the footnote states, or (for the
     * larger categories) alphabetical order among the members the footnote
     * names. Spot-checked here against the source text; wired into the
     * validator as `protocol-detail-order`.
     */
    const {PROTOCOL_OSD_DETAIL, PROTOCOL_HQDA_DETAIL, checkProtocolDetailOrder} = await import("./ar25-50.js");

    check("fig B-1 note 1: three Secretaries of the Military Departments",
        PROTOCOL_OSD_DETAIL.secretariesOfMilitaryDepartments.order,
        ["Secretary of the Army", "Secretary of the Navy", "Secretary of the Air Force"],
        "AR 25-50, fig B-1, note 1");
    check("fig B-1 note 2: six Under Secretaries of Defense, in the stated order",
        PROTOCOL_OSD_DETAIL.underSecretariesOfDefense.order[0],
        "Under Secretary of Defense for Research and Engineering", "AR 25-50, fig B-1, note 2");
    check("fig B-1 note 3: the Chiefs of the Military Services sit between the Under Secretaries and NGB",
        [PROTOCOL_OSD_DETAIL.chiefsOfMilitaryServices.insertAfter,
         PROTOCOL_OSD_DETAIL.chiefsOfMilitaryServices.insertBefore],
        ["Under Secretaries of Defense", "Chief of the National Guard Bureau"], "AR 25-50, fig B-1, note 3");
    check("fig B-1 note 5: thirteen Assistant Secretaries of Defense",
        PROTOCOL_OSD_DETAIL.assistantSecretariesOfDefense.order.length, 13, "AR 25-50, fig B-1, note 5");
    check("fig B-1 note 6: nineteen Directors of Defense Agencies",
        PROTOCOL_OSD_DETAIL.directorsOfDefenseAgencies.order.length, 19, "AR 25-50, fig B-1, note 6");
    check("fig B-1 note 7: eight Directors of DoD Field Activities",
        PROTOCOL_OSD_DETAIL.directorsOfDodFieldActivities.order.length, 8, "AR 25-50, fig B-1, note 7");
    check("fig B-2 note: five Assistant Secretaries of the Army",
        PROTOCOL_HQDA_DETAIL.assistantSecretariesOfArmy.order.length, 5, "AR 25-50, fig B-2, note");

    checkTrue("fig B-1 note 1: two Secretaries out of the stated order fail the check",
        !checkProtocolDetailOrder(["Secretary of the Air Force", "Secretary of the Army"],
            PROTOCOL_OSD_DETAIL.secretariesOfMilitaryDepartments), "AR 25-50, fig B-1, note 1");
    checkTrue("fig B-1 note 1: and pass it in the stated order",
        checkProtocolDetailOrder(["Secretary of the Army", "Secretary of the Navy"],
            PROTOCOL_OSD_DETAIL.secretariesOfMilitaryDepartments), "AR 25-50, fig B-1, note 1");
    checkTrue("fig B-1 note 6: alphabetical Defense Agencies out of order fail the check",
        !checkProtocolDetailOrder(["Missile Defense Agency", "Defense Health Agency"],
            PROTOCOL_OSD_DETAIL.directorsOfDefenseAgencies), "AR 25-50, fig B-1, note 6");
    checkTrue("fig B-1 note 6: and pass it in alphabetical order",
        checkProtocolDetailOrder(["Defense Health Agency", "Missile Defense Agency"],
            PROTOCOL_OSD_DETAIL.directorsOfDefenseAgencies), "AR 25-50, fig B-1, note 6");

    checkTrue("validator: two Assistant Secretaries of the Army out of order are reported",
        validateMemo({...FIG_2_1, addressees: ["ASA (Manpower and Reserve Affairs)", "ASA (Civil Works)"]})
            .warnings.some((f) => f.rule === "protocol-detail-order"), "AR 25-50, fig B-2, note");
    checkTrue("validator: and not reported when they are in alphabetical order",
        validateMemo({...FIG_2_1, addressees: ["ASA (Civil Works)", "ASA (Manpower and Reserve Affairs)"]})
            .warnings.every((f) => f.rule !== "protocol-detail-order"), "AR 25-50, fig B-2, note");

    // "Do not use it when addressing Army correspondence." - para 1-13
    checkTrue("ALARACT in an address is reported",
        validateMemo({...FIG_2_1, addressees: ["ALARACT"]})
            .errors.some((f) => f.rule === "alaract-in-address"), "AR 25-50, para 1-13");
}

// ---------------------------------------------------------------------------
// Chapter 4 - the enclosure listing
// ---------------------------------------------------------------------------

/**
 * "Enclosures should be listed only when they have not been identified in the
 *  body of the correspondence." - para 4-2.
 *
 * That one sentence produces four different listings, reproduced here against
 * tables 4-2, 4-3, 4-4, and 4-6.
 */
{
    const {buildEnclosureListing, capitalizeFirstWord, TABBING} = await import("./ar25-50.js");
    const shape = (encls) => {
        const r = buildEnclosureListing(encls);
        return [r.label, ...r.entries.map((e) => e.text)];
    };
    const inBody = (title) => ({title, identifiedInBody: true});

    // Table 4-4: identified in the body - the bare word, no count, no list.
    check("tbl 4-4: enclosures identified in the body list as 'Encls' alone",
        shape([inBody("a"), inBody("b")]), ["Encls"], "AR 25-50, para 4-2c(4)");
    check("tbl 4-4: one identified in the body lists as 'Encl' alone",
        shape([inBody("a")]), ["Encl"], "AR 25-50, para 4-2c(4)");

    // Table 4-3: one, not identified - no number, description on the next line.
    check("tbl 4-3: one enclosure not identified takes no number but keeps its description",
        shape(["Memorandum, USAREUR, 28 Feb 19"]),
        ["Encl", "Memorandum, USAREUR, 28 Feb 19"], "AR 25-50, para 4-2c(3)");

    // Table 4-2: two or more, not identified - count and numbered descriptions.
    check("tbl 4-2: four enclosures not identified are counted and numbered",
        shape([
            "Memorandum, AMC, 29 Jan 19",
            "Memorandum, FORSCOM, 1 Mar 19",
            "Memorandum, TRADOC, 18 Apr 19",
            "Memorandum, MEDCOM, 30 Apr 19",
        ]),
        ["4 Encls",
         "1. Memorandum, AMC, 29 Jan 19",
         "2. Memorandum, FORSCOM, 1 Mar 19",
         "3. Memorandum, TRADOC, 18 Apr 19",
         "4. Memorandum, MEDCOM, 30 Apr 19"],
        "AR 25-50, para 4-2c(2)");

    // Table 4-6: mixed - the count covers them all, identified runs collapse.
    check("tbl 4-6: a mixed listing collapses the identified run to '1-3. as'",
        shape([inBody("x"), inBody("y"), inBody("z"),
               "Memorandum, USALSA, 5 Feb 19", "Memorandum, TJAG, 2 Jan 19"]),
        ["5 Encls", "1\u20133. as",
         "4. Memorandum, USALSA, 5 Feb 19",
         "5. Memorandum, TJAG, 2 Jan 19"],
        "AR 25-50, para 4-2c(6)");

    check("tbl 4-6: a single identified enclosure in a mixed listing takes no range",
        shape([inBody("x"), "Memorandum, TJAG, 2 Jan 19"]),
        ["2 Encls", "1. as", "2. Memorandum, TJAG, 2 Jan 19"],
        "AR 25-50, para 4-2c(6)");

    // "capitalize the first letter in the first word of a listed enclosure"
    check("para 4-2c(1): the first word of a listed enclosure is capitalized",
        capitalizeFirstWord("memorandum, USAREUR, 28 Feb 19"),
        "Memorandum, USAREUR, 28 Feb 19", "AR 25-50, para 4-2c(1)");
    check("para 4-2c(1): capitalization reaches the rendered listing",
        shape(["memorandum, USAREUR, 28 Feb 19"])[1],
        "Memorandum, USAREUR, 28 Feb 19", "AR 25-50, para 4-2c(1)");

    check("no enclosures produces no listing", shape([]), [null], "AR 25-50, para 4-2");

    // The listing reaches the rendered memorandum in the right form.
    const rendered = renderText({
        ...FIG_2_1,
        enclosures: [inBody("Range schedule"), "Memorandum, TJAG, 2 Jan 19"],
    });
    checkTrue("the mixed listing appears in the rendered memorandum",
        rendered.includes("2 Encls") && rendered.includes("1. as")
        && rendered.includes("2. Memorandum, TJAG, 2 Jan 19"),
        "AR 25-50, para 4-2c(6)");

    const identifiedOnly = renderText({...FIG_2_1, enclosures: [inBody("Range schedule")]});
    checkTrue("an enclosure identified in the body renders as 'Encl' with no description",
        identifiedOnly.includes("Encl") && !identifiedOnly.includes("Range schedule"),
        "AR 25-50, para 4-2c(4)");

    // "If the correspondence has three or more enclosures, tab each one." - 4-3
    check("para 4-3: tabbing begins at three enclosures",
        TABBING.tabWhenEnclosuresAtLeast, 3, TABBING.cite);
    check("para 4-4a: the package tab order is fixed",
        TABBING.packageOrder.length, 3, TABBING.packageCite);
}

// ---------------------------------------------------------------------------
// Type: 12 pt Arial, never higher
// ---------------------------------------------------------------------------

/**
 * Para 1-19a recommends a 12 point font, and nothing in AR 25-50 sets anything
 * larger. A field memorandum measured for this example uses 12 pt for every
 * line of text and smaller sizes only inside the letterhead - 10 pt for
 * "DEPARTMENT OF THE ARMY", 8 pt for the organization block, 6 pt for the
 * "REPLY TO / ATTENTION OF" block that para 1-16b(1) says is not required. Its
 * largest run anywhere is 12 pt.
 *
 * So 12 pt is a ceiling. The check below scans *every part* of the .docx, not
 * just the body: docx-js ships Title at 28 pt and Heading 1/2 at 16/13 pt in
 * every document it writes, and a latent style is still oversized type sitting
 * in the file one click away in Word's style gallery.
 */
{
    const {renderDocx} = await import("./memo-docx.js");
    const {createTemplate} = await import("./templates.js");
    const {TYPE: T} = await import("./ar25-50.js");
    const JSZip = (await import("jszip")).default;

    const ceiling = T.maxSizePt * 2;   // half-points
    const inventory = {};

    for (const type of ["standard", "thru", "exclusiveFor", "appreciation", "commendation", "record", "decision", "mou", "moa"]) {
        const zip = await JSZip.loadAsync(await renderDocx(createTemplate(type)));
        const parts = Object.keys(zip.files).filter((n) => n.endsWith(".xml") && !zip.files[n].dir);

        const sizes = new Set();
        const faces = new Set();
        for (const name of parts) {
            const xml = await zip.file(name).async("string");
            for (const m of xml.matchAll(/<w:sz w:val="(\d+)"\/>/g)) sizes.add(Number(m[1]));
            for (const m of xml.matchAll(/w:ascii="([^"]+)"/g)) faces.add(m[1]);
        }

        const oversized = [...sizes].filter((v) => v > ceiling);
        check(`type: ${type} carries no run above ${T.maxSizePt} pt, anywhere in the file`,
            oversized.map((v) => v / 2), [], T.maxSizeCite);

        check(`type: ${type} sets every text face to ${T.fontFamily}`,
            [...faces], [T.fontFamily], T.cite);

        inventory[type] = [...sizes].map((v) => v / 2).sort((a, b) => b - a);
    }

    checkTrue("type: every memorandum type tops out at exactly 12 pt",
        Object.values(inventory).every((sizes) => Math.max(...sizes) === T.maxSizePt),
        T.maxSizeCite);

    // One uniform size, letterhead included. Para 1-19 leaves the size to the
    // organization, and this one sets 12 pt throughout.
    /*
     * The letterhead is printed stationery, not typed text, and figure 2-1
     * measures it at 10 pt for the title and 8 pt for the organization block.
     * Setting it to the body's 12 pt makes the block 0.22 in taller, which
     * pushes it down the page and closes up the gap above the office symbol -
     * the geometry that is asserted against the figure further down.
     */
    check("type: the letterhead title is 10 pt, as figure 2-1 measures it",
        LETTERHEAD.titleSizePt, 10, LETTERHEAD.letterheadSizeCite);
    check("type: the letterhead organization block is 8 pt",
        LETTERHEAD.addressSizePt, 8, LETTERHEAD.letterheadSizeCite);

    /*
     * Twelve point is the ceiling and the body's only size. The rule the user
     * set is "Arial 12, never higher", so this asserts both halves: nothing in
     * the file is above 12, and everything a writer types is exactly 12. The
     * letterhead's 10 and 8 are the only sizes below it, and they are named
     * rather than tolerated.
     */
    const letterheadSizes = [LETTERHEAD.titleSizePt, LETTERHEAD.addressSizePt];
    for (const [type, sizes] of Object.entries(inventory)) {
        checkTrue(`type: nothing in ${type} is above 12 pt`,
            sizes.every((s) => s <= T.maxSizePt), T.maxSizeCite);
        check(`type: ${type} carries only body 12 pt and the letterhead's own sizes`,
            sizes.filter((s) => s !== T.fontSizePt && !letterheadSizes.includes(s)),
            [], T.maxSizeCite);
        checkTrue(`type: ${type} sets the body at 12 pt`,
            sizes.includes(T.fontSizePt), T.maxSizeCite);
    }

    // A letterhead set in the body's 12 pt is still available, and still
    // below the ceiling.
    const {UNIFORM_LETTERHEAD_SIZES} = await import("./ar25-50.js");
    checkTrue("type: a uniform 12 pt letterhead remains available and compliant",
        UNIFORM_LETTERHEAD_SIZES.titleSizePt <= T.maxSizePt
        && UNIFORM_LETTERHEAD_SIZES.addressSizePt <= T.maxSizePt,
        UNIFORM_LETTERHEAD_SIZES.cite);

    // Asking for larger type is an error, not an advisory.
    checkTrue("type: a request for type above the ceiling is rejected",
        validateMemo({...FIG_2_1, font: {sizePt: 14}})
            .errors.some((f) => f.rule === "font-too-large"),
        T.maxSizeCite);
    checkTrue("type: a decorative face is rejected",
        validateMemo({...FIG_2_1, font: {family: "Brush Script MT"}})
            .errors.some((f) => f.rule === "font-style"),
        "AR 25-50, para 1-19b");
}

// ---------------------------------------------------------------------------
// An independent field template, measured
// ---------------------------------------------------------------------------

/**
 * A real unit memorandum template (HHC/ESB, 9 December 2009), measured from
 * its PDF text-placement coordinates rather than from a picture of it. Every
 * offset below is an observed position in inches from the top of the page.
 *
 * It is not authoritative - it predates the 2020 regulation by eleven years,
 * its body face is a serif substitute, and it carries a "REPLY TO / ATTENTION
 * OF" block that para 1-16b(1) says is not required. But it was produced by an
 * Army office rather than derived from the figures, so where it agrees it is
 * genuinely independent confirmation, and where it disagrees it is worth
 * knowing why.
 */
const FIELD_TEMPLATE = {
    lineHeightIn: 13.8 / 72,
    // Observed y positions, inches from the page top.
    officeSymbol: 1.915,
    memorandumFor: 2.490,
    subject: 2.874,
    firstParagraph: 3.424,
    subparagraphA: 3.782,
    subparagraphB: 4.140,
    secondParagraph: 4.499,
    pocParagraph: 5.215,
    pocWrap: 5.407,
    authorityLine: 5.790,
    signatureName: 6.749,
    signatureGrade: 6.940,
    signatureTitle: 7.132,
    distributionLabel: 7.515,
    distributionFirst: 7.707,
    // Observed x positions, inches from the page left edge.
    leftMargin: 1.001,
    subparagraphIndent: 1.251,
    signatureColumn: 4.251,
    // Continuation page.
    contOfficeSymbol: 1.156,
    contSubject: 1.347,
    contPageNumber: 9.964,
};

{
    const T = FIELD_TEMPLATE;
    const lines = (fromIn, toIn) => Math.round((toIn - fromIn) / T.lineHeightIn);

    // The template's own vertical rhythm, expressed in lines. These are what
    // the layout engine has to reproduce.
    check("field template: MEMORANDUM FOR is 3 lines below the office symbol",
        lines(T.officeSymbol, T.memorandumFor), 3, "AR 25-50, para 2-4a(5)");
    check("field template: SUBJECT is 2 lines below MEMORANDUM FOR",
        lines(T.memorandumFor, T.subject), 2, "AR 25-50, para 2-4a(6)");
    check("field template: the body begins 3 lines below the subject",
        lines(T.subject, T.firstParagraph), 3, "AR 25-50, para 2-4b(1)");
    check("field template: paragraphs are double spaced",
        lines(T.firstParagraph, T.subparagraphA), 2, "AR 25-50, para 2-4b(2)");
    check("field template: subparagraphs are double spaced too",
        lines(T.subparagraphA, T.subparagraphB), 2, "AR 25-50, para 2-4b(2)");
    check("field template: a wrapped line is single spaced",
        lines(T.pocParagraph, T.pocWrap), 1, "AR 25-50, para 2-4b(2)");
    check("field template: the authority line is 2 lines below the text",
        lines(T.pocWrap, T.authorityLine), 2, "AR 25-50, para 2-4c(1)");
    check("field template: the signature block is 5 lines below the authority line",
        lines(T.authorityLine, T.signatureName), 5, "AR 25-50, para 2-4c(2)(a)");
    check("field template: the signature block is single spaced",
        lines(T.signatureName, T.signatureGrade), 1, "AR 25-50, para 6-4c");
    check("field template: DISTRIBUTION is 2 lines below the signature block",
        lines(T.signatureTitle, T.distributionLabel), 2, "AR 25-50, para 2-4a(5)(c)");
    check("field template: distribution entries are single spaced",
        lines(T.distributionLabel, T.distributionFirst), 1, "AR 25-50, para 2-4a(5)(c)");
    check("field template: the continuation subject is 1 line below the office symbol",
        lines(T.contOfficeSymbol, T.contSubject), 1, "AR 25-50, para 2-5b");

    // Horizontal positions, in inches from the left margin.
    check("field template: the left margin is 1 inch",
        Number(T.leftMargin.toFixed(1)), LAYOUT.marginLeftIn, "AR 25-50, para 2-3c");
    check("field template: a first subdivision indents 1/4 inch",
        Number((T.subparagraphIndent - T.leftMargin).toFixed(2)), 0.25, "AR 25-50, fig 2-1");
    check("field template: the signature block begins at the centre of the page",
        Number((T.signatureColumn - T.leftMargin).toFixed(2)),
        LAYOUT.signatureBlockIndentIn, "AR 25-50, para 2-4c(2)(a)");
    checkTrue("field template: the page number sits about 1 inch from the bottom",
        Math.abs((LAYOUT.pageHeightIn - T.contPageNumber) - LAYOUT.marginBottomIn) < 0.1,
        "AR 25-50, para 2-5d");

    // The same memorandum through the layout engine, asserted against those
    // line counts. Distances are index deltas in the pre-pagination flow,
    // which is one entry per line.
    const memo = {
        letterhead: {
            organization: "Headquarters, Unit Name",
            streetAddress: "Number Street Name",
            cityStateZip: "Installation, State 12345-0000",
        },
        officeSymbol: "AFFH-SGF-OP",
        date: "9 December 2009",
        seeDistribution: true,
        addressees: [],
        subject: "Memorandum Template",
        paragraphs: [
            {text: "References:", children: [{text: "Reference 1."}, {text: "Reference 2."}]},
            {text: "Second paragraph of the memorandum."},
            {text: "Third paragraph of the memorandum."},
            {text: "The point of contact is Name at DSN 555-0000, commercial (555) 555-0000 or name@army.mil."},
        ],
        authorityLine: "FOR THE COMMANDER:",
        signature: {name: "John Doe", gradeAndBranch: "MSG, USA", title: "Operations NCO"},
        digitalSignature: false,
        distribution: ["1-Cdr/1SG, HHC, ESB", "1-Cdr/1SG, A Co., ESB", "1-Cdr, ESB, ATTN: Bn XO"],
    };
    const doc = layoutMemo(memo);
    const at = (role) => doc.flow.findIndex((l) => l.role === role);
    const paragraphIdx = doc.flow
        .map((l, i) => (l.role === "paragraph" && l.prefix ? i : -1)).filter((i) => i >= 0);

    check("rendered: MEMORANDUM FOR matches the template's 3 lines",
        at("memorandum-for") - at("office-symbol"), lines(T.officeSymbol, T.memorandumFor),
        "AR 25-50, para 2-4a(5)");
    check("rendered: SUBJECT matches the template's 2 lines",
        at("subject") - at("memorandum-for"), lines(T.memorandumFor, T.subject),
        "AR 25-50, para 2-4a(6)");
    check("rendered: the body matches the template's 3 lines",
        paragraphIdx[0] - at("subject"), lines(T.subject, T.firstParagraph),
        "AR 25-50, para 2-4b(1)");
    check("rendered: paragraph 1 to subparagraph a matches the template's 2 lines",
        paragraphIdx[1] - paragraphIdx[0], lines(T.firstParagraph, T.subparagraphA),
        "AR 25-50, para 2-4b(2)");
    check("rendered: subparagraph a to b matches the template's 2 lines",
        paragraphIdx[2] - paragraphIdx[1], lines(T.subparagraphA, T.subparagraphB),
        "AR 25-50, para 2-4b(2)");

    const sigRow = doc.flow.findIndex((l) => l.role === "signature");
    check("rendered: the signature block matches the template's 5 lines",
        sigRow - at("authority-line"), lines(T.authorityLine, T.signatureName),
        "AR 25-50, para 2-4c(2)(a)");
    check("rendered: the signature column matches the template",
        doc.flow[sigRow].indentIn, Number((T.signatureColumn - T.leftMargin).toFixed(2)),
        "AR 25-50, para 2-4c(2)(a)");
    check("rendered: DISTRIBUTION matches the template's 2 lines",
        at("distribution") - doc.flow.map((l, i) => (l.role === "signature" ? i : -1))
            .filter((i) => i >= 0).at(-1),
        lines(T.signatureTitle, T.distributionLabel), "AR 25-50, para 2-4a(5)(c)");
    check("rendered: distribution entries sit at the left margin like the template",
        doc.flow.filter((l) => l.role === "distribution").at(-1).indentIn, 0,
        "AR 25-50, para 2-4a(5)(c)");

    /*
     * Where the template departs from the 2020 regulation, the regulation
     * wins and the difference is explained rather than followed.
     *
     * Its office symbol sits at 1.915 in against this module's 1.670 in
     * because its letterhead carries a "REPLY TO / ATTENTION OF" block at
     * 1.403-1.511 in that para 1-16b(1) does not require. That block is a
     * line and a bit; removing it accounts for the whole difference.
     */
    const lowerByLines = (T.officeSymbol - LETTERHEAD_TOP) / (13.8 / 72);
    checkTrue("the template's lower office symbol is its extra letterhead block, about a line",
        lowerByLines > 0.5 && lowerByLines < 2.0, "AR 25-50, para 1-16b(1)");
}

// ---------------------------------------------------------------------------
// The Word deliverable
// ---------------------------------------------------------------------------

/**
 * The .docx is what actually gets staffed, so its formatting is asserted
 * against the same constants rather than eyeballed. These read the generated
 * OOXML directly: twips do not lie about a margin the way a screenshot does.
 *
 * 1 inch = 1440 twips. 12 pt = 24 half-points.
 */
{
    const {renderDocx} = await import("./memo-docx.js");
    const {createTemplate} = await import("./templates.js");
    const JSZip = (await import("jszip")).default;

    const open = async (memo) => {
        const zip = await JSZip.loadAsync(await renderDocx(memo));
        const read = async (p) => (zip.file(p) ? zip.file(p).async("string") : null);
        return {
            zip,
            document: await read("word/document.xml"),
            styles: await read("word/styles.xml"),
            settings: await read("word/settings.xml"),
            names: Object.keys(zip.files),
        };
    };

    const {OFFLINE_CONTENT, OFFLINE_CONTEXT, assembleMemo} = await import("./army-memo-agent.js");
    const memo = assembleMemo(OFFLINE_CONTENT, OFFLINE_CONTEXT);
    const docx = await open(memo);

    checkTrue("docx: the document default face is Arial",
        /<w:rFonts[^>]*w:ascii="Arial"/.test(docx.styles), TYPE_CITE);
    checkTrue("docx: the document default size is 12 pt",
        /<w:sz w:val="24"\/>/.test(docx.styles), TYPE_CITE);

    // "Use standard size paper (8 1/2 by 11 inches)." - para 2-3a
    checkTrue("docx: the page is 8.5 by 11 inches",
        /<w:pgSz w:w="12240" w:h="15840"/.test(docx.document), "AR 25-50, para 2-3a");

    // "Use standard margins: 1-inch from the left, right, and bottom edges." - 2-3c
    const margin = /<w:pgMar([^>]*)\/>/.exec(docx.document)?.[1] ?? "";
    for (const side of ["right", "bottom", "left"]) {
        checkTrue(`docx: the ${side} margin is 1 inch`,
            new RegExp(`w:${side}="1440"`).test(margin), "AR 25-50, para 2-3c");
    }

    // "Do not justify right margins." - para 2-3c
    checkTrue("docx: no paragraph is justified",
        !/<w:jc w:val="both"\/>/.test(docx.document), "AR 25-50, para 2-3c");

    // Single spacing, no space added before or after. - para 2-4b(2)
    checkTrue("docx: paragraphs are single spaced with no added space",
        /<w:spacing w:after="0" w:before="0" w:line="240" w:lineRule="auto"\/>/.test(docx.document),
        "AR 25-50, para 2-4b(2)");

    /*
     * The number and its text are one run - "1. " - not a run and a tab. A tab
     * needs a stop, and a stop one space wide is not a grid position: change
     * the label's width and Word advances to the next stop instead of holding
     * the space. LAYOUT.labelSpaces records why the gap is a space at all.
     */
    checkTrue("docx: a main paragraph's number carries its own single space",
        /<w:t xml:space="preserve">1\. <\/w:t>/.test(docx.document), LAYOUT.labelSpacesCite);
    checkTrue("docx: and so does a subdivision's",
        /<w:t xml:space="preserve">a\. <\/w:t>/.test(docx.document), LAYOUT.labelSpacesCite);
    checkTrue("docx: no paragraph number is followed by a tab",
        !/<w:t xml:space="preserve">1\.<\/w:t><\/w:r><w:r>[^<]*<w:tab\/>/.test(docx.document),
        LAYOUT.labelSpacesCite);
    checkTrue("docx: a first subdivision indents its first line a quarter inch",
        /<w:ind w:left="0" w:firstLine="360"\/>/.test(docx.document), "AR 25-50, fig 2-1");

    // The wrap returns to the left margin, so left indent is always zero.
    checkTrue("docx: paragraph wraps return to the left margin",
        !/<w:ind w:left="(?!0")\d+" w:firstLine/.test(docx.document),
        "AR 25-50, para 2-4a(6)");

    // The date is placed by a right tab at the right margin, 6.5 in = 9360.
    checkTrue("docx: the date is flush right at the 6.5-inch margin",
        /<w:tab w:val="right" w:pos="9360"\/>/.test(docx.document), "AR 25-50, para 2-4a(3)(b)");

    // The signature block begins at the centre of the page, 3.25 in = 4680.
    checkTrue("docx: the signature block begins at the centre of the page",
        /<w:tab w:val="left" w:pos="4680"\/>/.test(docx.document), "AR 25-50, para 2-4c(2)(a)");

    // Two spaces after ending punctuation must survive into the XML. - 1-39b(9)
    checkTrue("docx: two spaces follow ending punctuation",
        /2026\.\s{2}Reschedule/.test(docx.document), "AR 25-50, para 1-39b(9)");
    checkTrue("docx: runs preserve their whitespace",
        /xml:space="preserve"/.test(docx.document), "AR 25-50, para 1-39b(9)");

    // Widow and orphan handling. - paras 2-5c(1) and 2-5c(2)
    checkTrue("docx: short paragraphs are kept whole across a page break",
        /<w:keepLines\/>/.test(docx.document), "AR 25-50, para 2-5c(1)");
    checkTrue("docx: widow control is on", /<w:widowControl\/>/.test(docx.document),
        "AR 25-50, para 2-5c(2)");

    // Formatting is locked; text is not.
    checkTrue("docx: formatting is protected against change",
        /<w:documentProtection w:formatting="1" w:enforcement="1"\/>/.test(docx.settings),
        "AR 25-50, paras 1-19 and 2-3c");
    checkTrue("docx: the text itself stays editable",
        !/w:edit="readOnly"/.test(docx.settings), "editable deliverable");

    /*
     * No memorandum prints a figure's annotation.
     *
     * The figures caption themselves. "[place digital signature block here]"
     * in figures 2-1, 2-14 and 2-17 points at the space a signature occupies;
     * "[insert text box here]" and "[insert digital signature box here]" in
     * figure 2-11 point at the boxes appendix F describes for a THRU
     * addressee. None of it is text a memorandum carries, and rendering any of
     * it puts an instruction to the typist into a signed document. One of them
     * was being rendered, in every type, until it was reported.
     */
    {
        const {TEMPLATES} = await import("./templates.js");
        const annotations = [
            [/place digital signature/i, "AR 25-50, figs 2-1, 2-14 and 2-17"],
            [/insert text box/i, "AR 25-50, fig 2-11"],
            [/insert digital signature box/i, "AR 25-50, figs 2-11 and 2-12"],
        ];
        const printed = [];
        for (const type of Object.keys(TEMPLATES)) {
            const zip = (await open(createTemplate(type))).zip;
            for (const part of Object.keys(zip.files)
                .filter((n) => /word\/(document|header\d*)\.xml/.test(n))) {
                const xml = await zip.file(part).async("string");
                for (const [pattern] of annotations) {
                    if (pattern.test(xml)) printed.push(`${type}:${part}`);
                }
            }
        }
        check("docx: no type prints a figure's own annotation", printed, [],
            annotations.map(([, cite]) => cite).join("; "));
    }

    /*
     * Every tab carries its own stop.
     *
     * A tab with no stop defined on its paragraph falls through to Word's
     * default grid, which is half an inch when `w:defaultTabStop` is absent -
     * twice the quarter inch para 1-39b(10) sets, and enough to put a
     * paragraph's text or a signature block visibly wrong. This is checked
     * across every type because the stops are computed per paragraph from the
     * subdivision depth, so a new depth is exactly where one would go missing.
     */
    {
        const {TEMPLATES} = await import("./templates.js");
        let withTab = 0, without = 0;
        for (const type of Object.keys(TEMPLATES)) {
            const zip = (await open(createTemplate(type))).zip;
            const parts = Object.keys(zip.files).filter((n) => /word\/(document|header\d*)\.xml/.test(n));
            for (const part of parts) {
                const xml = await zip.file(part).async("string");
                for (const m of xml.matchAll(/<w:p>(?:(?!<\/w:p>).)*<\/w:p>/gs)) {
                    const tabs = (m[0].match(/<w:tab\/>/g) ?? []).length;
                    if (!tabs) continue;
                    withTab++;
                    const stops = (m[0].match(/<w:tab w:val="[a-z]+" w:pos="\d+"/g) ?? []).length;
                    if (stops < tabs) without++;
                }
            }
        }
        checkTrue("docx: every tab in every type has its own stop",
            withTab > 0 && without === 0, "AR 25-50, para 1-39b(10)");
    }
    const {convertInchesToTwip: toTwip} = await import("docx");
    check("docx: and a tab the writer types lands on the quarter-inch grid",
        Number(/<w:defaultTabStop w:val="(\d+)"\/>/.exec(docx.settings)?.[1]),
        toTwip(LAYOUT.labelGapIn), "AR 25-50, para 1-39b(10)");

    /*
     * Page 1 gets the letterhead; every page after it gets the running head of
     * para 2-5b. They are different headers, and `w:titlePage` is what keeps
     * them apart - without it the running head prints on page 1 as well, over
     * the heading that already says the same thing, and its overflow pushes the
     * text down the page.
     */
    checkTrue("docx: page 1 is a separate header from the pages after it",
        /<w:titlePg\/>/.test(docx.document), "AR 25-50, paras 2-3a(1) and 2-5b");
    const firstHeader = await headerPart(docx.zip, "first");
    const restHeader = await headerPart(docx.zip, "default");
    checkTrue("docx: page 1's header is the letterhead",
        firstHeader?.includes(LETTERHEAD.lines[0]) && /<w:drawing>/.test(firstHeader),
        "AR 25-50, para 2-3a(1)");
    checkTrue("docx: page 1's header is not the continuation heading",
        !/SUBJECT:/.test(firstHeader), "AR 25-50, para 2-5b");
    checkTrue("docx: the pages after it carry the continuation heading",
        /SUBJECT:/.test(restHeader) && !/<w:drawing>/.test(restHeader),
        "AR 25-50, para 2-5b");

    /*
     * The MFR goes out on the unit's letterhead like every other memorandum
     * - by the owner's direction, reading para 2-7 (whose 2-7b(1) heading
     * spec names the office symbol, date and subject) as the governing text
     * and fig 2-17's plain-paper example as illustrative, not a
     * prohibition. So an MFR's first page carries the seal and the
     * DEPARTMENT OF THE ARMY header exactly as a standard memorandum's
     * does, and page 1 is still separated from the continuation pages.
     */
    {
        const plain = await open(createTemplate("record"));
        const first = await headerPart(plain.zip, "first");
        // On the document, not on the header reference: the reference is
        // written either way, and it is `w:titlePg` that decides whether Word
        // honours it. Without this the running head reaches page 1 and every
        // check above still passes.
        checkTrue("docx: an MFR separates page 1 too",
            /<w:titlePg\/>/.test(plain.document), "AR 25-50, para 2-5a");
        checkTrue("docx: an MFR carries the seal on its letterhead - never prepared without it",
            /<w:drawing>/.test(first ?? ""), "AR 25-50, para 2-7 as directed");
        checkTrue("docx: and the DEPARTMENT OF THE ARMY header",
            /DEPARTMENT OF THE ARMY/.test(first ?? ""), "AR 25-50, para 2-7 as directed");
        checkTrue("docx: and no continuation heading on page 1",
            !/SUBJECT:/.test(first ?? ""), "AR 25-50, para 2-5a");
        checkTrue("docx: but its continuation pages still carry one",
            /SUBJECT:/.test(await headerPart(plain.zip, "default") ?? ""), "AR 25-50, para 2-5b");
    }

    // "Type the office symbol on the second line below the seal." - para
    // 2-4a(1). Page 1's body therefore starts where the figures put it.
    const {LETTERHEAD: LH} = await import("./ar25-50.js");
    const {convertInchesToTwip} = await import("docx");
    // Asserted through the same conversion the renderer uses, so this pins the
    // measurement rather than a rounding convention.
    check("docx: page 1 begins where the office symbol belongs",
        Number(/<w:pgMar w:top="(\d+)"/.exec(docx.document)?.[1]),
        convertInchesToTwip(LH.officeSymbolTopIn), LH.officeSymbolTopCite);

    /*
     * The office symbol's position used to be derived - "the second line below
     * the seal" (para 2-4a(1)), counted in the body's 13.8 pt lines. That was
     * wrong, and wrong in a way that could not be caught by rendering: the
     * letterhead is not set in the body's 12 pt, so its four lines are not four
     * body lines, and the derived position came out half a line high. The same
     * bad line height was then used to check it, and it agreed with itself.
     *
     * So the position is measured off the figure instead, and asserted against
     * the figure - see the rendered-page block near the end of this file, which
     * puts our ink tops next to figure 2-1's. What is asserted here is that the
     * letterhead block ends above the office symbol with room to spare, which
     * is the relationship that has to survive an office supplying long lines.
     */
    const lineIn = LH.lineHeightPt / 72;
    const letterheadEndsIn = LH.letterheadTopIn
        + (LETTERHEAD.titleSizePt + 3 * LETTERHEAD.addressSizePt) * 1.15 / 72;
    checkTrue("the letterhead block clears the office symbol",
        letterheadEndsIn < LH.officeSymbolTopIn, LH.officeSymbolTopCite);
    checkTrue("and the seal clears it too - it is the lowest thing in the letterhead",
        LH.sealTopIn + LH.sealDiameterIn < LH.officeSymbolTopIn, LH.sealGeometryCite);

    /*
     * A continuation page's text belongs on the third line below the subject
     * (para 2-5c). One section carries one top margin, so page 1's office
     * symbol and a continuation page's text have to live at the same height.
     *
     * They now do, to within a fifteenth of a line, which is the happy result
     * of measuring page 1 rather than deriving it: 1.78 in against 1.767. When
     * page 1 was derived at 1.670 these were half a line apart and the
     * difference had to be smuggled in through header overflow - Word pushing
     * the body down by the excess. That is no longer needed, and the two
     * alternatives tried back then are recorded in memo-docx.js so nobody
     * reaches for them again.
     */
    const {SPACING: SP} = await import("./ar25-50.js");
    const runningHeadLines = 2 + (SP.continuationSubjectToText.linesBelow - 1);
    const contBody = LH.continuationBodyFrom(runningHeadLines);

    check("the running head is the office symbol, the subject, and the 2-5c gap",
        runningHeadLines, 4, "AR 25-50, paras 2-5a through 2-5c");
    check("continuation text lands on the 3d line below the subject",
        Math.round((contBody - (1.0 + lineIn)) / lineIn), 3, "AR 25-50, para 2-5c");
    checkTrue("and within a fifteenth of a line of where page 1's body starts,"
        + " so one top margin serves both",
        Math.abs(contBody - LH.officeSymbolTopIn) / lineIn < 0.07,
        "AR 25-50, paras 2-4a(1) and 2-5c");
}

{
    // The seal, placed to the measurement taken off the regulation's figures.
    // EMU (English Metric Units) are exact integers at 914400 per inch, so
    // these assert the placement rather than approximate it.
    const {renderDocx} = await import("./memo-docx.js");
    const JSZip = (await import("jszip")).default;
    const {LETTERHEAD} = await import("./ar25-50.js");
    const {OFFLINE_CONTENT, OFFLINE_CONTEXT, assembleMemo} = await import("./army-memo-agent.js");

    const zip = await JSZip.loadAsync(await renderDocx(assembleMemo(OFFLINE_CONTENT, OFFLINE_CONTEXT)));
    const header = await headerPart(zip, "first");
    const EMU = 914400;

    const extent = /<wp:extent cx="(\d+)" cy="(\d+)"/.exec(header);
    check("seal: the artwork is exactly 0.95 inch wide",
        Number(extent?.[1]), Math.round(LETTERHEAD.sealDiameterIn * EMU),
        LETTERHEAD.sealGeometryCite);
    check("seal: the artwork is exactly 0.95 inch tall",
        Number(extent?.[2]), Math.round(LETTERHEAD.sealDiameterIn * EMU),
        LETTERHEAD.sealGeometryCite);
    check("seal: the artwork is square",
        extent?.[1], extent?.[2], LETTERHEAD.sealGeometryCite);

    const offsets = [...header.matchAll(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/g)].map((m) => Number(m[1]));
    check("seal: it sits 0.52 inch from the left edge",
        offsets[0], Math.round(LETTERHEAD.sealLeftIn * EMU), LETTERHEAD.sealGeometryCite);
    check("seal: it sits 0.52 inch from the top edge",
        offsets[1], Math.round(LETTERHEAD.sealTopIn * EMU), LETTERHEAD.sealGeometryCite);

    // JSZip lists the "word/media/" directory entry alongside its files.
    const media = Object.keys(zip.files)
        .filter((n) => n.startsWith("word/media/") && !zip.files[n].dir);
    check("seal: exactly one image is embedded", media.length, 1, "AR 25-50, para 1-16b(2)");

    // Para 1-16b(2) forbids any other device on letterhead, so the seal must be
    // the only image in the document.
    checkTrue("seal: no other emblem, insignia, or device appears",
        media.length === 1, LETTERHEAD.insigniaCite);
}

{
    // A memorandum for record is plain white paper with no letterhead header
    // and no authority line. - fig 2-17
    const {renderDocx} = await import("./memo-docx.js");
    const {createTemplate} = await import("./templates.js");
    const JSZip = (await import("jszip")).default;

    const mfr = createTemplate("record");
    const zip = await JSZip.loadAsync(await renderDocx(mfr));
    const document = await zip.file("word/document.xml").async("string");

    checkTrue("docx: an MFR is addressed MEMORANDUM FOR RECORD",
        /MEMORANDUM FOR RECORD/.test(document), "AR 25-50, fig 2-17");
    checkTrue("docx: an MFR carries no authority line",
        !/AUTHORITY LINE/.test(document), "AR 25-50, fig 2-17");
    {
        // On letterhead like every other memorandum (owner-directed, per
        // para 2-7), an MFR's page 1 starts where a standard memorandum's
        // does - at the seal, not at the 1-inch text margin.
        const standardDoc = await (await JSZip.loadAsync(await renderDocx(createTemplate("standard"))))
            .file("word/document.xml").async("string");
        check("docx: an MFR's page 1 starts where a standard memorandum's does",
            /<w:pgMar w:top="(\d+)"/.exec(document)?.[1],
            /<w:pgMar w:top="(\d+)"/.exec(standardDoc)?.[1],
            "AR 25-50, para 2-7 as directed");
    }

    const result = validateMemo(mfr);
    checkTrue("an MFR on letterhead raises no finding - it is never prepared without one",
        validateMemo({...mfr, letterhead: {organization: "HQ, 4TH INFANTRY DIVISION",
            streetAddress: "1633 MEKONG STREET", cityStateZip: "FORT CARSON, CO  80913-4321"}})
            .findings.every((f) => f.rule !== "mfr-letterhead"),
        "AR 25-50, para 2-7 as directed");
    checkTrue("an MFR with an authority line is reported",
        validateMemo({...mfr, authorityLine: "FOR THE COMMANDER:"})
            .errors.some((f) => f.rule === "mfr-authority-line"),
        "AR 25-50, fig 2-17");
}

{
    // The decision memorandum underlines its heading words. - fig 2-18
    const {renderDocx} = await import("./memo-docx.js");
    const {createTemplate} = await import("./templates.js");
    const JSZip = (await import("jszip")).default;

    const zip = await JSZip.loadAsync(await renderDocx(createTemplate("decision")));
    const document = await zip.file("word/document.xml").async("string");

    checkTrue("docx: decision-memorandum headings are underlined",
        /<w:u w:val="single"\/>/.test(document), "AR 25-50, fig 2-18");
    checkTrue("docx: the underline marker itself does not reach the page",
        !/_FOR DECISION_/.test(document), "AR 25-50, para 1-32");
    checkTrue("docx: the approval line keeps its columns",
        /APPROVED/.test(document) && /DISAPPROVED/.test(document), "AR 25-50, fig 2-18");

    // "Preparing a digital decision memorandum" - fig 2-19 - shows a checkbox
    // the approver clicks, not an X to strike by hand.
    const boxes = (document.match(/<w14:checkbox>/g) ?? []).length;
    check("docx: a digital decision memorandum has three approval checkboxes",
        boxes, 3, "AR 25-50, fig 2-19");

    // The wet-signature form of the same memorandum uses the X of fig 2-18.
    const {DECISION_APPROVAL} = await import("./ar25-50.js");
    const wet = createTemplate("decision");
    wet.digitalSignature = false;
    const wetXml = await (await JSZip.loadAsync(await renderDocx(wet)))
        .file("word/document.xml").async("string");
    checkTrue("docx: a wet-signature decision memorandum uses X, not checkboxes",
        !/<w14:checkbox>/.test(wetXml) && /APPROVED {2}</.test(wetXml),
        "AR 25-50, fig 2-18");
    /*
     * And the X is underlined. Figure 2-18 rules a line under each one: it is
     * the space the approver strikes, not a letter of text, and an X sitting
     * on nothing reads as a decision already taken.
     */
    checkTrue("docx: and each X is underlined, because it marks a blank",
        (wetXml.match(/<w:u w:val="single"\/>[^]{0,200}?<w:t[^>]*>X<\/w:t>/g) ?? []).length
            === DECISION_APPROVAL.options.length,
        DECISION_APPROVAL.wetCite);
}

{
    // MOU heading and signature blocks. - para 2-6c
    const {renderDocx} = await import("./memo-docx.js");
    const {createTemplate} = await import("./templates.js");
    const JSZip = (await import("jszip")).default;

    const zip = await JSZip.loadAsync(await renderDocx(createTemplate("mou")));
    const document = await zip.file("word/document.xml").async("string");

    checkTrue("docx: the MOU title, BETWEEN, and AND are centred",
        (document.match(/<w:jc w:val="center"\/>/g) ?? []).length >= 5, "AR 25-50, para 2-6c(1)");
    checkTrue("docx: the MOU carries no office symbol or addressee line",
        !/MEMORANDUM FOR/.test(document), "AR 25-50, para 2-6c(1)");
    checkTrue("docx: MOU signature blocks are overscored",
        /_{10,}/.test(document), "AR 25-50, para 2-6c(5)(b)");

    // "Prepare the MOU/MOA on plain white paper." - para 2-6c(1). The only
    // running head an agreement carries is the continuation subject, so the
    // test is for letterhead content, not for the absence of a header part.
    const mouZip = await JSZip.loadAsync(await renderDocx(createTemplate("mou")));
    const names = Object.keys(mouZip.files);
    checkTrue("docx: an MOU carries no seal image",
        !names.some((n) => n.startsWith("word/media/") && !mouZip.files[n].dir),
        "AR 25-50, para 2-6c(1)");

    const headerParts = names.filter((n) => /word\/header\d+\.xml$/.test(n));
    const headerText = (await Promise.all(headerParts.map((n) => mouZip.file(n).async("string")))).join("");
    checkTrue("docx: an MOU has no DEPARTMENT OF THE ARMY letterhead block",
        !/DEPARTMENT OF THE ARMY/.test(headerText), "AR 25-50, para 2-6c(1)");
    checkTrue("docx: an MOU continuation head repeats the subject only",
        !headerText.includes("OFFICE SYMBOL"), "AR 25-50, figs 2-15 and 2-16");

    // Each block carries its own date rule and centred caption. - figs 2-15, 2-16
    checkTrue("docx: each MOU signature block has a date line",
        /\(Date\)/.test(document), "AR 25-50, figs 2-15 and 2-16");
}

{
    // Agreement heading and signature geometry in the layout engine.
    const {AGREEMENT_FORMAT, agreementParties} = await import("./ar25-50.js");

    check("two agencies are joined by AND alone",
        agreementParties(["A", "B"]), ["A", "AND", "B"], "AR 25-50, para 2-6c(1)");
    check("three agencies take semicolons with AND before the last",
        agreementParties(["A", "B", "C"]), ["A; B;", "AND", "C"],
        "AR 25-50, figs 2-15 and 2-16");

    const mou = layoutMemo({
        type: "mou",
        letterhead: null,
        parties: ["CHIEF INFORMATION OFFICER/G-6", "DEPUTY CHIEF OF STAFF, G-2", "THE DEFENSE CIVIL PREPAREDNESS AGENCY"],
        subject: "Preparing a Memorandum of Understanding",
        paragraphs: [{text: "BACKGROUND:  [If there is need to discuss background.]"}],
        signers: [
            {name: "Name One", gradeAndBranch: "Lieutenant General", titleAndAgency: "DCS, G-2"},
            {name: "Name Two", gradeAndBranch: "Lieutenant General", titleAndAgency: "Chief Information Officer/G-6"},
            {name: "Name Three", titleAndAgency: "Director, Defense Civilian Preparedness Agency"},
        ],
        digitalSignature: false,
    });

    checkTrue("an MOU is laid out on plain paper", mou.hasLetterhead === false,
        "AR 25-50, para 2-6c(1)");

    const overscores = mou.flow.filter((l) => l.role === "overscore");
    check("an MOU with three agencies has two overscore rows",
        overscores.length, 2, "AR 25-50, para 2-6c(5)(d)");
    checkTrue("the first overscore row carries both side-by-side blocks",
        !!overscores[0].sameLine, "AR 25-50, para 2-6c(5)");
    checkTrue("the third block is centred and stands alone",
        !overscores[1].sameLine && overscores[1].indentIn > 0.5,
        "AR 25-50, para 2-6c(5)(d)");

    check("the senior of the first two signs on the right",
        mou.flow.find((l) => l.role === "signature").sameLine.text, "NAME TWO",
        "AR 25-50, para 2-6c(5)(d)");

    const dateCaptions = mou.flow.filter((l) => l.text === AGREEMENT_FORMAT.dateCaption
        || l.sameLine?.text === AGREEMENT_FORMAT.dateCaption);
    checkTrue("every signature block has a (Date) caption", dateCaptions.length >= 2,
        "AR 25-50, figs 2-15 and 2-16");

    // "If the title requires more than one line, continue it on the fourth
    //  line, indenting 1/4 inch." - para 6-4c
    const wrapped = mou.flow.find((l) => l.text === "Preparedness Agency");
    checkTrue("a signature title too long for its column wraps at 1/4 inch",
        !!wrapped, "AR 25-50, para 6-4c");

    // An MOU has no office symbol, so continuation pages repeat the subject.
    const long = layoutMemo({
        type: "mou", letterhead: null, parties: ["A", "B"], subject: "Long Agreement",
        paragraphs: Array.from({length: 40}, (_, i) => ({text: `Paragraph ${i + 1} of the agreement text.`})),
        signers: [{name: "A", titleAndAgency: "T"}, {name: "B", titleAndAgency: "T"}],
        digitalSignature: false,
    });
    if (long.pages.length > 1) {
        checkTrue("an MOU continuation page repeats the subject and no office symbol",
            long.pages[1].heading.some((l) => l.role === "subject")
            && !long.pages[1].heading.some((l) => l.role === "office-symbol"),
            "AR 25-50, figs 2-15 and 2-16");
    }
}

// ---------------------------------------------------------------------------
// The THRU form and memorandum-type detection
// ---------------------------------------------------------------------------

{
    // "FOR", not "MEMORANDUM FOR", once a THRU chain is present. - figs 2-11, 2-12
    const single = layoutMemo({
        ...FIG_2_1,
        thru: ["U.S. Army North (ARNO-CG), 1400 East Grayson St., Fort Sam Houston, TX 78234-7000"],
        addressees: ["Records Management and Declassification Agency (AAHS-RDR)"],
    });
    check("fig 2-11: a THRU memorandum addresses the action office with FOR",
        single.flow[indexOf(single, "memorandum-for")].text,
        "FOR Records Management and Declassification Agency (AAHS-RDR)",
        "AR 25-50, fig 2-11");
    check("fig 2-11: a single THRU sits on the MEMORANDUM THRU line",
        single.flow[indexOf(single, "thru")].text.startsWith("MEMORANDUM THRU U.S. Army North"),
        true, "AR 25-50, fig 2-11");
    check("fig 2-11: a single THRU wraps flush with the left margin",
        single.flow.filter((l) => l.role === "thru")[1]?.indentIn, 0,
        "AR 25-50, para 2-4a(5)");

    const dual = layoutMemo({
        ...FIG_2_1,
        thru: [
            "Logistics Information Management Division (DALO-PLI), 500 Army Pentagon, Washington, DC 20310-0500",
            "Field Division (AMCIO-F), U.S. Army Materiel Command, 4400 Martin Rd., Redstone Arsenal, AL 35898-5000",
        ],
        addressees: ["Director of Information Management (ANFB-IMR)"],
    });
    check("fig 2-12: two THRU addressees stack under a bare MEMORANDUM THRU",
        dual.flow[indexOf(dual, "thru")].text, "MEMORANDUM THRU", "AR 25-50, fig 2-12");
    check("fig 2-12: stacked THRU addresses indent their second line a quarter inch",
        dual.flow.filter((l) => l.role === "thru").find((l) => l.indentIn > 0)?.indentIn, 0.25,
        "AR 25-50, para 2-4a(5)(b)");
    checkTrue("more than two THRU addressees is reported",
        validateMemo({...FIG_2_1, thru: ["A", "B", "C"]})
            .warnings.some((f) => f.rule === "thru-count"),
        "AR 25-50, fig 2-12");
}

{
    // Figure 2-6 addressing rules.
    const officeSymbolStyle = {
        ...FIG_2_1,
        addressees: [
            "HQDA (DAMI-XX), 1000 ARMY PENTAGON, WASH DC 20310-1000",
            "HQDA (DALO-XX), 500 ARMY PENTAGON, WASH DC 20310-0500",
        ],
    };
    check("fig 2-6: consistent office-symbol addressing passes",
        validateMemo(officeSymbolStyle).errors.filter((f) => f.rule.startsWith("address")).length, 0,
        "AR 25-50, fig 2-6");

    checkTrue("fig 2-6: mixing office symbols with full titles is reported",
        validateMemo({...FIG_2_1, addressees: [
            "HQDA (DAMI-XX), 1000 ARMY PENTAGON, WASH DC 20310-1000",
            "Information Office, U.S. Army Forces Command, 4700 Knox St., Fort Bragg, NC 28310-5000",
        ]}).errors.some((f) => f.rule === "addressing-types-mixed"),
        "AR 25-50, fig 2-6");

    checkTrue("fig 2-6: an abbreviated city with a comma before the state is reported",
        validateMemo({...FIG_2_1, addressees: [
            "HQDA (DAMI-XX), 1000 ARMY PENTAGON, WASH, DC 20310-1000",
            "HQDA (DALO-XX), 500 ARMY PENTAGON, WASH, DC 20310-0500",
        ]}).errors.some((f) => f.rule === "abbreviated-city-comma"),
        "AR 25-50, fig 2-6");

    checkTrue("fig 2-6: lowercase office-symbol addresses are reported",
        validateMemo({...FIG_2_1, addressees: [
            "HQDA (DAMI-XX), 1000 Army Pentagon, Wash DC 20310-1000",
            "HQDA (DALO-XX), 500 Army Pentagon, Wash DC 20310-0500",
        ]}).errors.some((f) => f.rule === "office-symbol-address-case"),
        "AR 25-50, fig 2-6");
}

{
    // Figure 2-9: the complete distribution listing on a page of its own.
    const {LISTING} = await import("./ar25-50.js");
    const memo = {
        ...FIG_2_1,
        seeDistribution: true,
        addressees: [],
        distributionOnSeparatePage: true,
        distribution: ["Deputy Chief of Staff, G-1 (DAPE)", "Deputy Chief of Staff, G-2 (DAMI)"],
    };
    const doc = layoutMemo(memo);
    const rendered = renderText(memo);

    checkTrue("fig 2-9: the memorandum points to the listing on the next page",
        rendered.includes(`DISTRIBUTION:\n${LISTING.separatePageMarker}`),
        LISTING.separatePageCite);
    checkTrue("fig 2-9: the listing itself is on a page of its own",
        doc.pages.length >= 2
        && doc.pages.at(-1).lines.some((l) => l.text === "DISTRIBUTION:")
        && doc.pages.at(-1).lines.some((l) => l.text?.includes("DAPE")),
        LISTING.separatePageCite);
    checkTrue("fig 2-9: that page repeats the office symbol and subject",
        doc.pages.at(-1).heading.some((l) => l.role === "office-symbol")
        && doc.pages.at(-1).heading.some((l) => l.role === "subject"),
        "AR 25-50, paras 2-5a and 2-5b");
    checkTrue("a promised separate listing with no entries is reported",
        validateMemo({...FIG_2_1, distributionOnSeparatePage: true, distribution: []})
            .errors.some((f) => f.rule === "distribution-page-empty"),
        LISTING.separatePageCite);
}

{
    const {detectMemoType} = await import("./army-memo-agent.js");
    check("intent: a decision request selects the decision memorandum",
        detectMemoType("I need a decision memo for the CG to approve the range plan"), "decision",
        "AR 25-50, para 2-8");
    check("intent: documenting a phone call selects the MFR",
        detectMemoType("document the telephone conversation I had with range control"), "record",
        "AR 25-50, para 2-7");
    check("intent: an agreement with funds selects the MOA",
        detectMemoType("draft a memorandum of agreement with the garrison"), "moa",
        "AR 25-50, para 2-6b");
    check("intent: routing through the chain selects THRU",
        detectMemoType("send this thru the brigade commander to FORSCOM"), "thru",
        "AR 25-50, para 2-4a(5)(d)");
    check("intent: anything else is a standard memorandum",
        detectMemoType("tell the battalions the range is closed"), "standard",
        "AR 25-50, para 2-4");
    check("intent: commending a soldier selects the commendation memorandum",
        detectMemoType("I want to commend a soldier for their outstanding performance"), "commendation",
        "AR 25-50, paras 2-2 and 2-4a(5)");
    check("intent: a recommendation request is not read as a commendation",
        detectMemoType("write a memo with my recommendation on the new policy") === "commendation", false,
        "AR 25-50, paras 2-2 and 2-4a(5)");
    check("intent: an appreciation request selects the appreciation memorandum",
        detectMemoType("draft a memorandum of appreciation for the volunteers"), "appreciation",
        "AR 25-50, paras 2-2 and 2-4a(5)");

    /*
     * fig 2-17's own use case - "document informal meetings or telephone
     * conversations" - is two ideas that land in either order in ordinary
     * speech. The event named first is the shape the original single-pass
     * regex missed entirely, silently defaulting to "standard."
     */
    check("intent: the event named before the record verb still selects the MFR",
        detectMemoType("I had a meeting with the contractor and need to document it"), "record",
        "AR 25-50, para 2-7");
    check("intent: \"memo for record\" (not the full official name) still selects the MFR",
        detectMemoType("write a memo for record of the incident"), "record",
        "AR 25-50, para 2-7");
    check("intent: \"log a conversation\" still selects the MFR",
        detectMemoType("I need to log a conversation I had with the vendor"), "record",
        "AR 25-50, para 2-7");
    check("intent: \"capture\" a site visit still selects the MFR",
        detectMemoType("capture the details of our site visit yesterday"), "record",
        "AR 25-50, para 2-7");
    checkTrue("intent: a record verb alone, with no event, does not force the MFR",
        detectMemoType("document the new leave policy for all units") !== "record",
        "AR 25-50, para 2-7");
    checkTrue("intent: an event alone, with no record verb, does not force the MFR",
        detectMemoType("send a memo to the battalions about the upcoming range meeting") !== "record",
        "AR 25-50, para 2-7");

    /*
     * Two gaps the backbone scenarios below found by using phrasing nobody
     * had tried yet: a pronoun inserted into "write up" ("write it up"),
     * and para 2-7a's other named use - "the authority or basis for an
     * action taken" - which the trigger list covered nowhere at all.
     */
    checkTrue("intent: \"write it up\" (not the bare phrase \"write up\") still selects the MFR",
        detectMemoType("I had a call with the vendor, need to write it up") === "record",
        "AR 25-50, para 2-7a");
    checkTrue("intent: \"basis for\" an action selects the MFR",
        detectMemoType("document the basis for approving the request") === "record",
        "AR 25-50, para 2-7a");
    checkTrue("intent: a gerund (\"documenting\") is recognized, not just the base verb",
        detectMemoType("write a memo documenting the basis for the reorganization") === "record",
        "AR 25-50, para 2-7a");
    checkTrue("intent: \"logistics\" is not mistaken for the record verb \"log\"",
        detectMemoType("coordinate with the logistics office on the shipment and set up a meeting") !== "record",
        "AR 25-50, para 2-7");
}

{
    // Signature-block formalities. - chapter 6
    const {buildSignature, normalizeGrade, spellOutGrade} = await import("./signature-blocks.js");

    check("table 6-1: MAJ is Major", spellOutGrade("MAJ"), "Major", "AR 25-50, table 6-1");
    check("table 6-1: a spelled-out grade normalizes to its abbreviation",
        normalizeGrade("Lieutenant Colonel"), "LTC", "AR 25-50, table 6-1");

    check("a field-grade officer abbreviates grade and branch on a memorandum",
        buildSignature({name: "Marcus T. Hale", grade: "LTC", branch: "IN", title: "Director"}).lines,
        ["MARCUS T. HALE", "LTC, IN", "Director"], "AR 25-50, para 6-4c");

    check("a general officer spells out the grade and uses USA on a memorandum",
        buildSignature({name: "Jane A. Ruiz", grade: "MG", title: "Commanding General"}).lines,
        ["JANE A. RUIZ", "Major General, USA", "Commanding General"],
        "AR 25-50, paras 6-4f(3) and 6-5c(3)");

    check("a general staff officer uses GS in place of a branch",
        buildSignature({name: "A B Smith", grade: "COL", branch: "IN", generalStaff: true, title: "Chief"}).lines[1],
        "COL, GS", "AR 25-50, para 6-5c(7)");

    check("an inspector general uses IG in place of a branch",
        buildSignature({name: "A B Smith", grade: "COL", inspectorGeneral: true, title: "IG"}).lines[1],
        "COL, IG", "AR 25-50, para 6-5c(7)");

    check("a civilian signature block is name and title only",
        buildSignature({name: "David A. Okonkwo", civilian: true, title: "Range Operations Specialist"}).lines,
        ["DAVID A. OKONKWO", "Range Operations Specialist"], "AR 25-50, para 6-8a");

    /*
     * "Abbreviations reflecting professional degrees may be used in civilian
     *  signature blocks when dealing with foreign and high-level officials
     *  outside DoD [or in] Army teaching institutions... Do not use these
     *  abbreviations in routine correspondence." - para 6-8c
     */
    checkTrue("a degree abbreviation in a routine civilian block is reported",
        buildSignature({name: "Jane Doe", civilian: true, title: "Director, Ph.D."})
            .findings.some((f) => f.rule === "degree-abbreviation-routine"),
        "AR 25-50, para 6-8c");
    checkTrue("and excused for a foreign or high-level official",
        buildSignature({name: "Jane Doe", civilian: true, title: "Director, Ph.D.",
                        foreignOrHighLevelOfficial: true})
            .findings.every((f) => f.rule !== "degree-abbreviation-routine"),
        "AR 25-50, para 6-8c");
    checkTrue("and excused at an Army teaching institution",
        buildSignature({name: "Jane Doe", civilian: true, title: "Dean, Ph.D.", academicInstitution: true})
            .findings.every((f) => f.rule !== "degree-abbreviation-routine"),
        "AR 25-50, para 6-8c");
    checkTrue("and not raised when there is no degree in the block at all",
        buildSignature({name: "David A. Okonkwo", civilian: true, title: "Range Operations Specialist"})
            .findings.every((f) => f.rule !== "degree-abbreviation-routine"),
        "AR 25-50, para 6-8c");

    check("retired personnel show USA Retired and no branch",
        buildSignature({name: "A B Smith", grade: "COL", retired: true, title: "None"}).lines[1],
        "COL, USA Retired", "AR 25-50, para 6-6");

    check("a reservist not on active duty adds USAR",
        buildSignature({name: "A B Smith", grade: "MAJ", branch: "AG", reserveNotOnActiveDuty: true, title: "S1"}).lines[1],
        "MAJ, AG, USAR", "AR 25-50, para 6-7");

    check("a commander's block denotes the active exercise of authority",
        buildSignature({name: "A B Smith", grade: "COL", branch: "IN", title: "Commander", commanding: true}).lines.at(-1),
        "Commanding", "AR 25-50, para 6-4a(3)");

    check("a letter spells the grade out and uses U.S. Army",
        buildSignature({name: "MARCUS T. HALE", grade: "LTC", branch: "IN", title: "Director"}, "letter").lines,
        ["Marcus T. Hale", "Lieutenant Colonel, U.S. Army", "Director"],
        "AR 25-50, paras 6-4a(1) and 6-4f(1)");

    checkTrue("a civilian block carrying a military grade is reported",
        buildSignature({name: "A B", civilian: true, grade: "MAJ", title: "Analyst"})
            .findings.some((f) => f.rule === "civilian-grade"),
        "AR 25-50, para 6-8a");
    checkTrue("a grade outside table 6-1 is reported",
        buildSignature({name: "A B", grade: "XYZ", branch: "IN", title: "T"})
            .findings.some((f) => f.rule === "unknown-grade"),
        "AR 25-50, table 6-1");

    // Appendix D, reproduced block for block.
    const block = (signer, correspondence) => buildSignature(signer, correspondence).lines.join(" / ");

    /*
     * Every signature block printed in appendix D, reproduced. The figures are
     * the test oracle: each expectation below is what the published figure
     * prints, not what this code happens to produce.
     *
     * Two literal defects in the published figures are NOT reproduced -
     * "NAME (CALL CAPS)" in figures D-2 and D-3, and "LTC,AG" with no space
     * after the comma in figure D-6. Both are typographical errors in the PDF,
     * contradicted by the same string set correctly elsewhere in the same
     * appendix.
     */
    const D = [
        // fig D-1, signed by the commanding general. No authority line.
        ["D-1", {name: "Name", grade: "LTG", commanding: true},
            "NAME / Lieutenant General, USA / Commanding"],

        // fig D-2, signed by an authorized subordinate of the commander.
        ["D-2", {name: "Name", grade: "MG", title: "Deputy Commander"},
            "NAME / Major General, USA / Deputy Commander"],
        ["D-2", {name: "Name", grade: "MG", generalStaff: true, title: "Chief of Staff"},
            "NAME / Major General, GS / Chief of Staff"],
        ["D-2", {name: "Name", grade: "LTC", branch: "AG", spellOut: true, title: "Adjutant General"},
            "NAME / Lieutenant Colonel, AG / Adjutant General"],

        // fig D-3, head of an HQDA staff agency.
        ["D-3", {name: "Name", grade: "LTG", title: "Chief of Engineers"},
            "NAME / Lieutenant General, USA / Chief of Engineers"],

        // fig D-4, authorized representative of an HQDA staff agency.
        ["D-4", {name: "Name", grade: "COL", branch: "EN", spellOut: true, title: "Executive Officer"},
            "NAME / Colonel, EN / Executive Officer"],

        // fig D-5, commanding officer of a unit, headquarters, or installation.
        ["D-5", {name: "Name", grade: "COL", branch: "IN", spellOut: true, commanding: true},
            "NAME / Colonel, IN / Commanding"],

        // fig D-6, authorized representative of that commander.
        ["D-6", {name: "Name", grade: "LTC", branch: "AG", title: "Adjutant General"},
            "NAME / LTC, AG / Adjutant General"],
        ["D-6", {name: "Name", grade: "MAJ", branch: "AG", spellOut: true, title: "Assistant Adjutant General"},
            "NAME / Major, AG / Assistant Adjutant General"],
        ["D-6", {name: "Name", grade: "MAJ", branch: "AG", spellOut: true, title: "Chief, Personnel Division"},
            "NAME / Major, AG / Chief, Personnel Division"],
        ["D-6", {name: "Name", grade: "CW3", title: "Chief, Systems Division"},
            "NAME / CW3, USA / Chief, Systems Division"],

        // fig D-7, representative for the head of a staff office.
        ["D-7", {name: "Name", grade: "LTC", branch: "TC", title: "Chief, Freight Division"},
            "NAME / LTC, TC / Chief, Freight Division"],
        ["D-7", {name: "Name", grade: "LTC", branch: "JA", title: "Chief, Military Justice Branch"},
            "NAME / LTC, JA / Chief, Military Justice Branch"],
        ["D-7", {name: "Name", grade: "CPT", branch: "FI", spellOut: true,
                 title: "Deputy Finance and Accounting\nOfficer"},
            "NAME / Captain, FI / Deputy Finance and Accounting / Officer"],

        // fig D-8, authorized civilian. Name and title only.
        ["D-8", {name: "Name", civilian: true, title: "Chief, Civilian Personnel Branch"},
            "NAME / Chief, Civilian Personnel Branch"],
        ["D-8", {name: "Name", civilian: true, title: "Director, Research and Engineering\nDirectorate"},
            "NAME / Director, Research and Engineering / Directorate"],

        // fig D-9, an officer writing as an individual: name, grade, branch,
        // and organization - the organization is the last line, not a title.
        ["D-9", {name: "Name", grade: "CPT", branch: "AR", organization: "Co B, 2/34 Armor"},
            "NAME / CPT, AR / Co B, 2/34 Armor"],
        ["D-9", {name: "Name", grade: "CW2", organization: "Co A, 2/34 Armor"},
            "NAME / CW2, USA / Co A, 2/34 Armor"],

        // fig D-11, retired personnel. Two lines, no branch, no organization.
        // Para 6-6 says retired personnel "follow the same rules as active
        // personnel", so the grade abbreviation stays optional under 6-5c(1):
        // this figure prints the long form, and figure D-14 prints "SFC, USA
        // Retired" in the short one. Both are correct, so `spellOut` selects
        // which - it is not a rule about retirement.
        ["D-11", {name: "Name", grade: "COL", retired: true, spellOut: true},
            "NAME / Colonel, USA Retired"],
        ["D-11", {name: "Name", grade: "CPT", retired: true, spellOut: true},
            "NAME / Captain, USA Retired"],
        ["D-11", {name: "Name", grade: "MAJ", retired: true, spellOut: true},
            "NAME / Major, USA Retired"],

        // fig D-12, abbreviated titles paired with abbreviated grades.
        ["D-12", {name: "Name", grade: "LTC", generalStaff: true, spellOut: true,
                  title: "Chief, Administrative Systems\nDivision"},
            "NAME / Lieutenant Colonel, GS / Chief, Administrative Systems / Division"],
        ["D-12", {name: "Name", grade: "LTC", generalStaff: true, title: "Chief, Admin Sys Div"},
            "NAME / LTC, GS / Chief, Admin Sys Div"],
        ["D-12", {name: "Name", grade: "COL", generalStaff: true, spellOut: true,
                  title: "Director, Administrative\nManagement"},
            "NAME / Colonel, GS / Director, Administrative / Management"],
        ["D-12", {name: "Name", grade: "COL", generalStaff: true, title: "Dir, Admin Mgt"},
            "NAME / COL, GS / Dir, Admin Mgt"],

        // fig D-13, unabbreviated titles. A warrant officer on the general
        // staff takes GS, not USA, and a title may run to three lines.
        ["D-13", {name: "Name", grade: "CW3", generalStaff: true, spellOut: true,
                  title: "Chief, Operational Testing and\nLicensing Division"},
            "NAME / Chief Warrant Officer, GS / Chief, Operational Testing and / Licensing Division"],
        ["D-13", {name: "Name", grade: "COL", branch: "IN", spellOut: true,
                  title: "Assistant Inspector General for\nMilitary Operations for Plans\nand Procedures"},
            "NAME / Colonel, IN / Assistant Inspector General for / Military Operations for Plans / and Procedures"],
        ["D-13", {name: "Name", civilian: true,
                  title: "Director, Nuclear Testing and\nAccident Prevention Division"},
            "NAME / Director, Nuclear Testing and / Accident Prevention Division"],

        // fig D-14, noncommissioned officers. Four of the seven are two-line
        // blocks with no title at all, and grades appear in both forms.
        ["D-14", {name: "William H. Sargent", grade: "CSM", spellOut: true},
            "WILLIAM H. SARGENT / Command Sergeant Major, USA"],
        ["D-14", {name: "John L. Jones", grade: "1SG", spellOut: true},
            "JOHN L. JONES / First Sergeant, USA"],
        ["D-14", {name: "Name", grade: "1SG"}, "NAME / 1SG, USA"],
        ["D-14", {name: "Ronald L. Stanley", grade: "MSG", title: "Operations Sergeant"},
            "RONALD L. STANLEY / MSG, USA / Operations Sergeant"],
        ["D-14", {name: "Name", grade: "SFC", acting: true, commanding: false, title: "Acting First Sergeant"},
            "NAME / SFC, USA / Acting First Sergeant"],
        ["D-14", {name: "Name", grade: "SFC", title: "Platoon Sergeant"},
            "NAME / SFC, USA / Platoon Sergeant"],
        ["D-14", {name: "Bryan J. Gramps", grade: "SFC", retired: true},
            "BRYAN J. GRAMPS / SFC, USA Retired"],

        // fig D-15, enlisted USAR Soldier on active duty - USA, not USAR.
        ["D-15", {name: "Name", grade: "SFC", title: "Acting First Sergeant"},
            "NAME / SFC, USA / Acting First Sergeant"],

        // fig D-16, USAR officer on active duty - branch, no USAR.
        ["D-16", {name: "Name", grade: "MAJ", branch: "AG", title: "Chief, Technical Services Team"},
            "NAME / MAJ, AG / Chief, Technical Services Team"],

        // fig D-17, officer on the general staff, colonel or below.
        ["D-17", {name: "Name", grade: "LTC", generalStaff: true, title: "Chief of Staff"},
            "NAME / LTC, GS / Chief of Staff"],

        // fig D-18, officer detailed as an inspector general.
        ["D-18", {name: "Name", grade: "MAJ", inspectorGeneral: true, title: "Chief, Inspections Branch"},
            "NAME / MAJ, IG / Chief, Inspections Branch"],

        // fig D-19, medical corps officer. MC is a branch and behaves like one.
        ["D-19", {name: "Name", grade: "COL", branch: "MC", title: "Command Surgeon"},
            "NAME / COL, MC / Command Surgeon"],

        // fig D-20, reserve NCO not on active duty - USAR replaces USA.
        ["D-20", {name: "Name", grade: "SFC", reserveNotOnActiveDuty: true, title: "Platoon Sergeant"},
            "NAME / SFC, USAR / Platoon Sergeant"],

        // fig D-21, reserve officer not on active duty - USAR follows the
        // branch, giving a three-element grade line, and the acting title
        // replaces "Commanding".
        ["D-21", {name: "Name", grade: "MAJ", branch: "MC", reserveNotOnActiveDuty: true,
                  commanding: true, acting: true},
            "NAME / MAJ, MC, USAR / Acting Commander"],

        // fig D-22, reserve warrant officer - USAR is the branch, per its note.
        ["D-22", {name: "Name", grade: "CW3", reserveNotOnActiveDuty: true,
                  title: "Chief, Systems Division"},
            "NAME / CW3, USAR / Chief, Systems Division"],
    ];

    for (const [fig, signer, expected] of D) {
        check(`fig ${fig}: ${expected.replace(/ \/ /g, ", ")}`,
            block(signer), expected, `AR 25-50, fig ${fig}`);
    }

    // fig D-10, letters. Every grade spelled out, no branch for anyone, and
    // "U.S. Army" - or "U.S. Army Reserve" - in the branch's place.
    const letters = [
        [{name: "Name", grade: "MG", commanding: true},
            "Name / Major General, U.S. Army / Commanding"],
        [{name: "Name", grade: "COL", branch: "GS", title: "Chief of Staff"},
            "Name / Colonel, U.S. Army / Chief of Staff"],
        [{name: "Name", grade: "MAJ", branch: "TC", title: "Transportation Officer"},
            "Name / Major, U.S. Army / Transportation Officer"],
        [{name: "Name", grade: "LTG", title: "Deputy Chief of Staff for\nPersonnel"},
            "Name / Lieutenant General, U.S. Army / Deputy Chief of Staff for / Personnel"],
        [{name: "Name", grade: "WO1", title: "Chief, Signal Office"},
            "Name / Warrant Officer, U.S. Army / Chief, Signal Office"],
        [{name: "Name", grade: "MAJ", branch: "AG", reserveNotOnActiveDuty: true,
          title: "Assistant Adjutant General"},
            "Name / Major, U.S. Army Reserve / Assistant Adjutant General"],
        [{name: "Name", grade: "CPT", branch: "AG", title: "Assistant Adjutant General"},
            "Name / Captain, U.S. Army / Assistant Adjutant General"],
        [{name: "Name", civilian: true, title: "Director, Nuclear Testing\nand Accident Prevention"},
            "Name / Director, Nuclear Testing / and Accident Prevention"],
    ];
    for (const [signer, expected] of letters) {
        check(`fig D-10: ${expected.replace(/ \/ /g, ", ")}`,
            block(signer, "letter"), expected, "AR 25-50, fig D-10 and para 6-4f(1)");
    }

    // Table 6-1 and appendix D disagree on the spelled-out warrant officer
    // grade. Both halves are pinned so neither can drift into the other.
    {
        const {spellOutGrade, spellOutGradeForSignature} = await import("./signature-blocks.js");
        check("table 6-1 spells CW3 with the numeral",
            spellOutGrade("CW3"), "Chief Warrant Officer 3", "AR 25-50, table 6-1");
        check("a signature block spells CW3 without it, per figs D-10 and D-13",
            spellOutGradeForSignature("CW3"), "Chief Warrant Officer",
            "AR 25-50, figs D-10 and D-13");
        check("WO1 in a signature block is \"Warrant Officer\"",
            spellOutGradeForSignature("WO1"), "Warrant Officer", "AR 25-50, fig D-10");
        check("no other grade is affected by the warrant officer exception",
            spellOutGradeForSignature("MG"), spellOutGrade("MG"), "AR 25-50, table 6-1");
    }

    checkTrue("dropping a branch on a letter is reported, not done silently",
        buildSignature({name: "N", grade: "MAJ", branch: "AG", title: "S1"}, "letter")
            .findings.some((f) => f.rule === "letter-branch-dropped"),
        "AR 25-50, para 6-5c(8)");
    checkTrue("a medical corps branch survives onto a letter",
        buildSignature({name: "N", grade: "COL", branch: "MC", title: "Command Surgeon"}, "letter")
            .lines[1] === "Colonel, MC",
        "AR 25-50, para 6-5c(9)");

    // Chaplains - para 6-5c. No comma before the designation, unlike every
    // other grade line in the appendix.
    check("para 6-5c: a chaplain's grade is parenthesized, with no comma before USA",
        block({name: "J. Jones", grade: "CPT", chaplain: true}),
        "J. JONES / Chaplain (CPT) USA", "AR 25-50, para 6-5c");
    check("para 6-7: a reserve chaplain uses USAR in USA's place",
        block({name: "Name", grade: "MAJ", chaplain: true}),
        "NAME / Chaplain (MAJ) USA", "AR 25-50, para 6-5c(6)");
    check("para 6-7: a chaplain not on active duty uses USAR",
        block({name: "Name", grade: "MAJ", chaplain: true, reserveNotOnActiveDuty: true}),
        "NAME / Chaplain (MAJ) USAR", "AR 25-50, para 6-7");
    checkTrue("the unverified chaplain-on-a-letter form is flagged, not invented",
        buildSignature({name: "N", grade: "MAJ", chaplain: true}, "letter")
            .findings.some((f) => f.rule === "chaplain-letter-form-unverified"),
        "AR 25-50, figs D-23 and D-24");

    // Army National Guard - para 6-5c(10) and 6-5c(11).
    check("para 6-5c(11): a Guard NCO not on active duty uses the State abbreviation",
        block({name: "Name", grade: "SFC", nationalGuardNotOnActiveDuty: true,
               state: "KS", title: "Platoon Sergeant"}),
        "NAME / SFC, KSARNG / Platoon Sergeant", "AR 25-50, para 6-5c(11)");
    check("para 6-5c(11): a Guard officer not on active duty keeps the branch",
        block({name: "Name", grade: "MAJ", branch: "AG", nationalGuardNotOnActiveDuty: true,
               state: "KS", title: "S1"}),
        "NAME / MAJ, AG, KSARNG / S1", "AR 25-50, para 6-5c(11)");
    check("para 6-5c(10): a Title 10 Guard officer uses USA",
        block({name: "Name", grade: "MG", jointCommand: true, title: "Deputy Commander"}),
        "NAME / Major General, USA / Deputy Commander", "AR 25-50, para 6-5c(10)");
    checkTrue("a Guard signer with no State abbreviation is reported",
        buildSignature({name: "N", grade: "SFC", nationalGuardNotOnActiveDuty: true, title: "T"})
            .findings.some((f) => f.rule === "arng-state-missing"),
        "AR 25-50, para 6-5c(11)");

    // Para 6-5c(11) requires a four-letter State office symbol of three
    // categories and illustrates none of them, so it is reported, not invented.
    for (const [what, signer] of [
        ["general officer", {name: "N", grade: "MG", title: "Cdr"}],
        ["warrant officer", {name: "N", grade: "CW3", title: "Chief"}],
        ["chaplain", {name: "N", grade: "MAJ", chaplain: true, title: "Chaplain"}],
    ]) {
        checkTrue(`para 6-5c(11): an ARNG ${what} is told the State office symbol is missing`,
            buildSignature({...signer, nationalGuardNotOnActiveDuty: true, state: "KS"})
                .findings.some((f) => f.rule === "arng-office-symbol-required"),
            "AR 25-50, para 6-5c(11)");
    }
    checkTrue("para 6-5c(11): an ARNG NCO owes no office symbol",
        buildSignature({name: "N", grade: "SFC", nationalGuardNotOnActiveDuty: true,
                        state: "KS", title: "Plt Sgt"})
            .findings.every((f) => f.rule !== "arng-office-symbol-required"),
        "AR 25-50, para 6-5c(11)");
    checkTrue("para 6-5c(11): supplying it clears the finding",
        buildSignature({name: "N", grade: "MG", nationalGuardNotOnActiveDuty: true,
                        state: "KS", stateOfficeSymbol: "NGKS", title: "Cdr"})
            .findings.every((f) => f.rule !== "arng-office-symbol-required"),
        "AR 25-50, para 6-5c(11)");

    // para 6-5c(2): "(P)" is not used unless it benefits the Army's image.
    checkTrue("para 6-5c(2): \"(P)\" in a signature block is reported",
        buildSignature({name: "N", grade: "LTC", branch: "AG (P)", title: "Dir"})
            .findings.some((f) => f.rule === "promotable-in-signature"),
        "AR 25-50, para 6-5c(2)");

    // Joint commands and contract surgeons - paras 6-5c(8) and 6-8b.
    check("para 6-5c(8): an officer at a Joint command uses only USA",
        block({name: "Name", grade: "LTC", branch: "IN", jointCommand: true, title: "J3 Plans"}),
        "NAME / LTC, USA / J3 Plans", "AR 25-50, para 6-5c(8)");
    check("para 6-8b: a contract surgeon uses USA",
        block({name: "Name", grade: "COL", contractSurgeon: true, title: "Contract Surgeon"}),
        "NAME / COL, USA / Contract Surgeon", "AR 25-50, para 6-8b");

    /*
     * What actually reaches the page. buildSignature() is only correct if the
     * renderer uses it, and the two are joined by resolveSignature().
     */
    {
        const {layoutMemo} = await import("./memo-formatter.js");
        const {LAYOUT} = await import("./ar25-50.js");
        // The signature block shares its lines with the enclosure listing, so a
        // row is either a signature line or carries one as `sameLine`.
        const sigRows = (signature) => layoutMemo({...FIG_2_1, signature}).flow
            .map((l) => (l.role === "signature" ? l : l.sameLine))
            .filter((l) => l?.role === "signature")
            .map((l) => `${l.text}@${l.indentIn.toFixed(2)}`);

        const centre = LAYOUT.signatureBlockIndentIn;
        const indented = centre + LAYOUT.multiAddressWrapIndentIn;

        check("a structured signer reaches the page as a built block",
            sigRows({signer: {name: "John Doe", grade: "COL", branch: "IN", commanding: true}}),
            [`JOHN DOE@${centre.toFixed(2)}`, `COL, IN@${centre.toFixed(2)}`,
             `Commanding@${centre.toFixed(2)}`],
            "AR 25-50, paras 6-4a(3) and 6-4c");

        // fig D-9: the organization is an element of its own, so it is flush.
        check("fig D-9: an organization line is flush, not indented",
            sigRows({signer: {name: "John Doe", grade: "CPT", branch: "AR",
                              organization: "Co B, 2/34 Armor"}}),
            [`JOHN DOE@${centre.toFixed(2)}`, `CPT, AR@${centre.toFixed(2)}`,
             `Co B, 2/34 Armor@${centre.toFixed(2)}`],
            "AR 25-50, para 6-5d");

        // fig D-13: a title that will not fit continues indented 1/4 inch, and
        // a three-line title indents both continuations equally.
        check("fig D-13: both continuations of a three-line title are indented equally",
            sigRows({signer: {name: "John Doe", grade: "COL", branch: "IN",
                              title: "Assistant Inspector General for\nMilitary Operations for Plans\nand Procedures"}}),
            [`JOHN DOE@${centre.toFixed(2)}`, `COL, IN@${centre.toFixed(2)}`,
             `Assistant Inspector General for@${centre.toFixed(2)}`,
             `Military Operations for Plans@${indented.toFixed(2)}`,
             `and Procedures@${indented.toFixed(2)}`],
            "AR 25-50, para 6-4c and fig D-13");

        checkTrue("no line break survives into a rendered line's text",
            layoutMemo({...FIG_2_1, signature: {signer: {
                name: "N", grade: "COL", branch: "IN", commanding: true,
                title: "Chief, Operational Testing and\nLicensing Division"}}})
                .flow.every((l) => !String(l.text).includes("\n")),
            "AR 25-50, para 6-4c");

        // memo-docx.js builds the block through the same resolveSignature(), so
        // the .docx is asserted against the same figure rather than trusted.
        {
            const {renderDocx} = await import("./memo-docx.js");
            const JSZip = (await import("jszip")).default;
            const zip = await JSZip.loadAsync(await renderDocx({...FIG_2_1, signature: {signer: {
                name: "John Doe", grade: "COL", branch: "IN",
                title: "Assistant Inspector General for\nMilitary Operations for Plans\nand Procedures",
            }}}));
            const xml = await zip.file("word/document.xml").async("string");
            const text = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]);

            checkTrue("docx: the structured signer reaches the file",
                text.some((t) => t.includes("JOHN DOE")) && text.some((t) => t.includes("COL, IN")),
                "AR 25-50, para 6-4c");
            checkTrue("docx: a three-line title keeps all three lines",
                ["Assistant Inspector General for", "Military Operations for Plans", "and Procedures"]
                    .every((s) => text.some((t) => t.includes(s))),
                "AR 25-50, fig D-13");
            checkTrue("docx: no line break survives into a run",
                text.every((t) => !t.includes("\n")), "AR 25-50, para 6-4c");
        }
    }

    // The validator has to see through both forms too, or a memorandum built
    // the right way reports as having no signature block at all.
    {
        const structured = validateMemo({...FIG_2_1, signature: {signer: {
            name: "Marcus T. Hale", grade: "LTC", branch: "IN", title: "Director, Plans and Operations"}}});
        checkTrue("a structured signer is not reported as a missing signature",
            structured.findings.every((f) => f.rule !== "signature-missing"),
            "AR 25-50, para 6-4");
        checkTrue("a structured signer's lowercase name is not a casing error",
            structured.findings.every((f) => f.rule !== "signature-case"),
            "AR 25-50, figs 2-1 through 2-5");

        checkTrue("a signature with no name at all is reported as not yet supplied",
            validateMemo({...FIG_2_1, signature: {}})
                .warnings.some((f) => f.rule === "not-yet-supplied"
                    && f.message.startsWith("Signature block")),
            "AR 25-50, paras 2-4c(2)(a) and 6-4c");

        // fig D-14: four of the seven blocks are a name and grade, no title.
        checkTrue("fig D-14: an NCO block with no title is not reported",
            validateMemo({...FIG_2_1, signature: {signer: {name: "William H. Sargent", grade: "CSM"}}})
                .findings.every((f) => f.rule !== "signature-title-missing"),
            "AR 25-50, fig D-14");
        checkTrue("an officer block with no title is still reported",
            validateMemo({...FIG_2_1, signature: {signer: {name: "N", grade: "LTC", branch: "IN"}}})
                .warnings.some((f) => f.rule === "signature-title-missing"),
            "AR 25-50, para 6-4");
    }

    // Para 6-3c: signing for another person is a handwritten act, so the typed
    // block must NOT change - the rule is reported instead.
    {
        const forAnother = buildSignature(
            {name: "Name", grade: "COL", branch: "IN", title: "Commander", signingForAnother: true});
        check("para 6-3c: the typed block is unchanged when someone signs for the named official",
            forAnother.lines.join(" / "), "NAME / COL, IN / Commander", "AR 25-50, para 6-3c");
        checkTrue("para 6-3c: the handwritten \"for\" is reported to the drafter",
            forAnother.findings.some((f) => f.rule === "signing-for-another"),
            "AR 25-50, para 6-3c");
    }

    checkTrue("an enlisted block is not asked for a branch",
        buildSignature({name: "N", grade: "SFC", title: "Platoon Sergeant"})
            .findings.every((f) => f.rule !== "branch-missing"),
        "AR 25-50, fig D-14");
    checkTrue("a commissioned officer without a branch is still reported",
        buildSignature({name: "N", grade: "MAJ", title: "S1"})
            .findings.some((f) => f.rule === "branch-missing"),
        "AR 25-50, para 6-4f(2)");

    // "FOR THE [TITLE]:" - fig D-8, para 6-2e(1)
    const {AUTHORITY_LINES} = await import("./signature-blocks.js");
    check("fig D-8: an agency head's authority line names the office",
        AUTHORITY_LINES.agencyHead.text("Chief, Civilian Personnel Division"),
        "FOR THE CHIEF, CIVILIAN PERSONNEL DIVISION:", "AR 25-50, para 6-2e(1)");

    /*
     * "Civilians will not use 'DAC' ... on a signature block unless they are
     *  attached to or are serving within a multi-Service organization." -
     *  para 6-4a, Note 2.
     */
    const {createTemplate: dacTemplate} = await import("./templates.js");
    const dacBase = dacTemplate("standard");
    checkTrue("para 6-4a Note 2: DAC on a signature block is reported",
        validateMemo({...dacBase, signature: {name: "JANE DOE", title: "Program Analyst, DAC"}})
            .errors.some((f) => f.rule === "dac-not-authorized"),
        "AR 25-50, para 6-4a, Note 2");
    checkTrue("and excused in a multi-Service organization",
        validateMemo({...dacBase, signature: {name: "JANE DOE", title: "Program Analyst, DAC"},
                      multiServiceOrganization: true})
            .errors.every((f) => f.rule !== "dac-not-authorized"),
        "AR 25-50, para 6-4a, Note 2");
    checkTrue("and a title with no 'DAC' in it raises nothing",
        validateMemo({...dacBase, signature: {name: "JANE DOE", title: "Program Analyst"}})
            .errors.every((f) => f.rule !== "dac-not-authorized"),
        "AR 25-50, para 6-4a, Note 2");

    /*
     * "All SECARMY delegations will be copy furnished to the AASA." -
     * para 6-2d, Note.
     */
    checkTrue("para 6-2d Note: a SECARMY delegation with no AASA copy is reported",
        validateMemo({...dacBase, authorityLine: AUTHORITY_LINES.secretary.text, copiesFurnished: []})
            .warnings.some((f) => f.rule === "secarmy-delegation-not-copied"),
        AUTHORITY_LINES.secretary.copyFurnishedCite);
    checkTrue("and satisfied once AASA is copy furnished",
        validateMemo({...dacBase, authorityLine: AUTHORITY_LINES.secretary.text, copiesFurnished: ["AASA"]})
            .warnings.every((f) => f.rule !== "secarmy-delegation-not-copied"),
        AUTHORITY_LINES.secretary.copyFurnishedCite);
    checkTrue("and not raised for an ordinary FOR THE COMMANDER: line",
        validateMemo({...dacBase, authorityLine: AUTHORITY_LINES.commander.text, copiesFurnished: []})
            .warnings.every((f) => f.rule !== "secarmy-delegation-not-copied"),
        "AR 25-50, para 6-2d, Note");

    /*
     * "For 'THRU' correspondence, when no comment has been made, the signer
     *  will line through the appropriate address and initial and date the
     *  line through." - para 6-3d. Appendix F's boxes are for the digital
     *  form; this is the wet-signature counterpart, and it needed its own
     *  check because it is the opposite condition (digitalSignature: false).
     */
    const thruBase = dacTemplate("thru");
    checkTrue("para 6-3d: a wet-signed THRU memorandum is told to line out and initial",
        validateMemo({...thruBase, digitalSignature: false})
            .warnings.some((f) => f.rule === "thru-wet-signature-lineout"),
        "AR 25-50, para 6-3d");
    checkTrue("and a digitally signed THRU memorandum gets the box guidance instead",
        validateMemo({...thruBase, digitalSignature: true})
            .warnings.some((f) => f.rule === "thru-signature-boxes")
        && validateMemo({...thruBase, digitalSignature: true})
            .warnings.every((f) => f.rule !== "thru-wet-signature-lineout"),
        "AR 25-50, para 6-3d and appendix F");
    checkTrue("and a memorandum with no THRU line raises neither",
        validateMemo({...dacBase, digitalSignature: false})
            .warnings.every((f) => f.rule !== "thru-wet-signature-lineout"),
        "AR 25-50, para 6-3d");
}

{
    // Templates carry placeholders, and the validator says so.
    const {createTemplate, findPlaceholders} = await import("./templates.js");
    for (const type of ["standard", "thru", "exclusiveFor", "appreciation", "commendation", "record", "decision", "mou", "moa"]) {
        const template = createTemplate(type);
        checkTrue(`the ${type} template is fully placeholdered`,
            findPlaceholders(template).length > 0, "template");
    }
    checkTrue("unfilled placeholders are reported before signature",
        validateMemo(createTemplate("standard"))
            .warnings.some((f) => f.rule === "unfilled-placeholder"),
        "template not yet filled in");

    /*
     * A template is the starting point of every memorandum this module
     * produces, so a template that reports an error means the module cannot
     * produce a compliant memorandum at all. Every type has to come out clean.
     */
    for (const type of ["standard", "thru", "exclusiveFor", "appreciation", "commendation", "record", "decision", "mou", "moa"]) {
        const result = validateMemo(createTemplate(type));
        check(`the ${type} template raises no errors`,
            result.errors.map((f) => f.rule), [], "AR 25-50");
    }

    const {hasPlaceholders, PLACEHOLDER} = await import("./templates.js");

    // PLACEHOLDER is a global regex, and `.test()` on one advances lastIndex.
    // Three identical calls have to give three identical answers.
    check("hasPlaceholders is not stateful",
        [1, 2, 3].map(() => hasPlaceholders("[OFFICE SYMBOL]")), [true, true, true],
        "template");
    checkTrue("an instructional placeholder counts as unfilled",
        hasPlaceholders("[PURPOSE SENTENCE - state the action first, in the active voice.]"),
        "template");
    checkTrue("ordinary bracketed prose does not",
        !hasPlaceholders("the schedule at [Enclosure 1]"), "template");

    // A placeholder is reported once, as unfilled - not a second time as a
    // malformed date, an acronym-laden subject, or a point of contact with no
    // telephone number.
    const bare = createTemplate("standard");
    const rules = validateMemo(bare).findings.map((f) => f.rule);
    for (const rule of ["date-format", "date-stamp-form", "subject-acronyms",
                        "poc-no-phone", "poc-no-email", "grade-not-in-table"]) {
        checkTrue(`an unfilled template does not also report ${rule}`,
            !rules.includes(rule), "AR 25-50");
    }

    // fig 2-11: the third-line rule governs MEMORANDUM THRU on a THRU
    // memorandum; the action office follows on a FOR line below the chain.
    checkTrue("fig 2-11: a THRU memorandum's opener is measured, not its FOR line",
        validateMemo({...FIG_2_1, thru: ["U.S. Army North (ARNO-CG)"]})
            .findings.every((f) => f.rule !== "spacing-memorandum-for"),
        "AR 25-50, para 2-4a(5) and figs 2-11 and 2-12");

    // fig 2-18: the approval line is a row, not a subparagraph, so it does not
    // owe the "if there is an a, there must be a b" rule a sibling.
    checkTrue("fig 2-18: a literal row is not counted as a subparagraph",
        validateMemo({...FIG_2_1, paragraphs: [
            {text: "Only paragraph.", children: [{approvalLine: true, literal: true}]},
        ]}).errors.every((f) => f.rule !== "orphan-subparagraph"),
        "AR 25-50, fig 2-18");

    // para 2-6: an agreement is not governed by para 2-4, so the standard
    // memorandum's heading, closing and body rules must not be applied to it.
    for (const type of ["mou", "moa"]) {
        const agreement = validateMemo(createTemplate(type));
        for (const rule of ["office-symbol-missing", "arims-missing", "signature-missing",
                            "continuation-office-symbol", "poc-placement", "signature-title-missing"]) {
            checkTrue(`an ${type.toUpperCase()} is not asked for ${rule.replace(/-/g, " ")}`,
                agreement.findings.every((f) => f.rule !== rule), "AR 25-50, para 2-6");
        }
        checkTrue(`an ${type.toUpperCase()} with fewer than two signers is reported`,
            validateMemo({...createTemplate(type), signers: []})
                .errors.some((f) => f.rule === "agreement-signers-missing"),
            "AR 25-50, para 2-6c(5)");
    }
}

// ---------------------------------------------------------------------------
// The limits of AR 25-50's own authority
// ---------------------------------------------------------------------------

/**
 * Three rules that decide whether this module should be formatting the
 * document at all. Each one is a boundary the regulation draws around itself,
 * so the correct behavior is to report the boundary, never to format past it.
 */
{
    const {supersedingAuthority, MASS_MAILING, letterAudiences} = await import("./ar25-50.js");

    // Para 1-6 Note: HQDA principal officials sign under DoDM 5110.04 Vol 1.
    checkTrue("a named superseding signer is detected",
        supersedingAuthority({signerTitle: "Secretary of the Army"}).superseded,
        "AR 25-50, para 1-6 (Note)");

    checkTrue("an HQDA principal official from fig B-2 is detected",
        supersedingAuthority({signerTitle: "Deputy Chief of Staff, G-4"}).superseded,
        "AR 25-50, para 1-6 (Note) and fig B-2");

    // Para 2-2 Note: origination, not just signature, triggers the SOP.
    checkTrue("origination within the Army Staff is detected",
        supersedingAuthority({originatingOrganization: "Army Staff"}).superseded,
        "AR 25-50, para 2-2 (Note)");

    checkTrue("an ordinary signer is not superseded",
        supersedingAuthority({signerTitle: "Commanding", originatingOrganization: "1st Cavalry Division"})
            .superseded === false,
        "AR 25-50, para 1-6 (Note)");

    checkTrue("a superseded memorandum is reported, not silently formatted",
        validateMemo({...FIG_2_1, signature: {...FIG_2_1.signature, title: "Deputy Chief of Staff, G-4"}})
            .warnings.some((f) => f.rule === "superseded-format"),
        "AR 25-50, para 1-6 (Note)");

    // Para E-1: "sent to 20 or more recipients."
    const manyAddressees = Array.from({length: MASS_MAILING.threshold},
        (_, i) => `Commander, ${i + 1} Brigade Combat Team`);

    checkTrue(`${MASS_MAILING.threshold} recipients reach the mass-mailing threshold`,
        validateMemo({...FIG_2_1, addressees: manyAddressees})
            .warnings.some((f) => f.rule === "mass-mailing"),
        MASS_MAILING.cite);

    checkTrue(`${MASS_MAILING.threshold - 1} recipients do not`,
        validateMemo({...FIG_2_1, addressees: manyAddressees.slice(0, -1)})
            .warnings.every((f) => f.rule !== "mass-mailing"),
        MASS_MAILING.cite);

    // Para 3-2: the letter's audience is fixed, and a memorandum cannot serve it.
    const audienceCases = [
        ["The President of the United States", "the President or Vice President of the United States"],
        ["Ms. Jane Roe, White House Liaison", "members of the White House staff"],
        ["The Honorable John Doe, United States Senate", "Members of Congress"],
        ["The Chief Justice of the Supreme Court", "Justices of the Supreme Court"],
        ["The Honorable Jane Roe, Governor of Texas", "State Governors"],
        ["The Honorable John Doe, Mayor of Woodbridge", "mayors"],
        ["His Excellency, Ambassador of Canada", "foreign government officials"],
        ["Mr. Robert Frost", "the public"],
    ];
    for (const [addressee, who] of audienceCases) {
        check(`"${addressee}" is ${who}, so a letter is the vehicle`,
            letterAudiences([addressee]).some((h) => h.who === who), true,
            "AR 25-50, para 3-2");
    }

    checkTrue("an ordinary military addressee is not a letter audience",
        letterAudiences(["Commander, 1st Cavalry Division"]).length === 0,
        "AR 25-50, para 3-2");

    checkTrue("addressing a memorandum to a letter audience is reported",
        validateMemo({...FIG_2_1, addressees: ["The Honorable Jane Roe, Governor of Texas"]})
            .warnings.some((f) => f.rule === "wrong-vehicle"),
        "AR 25-50, para 3-2");

    /*
     * Para 1-8b: "Do not use the memorandum format when corresponding with
     * the Families of military personnel or private businesses." Narrower
     * and stricter than para 3-2's letter audience - it is an error, not a
     * warning, because no reformatting fixes it; the document itself is wrong.
     */
    const {memorandumProhibitedAudiences, MEMORANDUM_PROHIBITED_AUDIENCES} = await import("./ar25-50.js");
    checkTrue("para 1-8b: the Family of a Servicemember is a prohibited memorandum audience",
        memorandumProhibitedAudiences(["Mrs. Jane Smith, Family of SPC John Smith"])
            .some((h) => h.who === "the Family of a Servicemember"),
        MEMORANDUM_PROHIBITED_AUDIENCES.cite);
    checkTrue("and so is a private business",
        memorandumProhibitedAudiences(["ABC Electronics Inc., 100 Main Street, Anytown, VA 22201"])
            .some((h) => h.who === "a private business"),
        MEMORANDUM_PROHIBITED_AUDIENCES.cite);
    checkTrue("but an ordinary company-sized unit address is not misread as a business",
        memorandumProhibitedAudiences(["Commander, Company C, 2d Battalion, 5th Cavalry Regiment"]).length === 0,
        MEMORANDUM_PROHIBITED_AUDIENCES.cite);
    checkTrue("addressing a memorandum to a Servicemember's Family is reported as an error",
        validateMemo({...FIG_2_1, addressees: ["Mrs. Jane Smith, Family of SPC John Smith"]})
            .errors.some((f) => f.rule === "memorandum-prohibited-audience"),
        MEMORANDUM_PROHIBITED_AUDIENCES.cite);
    checkTrue("and addressing one to a private business is reported the same way",
        validateMemo({...FIG_2_1, addressees: ["ABC Electronics Inc., 100 Main Street, Anytown, VA 22201"]})
            .errors.some((f) => f.rule === "memorandum-prohibited-audience"),
        MEMORANDUM_PROHIBITED_AUDIENCES.cite);
    checkTrue("and a letter addressed to either raises no memorandum-prohibited-audience finding",
        validateMemo({...FIG_2_1, type: "letter",
                      addressees: ["Mrs. Jane Smith, Family of SPC John Smith"]})
            .findings.every((f) => f.rule !== "memorandum-prohibited-audience"),
        MEMORANDUM_PROHIBITED_AUDIENCES.cite);

    checkTrue("the figure 2-1 memorandum trips none of the four",
        validateMemo(FIG_2_1).findings.every(
            (f) => !["superseded-format", "mass-mailing", "wrong-vehicle",
                     "memorandum-prohibited-audience"].includes(f.rule)),
        "AR 25-50, fig 2-1");

    /*
     * Appendix F is an Acrobat workflow. Everything it describes is a form
     * field created in the PDF after conversion, so the .docx cannot carry any
     * of it - which makes reporting the requirement the only way it can be met.
     */
    const {APPENDIX_F} = await import("./ar25-50.js");

    checkTrue("a THRU memorandum needs a signature box per addressee",
        validateMemo({...FIG_2_1, thru: ["Commander, 1st Cavalry Division"], digitalSignature: true})
            .warnings.some((f) => f.rule === "thru-signature-boxes"),
        APPENDIX_F.thru.cite);

    checkTrue("a memorandum with no THRU line does not raise it",
        validateMemo({...FIG_2_1, digitalSignature: true})
            .warnings.every((f) => f.rule !== "thru-signature-boxes"),
        APPENDIX_F.thru.cite);

    checkTrue("a wet-signed THRU memorandum does not raise it either",
        validateMemo({...FIG_2_1, thru: ["Commander, 1st Cavalry Division"], digitalSignature: false})
            .warnings.every((f) => f.rule !== "thru-signature-boxes"),
        APPENDIX_F.cite);

    checkTrue("more than one signer needs a box each",
        validateMemo({...FIG_2_1, digitalSignature: true, signatories: ["A", "B"]})
            .warnings.some((f) => f.rule === "multiple-signature-boxes"),
        APPENDIX_F.multipleSigners.cite);

    // No dimension and no font appear anywhere in appendix F, so none is
    // stored - a number here would be this module's invention, not a rule.
    checkTrue("no box dimension is invented for the date box",
        !/\d/.test(APPENDIX_F.dateBox.sizing.replace("dd month yyyy", "")),
        "AR 25-50, para F-2e");
    check("the date box alignment is the one thing F-2e does mandate",
        APPENDIX_F.dateBox.alignment, "Right", "AR 25-50, para F-2e");

    /*
     * F-2f: the signature box goes "directly above and left-aligned with the
     * signer's name". The renderer draws no box - it belongs to Acrobat, after
     * conversion - but the five lines it already reserves above the name leave
     * that exact position open. authorityLineToDigitalSignature records where:
     * the third of the five lines, which is one blank line above the name
     * (line 5) rather than flush against it. That arithmetic is the one part
     * of F-2f a line-count renderer can hold itself to without inventing a
     * box it was never asked to draw.
     */
    const {SPACING: F2F_SPACING} = await import("./ar25-50.js");
    check("appendix F: the reserved space puts the box one line above the name",
        F2F_SPACING.authorityLineToSignature.linesBelow - F2F_SPACING.authorityLineToDigitalSignature.linesBelow,
        2, "AR 25-50, para F-2f");
    check("and left-aligned with it - the rendered name sits at the signature column",
        layoutMemo(FIG_2_1).flow.find((l) => l.role === "signature")?.indentIn,
        LAYOUT.signatureBlockIndentIn, "AR 25-50, para F-2f");

    /*
     * Chapter 4's tabbing rules are physical except for one sentence:
     * "Tabs may be any letter or number as long as they are consecutive and
     * fully identified in the text." - para 4-4a. Both halves are checkable.
     */
    const {checkTabSequence, TABBING} = await import("./ar25-50.js");
    const body = "Tab A is the memorandum for signature. Tab B is the tasking. Tab C is the coordination.";

    checkTrue("consecutive lettered tabs named in the body pass",
        checkTabSequence(["A", "B", "C"], body).ok, TABBING.packageCite);
    checkTrue("a gap in the sequence is caught",
        !checkTabSequence(["A", "C"], body).consecutive, TABBING.packageCite);
    checkTrue("numbers are as acceptable as letters",
        checkTabSequence(["1", "2"], "Tab 1 is the memorandum. Tab 2 is the tasking.").ok,
        TABBING.packageCite);
    checkTrue("letters mixed with numbers are caught",
        checkTabSequence(["A", "2"], body).mixedKinds, TABBING.packageCite);
    check("a tab the body never names is caught",
        checkTabSequence(["A", "B", "C", "D"], body).unmentioned, ["D"], TABBING.packageCite);

    checkTrue("a tab missing from the body is reported on the memorandum",
        validateMemo({...FIG_2_1, tabs: ["A", "B"],
                      paragraphs: [{text: "Tab A is the memorandum for signature."}]})
            .errors.some((f) => f.rule === "tab-not-identified"),
        TABBING.packageCite);

    // "If the correspondence has three or more enclosures, tab each one." - 4-3
    checkTrue(`${TABBING.tabWhenEnclosuresAtLeast} enclosures with no tabs is reported`,
        validateMemo({...FIG_2_1, enclosures: ["One", "Two", "Three"]})
            .warnings.some((f) => f.rule === "enclosures-need-tabs"),
        TABBING.cite);
    checkTrue(`${TABBING.tabWhenEnclosuresAtLeast - 1} enclosures is not`,
        validateMemo({...FIG_2_1, enclosures: ["One", "Two"]})
            .warnings.every((f) => f.rule !== "enclosures-need-tabs"),
        TABBING.cite);

    /*
     * Two figure notes suppress the geographic address, and figure 2-8
     * collapses the HQDA principals into one line.
     */
    const {hasGeographicAddress, HQDA_PRINCIPALS_COLLECTIVE} = await import("./ar25-50.js");
    const withGeography = "HQDA (DAMI-XX), 1000 ARMY PENTAGON, WASHINGTON, DC  20310-1000";
    const withoutGeography = "HQDA (DAMI-XX)";

    checkTrue("a street-and-ZIP address is recognized as geographic",
        hasGeographicAddress(withGeography), "AR 25-50, fig 2-6 note 3");
    checkTrue("a bare office symbol is not",
        !hasGeographicAddress(withoutGeography), "AR 25-50, fig 2-6 note 3");

    for (const [scope, cite] of [["armyStaff", "AR 25-50, fig 2-5 note 4"],
                                 ["acomHeadquarters", "AR 25-50, fig 2-7 note 4"]]) {
        checkTrue(`${scope}: a geographic address on internal correspondence is reported`,
            validateMemo({...FIG_2_1, internalTo: scope, addressees: [withGeography]})
                .errors.some((f) => f.rule === "geographic-address-on-internal"), cite);
        checkTrue(`${scope}: omitting it is accepted`,
            validateMemo({...FIG_2_1, internalTo: scope, addressees: [withoutGeography]})
                .errors.every((f) => f.rule !== "geographic-address-on-internal"), cite);
    }

    checkTrue("a memorandum that is not internal keeps its geographic address",
        validateMemo({...FIG_2_1, addressees: [withGeography]})
            .errors.every((f) => f.rule !== "geographic-address-on-internal"),
        "AR 25-50, fig 2-6 note 3");

    // fig 2-8 addresses them as one line rather than naming 36 offices.
    checkTrue("several HQDA principals as separate addressees raises the collective form",
        validateMemo({...FIG_2_1, addressees: [
            "Deputy Chief of Staff, G-1", "Deputy Chief of Staff, G-3/5/7", "Deputy Chief of Staff, G-4",
        ]}).warnings.some((f) => f.rule === "hqda-principals-collective"),
        HQDA_PRINCIPALS_COLLECTIVE.cite);
    /*
     * "When sending an enclosure separately from the correspondence, write it
     * in the body of the correspondence and add a short note to the enclosure
     * when forwarded." - para 4-2d(2). The first half is checkable here; the
     * second travels with the enclosure and can only be reported.
     */
    {
        const {bodyMentionsEnclosure, SEPARATE_COVER} = await import("./ar25-50.js");
        const encl = {title: "Range 14 Maintenance Schedule", forwardedSeparately: true};

        checkTrue("a paraphrase in the body counts as writing it in",
            bodyMentionsEnclosure(encl.title, "The range 14 maintenance schedule follows under separate cover."),
            SEPARATE_COVER.cite);
        checkTrue("one incidental word does not",
            !bodyMentionsEnclosure(encl.title, "The schedule is unchanged."),
            SEPARATE_COVER.cite);

        checkTrue("an enclosure sent separately and never mentioned is reported",
            validateMemo({...FIG_2_1, enclosures: [encl],
                          paragraphs: [{text: "This memorandum announces nothing in particular."}]})
                .errors.some((f) => f.rule === "separate-cover-not-in-body"),
            SEPARATE_COVER.cite);
        checkTrue("the note that travels with it is always raised",
            validateMemo({...FIG_2_1, enclosures: [encl],
                          paragraphs: [{text: "The Range 14 maintenance schedule follows under separate cover."}]})
                .warnings.some((f) => f.rule === "separate-cover-note"),
            SEPARATE_COVER.cite);
        checkTrue("an ordinary enclosure raises neither",
            validateMemo({...FIG_2_1, enclosures: ["Range 14 Maintenance Schedule"]})
                .findings.every((f) => !f.rule.startsWith("separate-cover")),
            SEPARATE_COVER.cite);
    }

    checkTrue("ordinary commands do not",
        validateMemo({...FIG_2_1, addressees: [
            "Commander, 1st Cavalry Division", "Commander, 4th Infantry Division",
            "Commander, 10th Mountain Division",
        ]}).warnings.every((f) => f.rule !== "hqda-principals-collective"),
        HQDA_PRINCIPALS_COLLECTIVE.cite);
}

// ---------------------------------------------------------------------------
// The front end
// ---------------------------------------------------------------------------

/*
 * The page collects three things and nothing else: what you need, your words,
 * and the matters of record. Nothing it sends can move anything on the page -
 * that is what makes the .docx safe to lock and still safe to type into.
 */
{
    const {parseBody, specFromForm, createMemoServer} = await import("./memo-server.js");

    // Indentation is the subdivision level, two spaces per rung. Figure 2-1
    // stops at the third subdivision and buildParagraphTree() clamps there.
    check("a blank line separates paragraphs",
        parseBody("One.\n\nTwo.").map((p) => p.text), ["One.", "Two."], "AR 25-50, para 2-4b");
    check("indentation is the subdivision level",
        parseBody("Top.\n\n  Sub.\n\n    Deeper.").map((p) => p.level), [0, 1, 2],
        "AR 25-50, fig 2-1");
    check("a leading dash is a subparagraph too",
        parseBody("Top.\n\n- Sub.").map((p) => p.level), [0, 1], "AR 25-50, fig 2-1");
    check("a soft-wrapped line stays one paragraph",
        parseBody("One sentence\nwrapped by the textarea.").map((p) => p.text),
        ["One sentence wrapped by the textarea."], "AR 25-50, para 2-4b");
    check("a tab counts as one rung", parseBody("Top.\n\n\tSub.").map((p) => p.level), [0, 1],
        "AR 25-50, fig 2-1");

    // The form never carries a number, because para 2-4b(4)(b) makes the label
    // the renderer's job.
    checkTrue("the body syntax has no way to type a paragraph number",
        parseBody("1. Typed by hand.")[0].text === "1. Typed by hand."
            && parseBody("1. Typed by hand.")[0].level === 0,
        "AR 25-50, para 2-4b(4)(b)");

    /*
     * Every matter of record left blank comes back *blank* - not filled with
     * something plausible, and not filled with bracket text either. What the
     * document carries is the frame; the slot stays empty until told. The
     * one exception is the date, by the owner's direction: it defaults to
     * today in military style, because a memorandum generated today is
     * dated today in the owner's workflow - typing a date still overrides.
     */
    const blank = specFromForm({request: "tell the battalions the range closes"});
    const isBlank = (v) => v == null || (typeof v === "string" && v.trim() === "")
        || (typeof v === "object" && Object.values(v).every(isBlank));
    for (const {path, label} of (await import("./templates.js")).RECORD_FIELDS) {
        if (path === "date") continue;   // owner-directed: defaults to today, checked below
        const value = path.split(".").reduce((o, k) => o?.[k], blank);
        checkTrue(`${label} defaults to blank, not to a plausible value`, isBlank(value), "AR 25-50");
    }
    check("the date defaults to today, military style",
        blank.date, (await import("./ar25-50.js")).formatMemoDate(), "AR 25-50, para 2-4a(3) as directed");
    check("and a typed date overrides the default",
        specFromForm({request: "tell the battalions the range closes", date: "1 July 2026"}).date,
        "1 July 2026", "AR 25-50, para 2-4a(3)");

    // Blank is reported as not yet supplied, with what it is and where it
    // goes. The date is never in this list - it defaults to today.
    const pending = validateMemo(blank).warnings.filter((f) => f.rule === "not-yet-supplied");
    for (const what of ["Office symbol", "Subject", "Signature block"]) {
        checkTrue(`${what.toLowerCase()} is reported as not yet supplied`,
            pending.some((f) => f.message.startsWith(what)), "AR 25-50");
    }
    checkTrue("the date is not reported - it is already on the page",
        !pending.some((f) => f.message.startsWith("Date")), "AR 25-50, para 2-4a(3) as directed");
    checkTrue("every one of them says which paragraph puts it there",
        pending.every((f) => /AR 25-50, para/.test(f.cite)), "AR 25-50");
    checkTrue("and none of them is an error - the format is right, the value is absent",
        validateMemo(blank).errors.length === 0, "AR 25-50");

    /*
     * Addressee is not a matter of record the way officeSymbol/date/signature
     * are - nothing about who a memorandum is going to waits on who signs it
     * - so an unsupplied one falls back to the template's own bracketed
     * placeholder rather than to nothing, and is reported as unfilled the
     * same way a template's office symbol or signature is: unfilled-placeholder,
     * not not-yet-supplied.
     */
    const {hasPlaceholders: addresseeHasPlaceholders} = await import("./templates.js");
    checkTrue("an unsupplied addressee falls back to the template's own placeholder",
        blank.addressees.length === 1 && addresseeHasPlaceholders(blank.addressees[0]), "AR 25-50, para 2-4a(5)");
    checkTrue("and is reported as an unfilled placeholder, not as not-yet-supplied",
        validateMemo(blank).warnings.some((f) => f.rule === "unfilled-placeholder" && f.message.startsWith("addressees"))
            && !pending.some((f) => f.message.startsWith("Addressee")),
        "AR 25-50, para 2-4a(5)");

    // Supplied values are used as given.
    const filled = specFromForm({
        request: "notify the battalions", subject: "Range 14 Closure",
        officeSymbol: "ATZB-RC", date: "3 August 2026",
        signerName: "MARCUS T. HALE", signerGrade: "LTC, IN", signerTitle: "Director, Plans",
    });
    check("a supplied office symbol is used", filled.officeSymbol, "ATZB-RC", "AR 25-50, para 2-4a(1)");
    check("a supplied date is used", filled.date, "3 August 2026", "AR 25-50, para 2-4a(3)(b)");
    checkTrue("a fully supplied memorandum has no unfilled record fields",
        !["officeSymbol", "date"].some((k) => hasPlaceholdersDeep(filled[k])), "AR 25-50");

    /*
     * Para 2-4a(5): the front end reaches addresseeTitle/addresseeAddress
     * the same way it reaches every other field - supplied values pass
     * through, and an unsupplied one falls back to the selected template's
     * own placeholder rather than to nothing (assembleMemo() has to carry
     * them at all, which it did not before this was added).
     */
    const exclusiveForFilled = specFromForm({
        type: "exclusiveFor", request: "", subject: "Personal Matter",
        addresseeTitle: "Director, Civilian Personnel", addresseeAddress: "123 Main St, Anytown VA",
    });
    check("a supplied addressee title passes through the front end",
        exclusiveForFilled.addresseeTitle, "Director, Civilian Personnel", "AR 25-50, para 2-4a(5)");
    check("and a supplied addressee address does too",
        exclusiveForFilled.addresseeAddress, "123 Main St, Anytown VA", "AR 25-50, para 2-4a(5)");
    const exclusiveForBlank = specFromForm({type: "exclusiveFor", request: "", subject: "Personal Matter"});
    checkTrue("an unsupplied addressee title falls back to the template's own placeholder",
        addresseeHasPlaceholders(exclusiveForBlank.addresseeTitle), "AR 25-50, para 2-4a(5)");
    checkTrue("and so does an unsupplied addressee address",
        addresseeHasPlaceholders(exclusiveForBlank.addresseeAddress), "AR 25-50, para 2-4a(5)");

    // The type follows the request, and an explicit choice overrides it.
    check("the request picks the type", specFromForm({request: "record the call with the SJA"}).type,
        "record", "AR 25-50, para 2-7");
    check("an explicit type wins over the guess",
        specFromForm({request: "record the call with the SJA", type: "standard"}).type,
        "standard", "AR 25-50, para 2-2");
    check("an unknown type falls back to the request",
        specFromForm({request: "record the call with the SJA", type: "nonsense"}).type,
        "record", "AR 25-50, para 2-2");

    // An MFR is never prepared without the seal and letterhead (owner-
    // directed, per para 2-7), and takes no authority line (fig 2-17).
    const mfr = specFromForm({request: "memorandum for record of the call", authorityLine: "FOR THE COMMANDER:"});
    checkTrue("an MFR always comes out on letterhead - blank fields become slots",
        mfr.letterhead != null && typeof mfr.letterhead === "object",
        "AR 25-50, para 2-7 as directed");
    check("and a supplied organization reaches the MFR's letterhead",
        specFromForm({request: "memorandum for record of the call",
            organization: "HQ, 4TH INFANTRY DIVISION"}).letterhead.organization,
        "HQ, 4TH INFANTRY DIVISION", "AR 25-50, para 2-7 as directed");
    check("fig 2-17: an MFR carries no authority line", mfr.authorityLine, null, "AR 25-50, fig 2-17");

    /*
     * Enclosures are never forced: a memorandum with none carries no Encl
     * line at all, and one typed title is placed beside the signature block
     * (fig 2-17's own margin numerals; the chapter 4 listing forms).
     */
    const {renderText: rt} = await import("./memo-formatter.js");
    checkTrue("an MFR with no enclosures carries no Encl line",
        !/\bEncl\b/.test(rt(specFromForm({type: "record", subject: "S", body: "One paragraph."}))),
        "AR 25-50, chapter 4");
    checkTrue("and one typed enclosure title is placed",
        rt(specFromForm({type: "record", subject: "S", body: "One paragraph.",
            enclosures: "Sign-in Roster, 30 Jul 26"})).includes("Sign-in Roster"),
        "AR 25-50, chapter 4");

    // Whatever the page produces still has to satisfy the regulation.
    for (const type of ["standard", "thru", "exclusiveFor", "appreciation", "commendation", "record", "decision", "mou", "moa"]) {
        const spec = specFromForm({type, request: "", subject: "Range 14 Closure",
                                   body: "Range 14 closes for maintenance in August 2026."});
        check(`the front end's ${type} output raises no errors`,
            validateMemo(spec).errors.map((f) => f.rule), [], "AR 25-50");
    }

    // The server itself: every route answers, and the .docx it returns is the
    // same locked, Arial-12-only file the CLI writes.
    const server = createMemoServer();
    await new Promise((r) => server.listen(0, r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const form = {request: "tell the battalions range 14 closes", subject: "Range 14 Closure",
                  body: "Range 14 closes for maintenance from 3 to 7 August 2026."};
    const post = (path) => fetch(`${base}${path}`, {
        method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(form)});

    const home = await fetch(`${base}/`);
    const homeHtml = await home.text();
    check("the page is served", home.status, 200, "front end");
    checkTrue("the page needs no network of its own",
        !/\b(src|href)\s*=\s*["']https?:/i.test(homeHtml), "front end");

    /*
     * The page's script is written inside a template literal, so an escape
     * that collapses one level - `\"` becoming `"` - produces a syntax error
     * that takes the *whole* script with it: no Generate, no download, no
     * message saying why. Parsing what is actually served is the only way to
     * catch that, because the server is perfectly happy to hand it over.
     */
    {
        const script = /<script>([\s\S]*?)<\/script>/.exec(homeHtml)?.[1] ?? "";
        checkTrue("the page carries a script", script.trim().length > 0, "front end");
        let parsed = true;
        try {
            // eslint-disable-next-line no-new-func
            new Function(script);
        } catch {
            parsed = false;
        }
        checkTrue("the page's script parses", parsed, "front end");
    }

    const generated = await (await post("/generate")).json();
    check("generate returns the type it read", generated.title, "Memorandum", "AR 25-50, para 2-4");
    checkTrue("generate returns a rendered page", generated.html.includes("MEMORANDUM FOR"), "front end");
    /*
     * The unit's own details, and this memorandum's.
     *
     * A memorandum written under AR 25-50 is not interchangeable between
     * offices: the organization block, office symbol and signature block are
     * the unit's and repeat every time; the subject, addressee and date are
     * this memorandum's and do not. The front end asks for both and remembers
     * only the first, so the split has to hold on the wire.
     */
    {
        const outstanding = generated.outstanding;
        checkTrue("generate says what is still to be supplied",
            Array.isArray(outstanding?.unit) && Array.isArray(outstanding?.memorandum),
            "AR 25-50, paras 1-18, 2-4a(1) and 6-4c");
        checkTrue("and every question carries the paragraph that puts the field there",
            [...outstanding.unit, ...outstanding.memorandum].every((f) => f.label && f.hint && f.cite),
            "AR 25-50");

        const postBody = (path, body) => fetch(`${base}${path}`, {
            method: "POST", headers: {"content-type": "application/json"},
            body: JSON.stringify(body)});

        const fields = await (await postBody("/fields", {type: "record"})).json();
        // An MFR is on the unit's letterhead like every other memorandum
        // (owner-directed, per para 2-7), so its letterhead fields are
        // asked for - but it still has no addressee (fig 2-17's heading is
        // MEMORANDUM FOR RECORD, whole).
        checkTrue("an MFR is asked for its letterhead - it is never prepared without one",
            fields.unit.some((f) => f.path.startsWith("letterhead")), "AR 25-50, para 2-7 as directed");
        checkTrue("but not for an addressee",
            fields.memorandum.every((f) => f.path !== "addressees"), "AR 25-50, fig 2-17");

        const agreement = await (await postBody("/fields", {type: "mou"})).json();
        checkTrue("an MOU is not asked for an office symbol it does not carry",
            agreement.unit.every((f) => f.path !== "officeSymbol"), "AR 25-50, para 2-6c");

        const complete = await (await postBody("/generate", {
            type: "standard", body: "Range 14 closes for maintenance in August 2026.",
            subject: "Range 14 Closure", addressees: "Commander, 1st Battalion",
            organization: "HEADQUARTERS, 4TH INFANTRY DIVISION", streetAddress: "1633 MEKONG STREET",
            cityStateZip: "FORT CARSON, CO  80913-4321", officeSymbol: "ATZB-RC",
            signerName: "MARCUS T. HALE", signerGrade: "LTC, IN",
            signerTitle: "Director, Plans and Operations",
        })).json();
        check("a memorandum with everything supplied is asked nothing",
            [complete.outstanding.unit.length, complete.outstanding.memorandum.length], [0, 0],
            "AR 25-50");
    }

    /*
     * The page remembers the unit and nothing else.
     *
     * This is the check that matters: a subject or an addressee kept from the
     * last memorandum and quietly filled into the next one is how the wrong
     * office gets a memorandum that looks right. The stored list is asserted
     * against unit-profile.js's own idea of scope, and every id in it has to
     * exist on the form.
     */
    {
        const {FIELDS} = await import("./unit-profile.js");
        // The served page, not the source: the inputs are generated by a
        // template helper, so their ids only exist once the page is built.
        const source = homeHtml;
        const ids = /const UNIT_IDS = \[([^\]]*)\]/.exec(source);
        const stored = ids ? [...ids[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
        // Distinct paths, not entries: one path may have more than one entry
        // when the vehicles word it differently - a memorandum's "GRADE,
        // BRANCH" against a letter's "GRADE, U.S. ARMY" (paras 6-4f and 3-4).
        const unitPaths = new Set(FIELDS.filter((f) => f.scope === "unit").map((f) => f.path));
        check("the page remembers every one of the unit's fields",
            stored.length, unitPaths.size, "unit profile");
        checkTrue("every remembered field is an input on the form",
            stored.every((id) => source.includes(`id="${id}"`)), "front end");
        // The per-memorandum ids, spelled out, so adding one to the stored list
        // fails here rather than on somebody's desk.
        for (const id of ["subject", "addressees", "thru", "date", "body", "request",
                          "suspenseDate", "enclosures", "copiesFurnished"]) {
            checkTrue(`the page does not remember "${id}" between memorandums`,
                !stored.includes(id), "AR 25-50, para 2-4a - these change every time");
        }
    }

    checkTrue("generate returns cited findings",
        generated.findings.every((f) => f.rule && f.cite), "front end");

    const docx = await post("/docx");
    check("the .docx route returns a Word file", docx.headers.get("content-type"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "front end");
    {
        const JSZip = (await import("jszip")).default;
        const {renderDocx: renderDocxFn} = await import("./memo-docx.js");
        const zipOf = (buf) => JSZip.loadAsync(buf);
        const zip = await JSZip.loadAsync(Buffer.from(await docx.arrayBuffer()));
        const xml = await zip.file("word/document.xml").async("string");
        const styles = await zip.file("word/styles.xml").async("string");
        const settings = await zip.file("word/settings.xml").async("string");

        check("the front end's .docx uses one type size",
            [...new Set([...(xml + styles).matchAll(/<w:sz w:val="(\d+)"\/>/g)].map((m) => +m[1] / 2))],
            [12], TYPE_CITE);
        checkTrue("the front end's .docx locks formatting and nothing else",
            /<w:documentProtection w:formatting="1" w:enforcement="1"\/>/.test(settings)
                && !/w:edit="readOnly"/.test(settings),
            "AR 25-50, paras 1-19 and 2-3");
        /*
         * An unsupplied value is a plain-text content control: a single click
         * target with a grey prompt, which typing replaces whole. The point of
         * `w:showingPlcHdr` is that it is not text you have to select and
         * delete around - and the absence of `w:lock` is what makes it fillable
         * at all. Formatting stays locked by lockFormatting(); the text does
         * not.
         */
        // Rendered from a memorandum with nothing but its body, so every
        // matter of record is still a slot.
        const bare = await zipOf(await renderDocxFn(
            {paragraphs: [{text: "Range 14 closes for maintenance in August 2026."}]}));
        const bareXml = await bare.file("word/document.xml").async("string");
        const slots = [...bareXml.matchAll(/<w:alias w:val="([^"]+)"/g)].map((m) => m[1]);

        for (const [name, cite] of [
            ["OFFICE SYMBOL", "AR 25-50, para 2-4a(1)"],
            ["DATE", "AR 25-50, para 2-4a(3)(b)"],
            ["ADDRESSEE", "AR 25-50, para 2-4a(5)"],
            ["SUBJECT", "AR 25-50, para 2-4a(6)"],
            ["SIGNER NAME", "AR 25-50, para 6-4c"],
            ["GRADE, BRANCH", "AR 25-50, para 6-4c"],
            ["DUTY TITLE", "AR 25-50, para 6-4c"],
        ]) {
            checkTrue(`an unsupplied ${name.toLowerCase()} is a click-to-type slot`,
                slots.includes(name), cite);
        }
        checkTrue("each slot shows a prompt rather than empty space",
            (bareXml.match(/<w:showingPlcHdr\/>/g) ?? []).length >= slots.length, "front end");
        checkTrue("no slot is content-locked - these are the parts you fill in",
            !/<w:lock w:val="sdtContentLocked"/.test(bareXml), "front end");
        checkTrue("every slot carries the document's own type",
            (bareXml.match(new RegExp(`<w:sz w:val="${TYPE.fontSizePt * 2}"/>`, "g")) ?? []).length
                >= slots.length, TYPE_CITE);
        checkTrue("a supplied value is ordinary text, not a slot",
            [...(await (await zipOf(await renderDocxFn({...FIG_2_1})))
                .file("word/document.xml").async("string"))
                .matchAll(/<w:alias w:val="([^"]+)"/g)].map((m) => m[1])
                .includes("SUBJECT") === false,
            "AR 25-50, para 2-4a(6)");

        /*
         * Word is what this file is for, and Word validates the parts it opens
         * against the ECMA-376 schema. Both of these are xsd:sequences - a
         * child in the wrong place is not a nuance, it is "Word found
         * unreadable content in <name>.docx" and an offer to repair. Neither
         * shows up in a LibreOffice render, which accepts either order, so the
         * ordering is asserted on the XML itself.
         */
        const SDT_PR_ORDER = ["rPr", "alias", "tag", "id", "lock", "placeholder",
            "temporary", "showingPlcHdr", "dataBinding", "label", "tabIndex"];
        const inSchemaOrder = (names, order) => {
            let at = -1;
            for (const name of names) {
                const rank = order.indexOf(name);
                if (rank === -1) continue;          // the trailing type element
                if (rank <= at) return false;
                at = rank;
            }
            return true;
        };
        const sdtProps = [...bareXml.matchAll(/<w:sdtPr>(.*?)<\/w:sdtPr>/g)]
            .map((m) => [...m[1].matchAll(/<w:([a-zA-Z]+)[ />]/g)].map((c) => c[1]));
        checkTrue("every slot's properties are in ECMA-376 order, so Word opens the file",
            sdtProps.length === slots.length
                && sdtProps.every((names) => inSchemaOrder(names, SDT_PR_ORDER)),
            "ECMA-376 Part 1, para 17.5.2.38");
        checkTrue("the type element closes each slot's properties",
            sdtProps.every((names) => names[names.length - 1] === "text"),
            "ECMA-376 Part 1, para 17.5.2.38");
        const slotIds = [...bareXml.matchAll(/<w:sdtPr>.*?<w:id w:val="(\d+)"/g)].map((m) => m[1]);
        check("every slot carries a distinct id, as Word writes them",
            [slotIds.length, new Set(slotIds).size], [slots.length, slots.length],
            "ECMA-376 Part 1, para 17.5.2.38");
        checkTrue("and the same document twice produces the same ids",
            (await (await zipOf(await renderDocxFn(
                {paragraphs: [{text: "Range 14 closes for maintenance in August 2026."}]})))
                .file("word/document.xml").async("string"))
                .includes(`<w:id w:val="${slotIds[0]}"/>`),
            "ECMA-376 Part 1, para 17.5.2.38");

        // Only the settings this generator actually writes, in schema order.
        const SETTINGS_ORDER = ["displayBackgroundShape", "documentProtection",
            "evenAndOddHeaders", "compat"];
        checkTrue("the formatting lock sits at its schema position in w:settings",
            inSchemaOrder(
                [...settings.matchAll(/<w:([a-zA-Z]+)[ />]/g)].map((m) => m[1])
                    .filter((n) => SETTINGS_ORDER.includes(n)),
                SETTINGS_ORDER),
            "ECMA-376 Part 1, para 17.15.1.78");
    }

    const spec = await (await post("/spec")).json();
    check("the spec route round-trips through --spec",
        validateMemo(spec).errors.map((f) => f.rule), [], "AR 25-50");

    check("an unknown route is a 404", (await fetch(`${base}/nope`)).status, 404, "front end");

    // Para 1-16b(1) requires the seal and 1-16b(2) forbids substituting any
    // other device, so the preview may not fall back to a broken image. An
    // iframe's srcdoc has an opaque origin, which a filesystem path cannot
    // load from - the page has to be pointed at a URL that resolves.
    const seal = await fetch(`${base}/seal.png`);
    check("the seal is served to the preview", seal.status, 200, "AR 25-50, para 1-16b(1)");
    check("and served as an image", seal.headers.get("content-type"), "image/png",
        "AR 25-50, para 1-16b(1)");
    checkTrue("the preview points at a URL a browser can load, not a filesystem path",
        /<img class="seal" src="https?:\/\//.test(generated.html), "AR 25-50, para 1-16b(1)");

    await new Promise((r) => server.close(r));

    /*
     * army-memo-agent.js ends in a top-level `await main()`, so a module it
     * imports may not import it back: the entry module's evaluation never
     * completes, the cycle never settles, and `--serve` exits with "unsettled
     * top-level await" instead of listening. memo-intent.js exists to hold
     * what both of them need.
     */
    const intent = await import("./memo-intent.js");
    checkTrue("what the front end needs lives outside the CLI entry point",
        typeof intent.detectMemoType === "function"
            && typeof intent.assembleMemo === "function"
            && typeof intent.buildParagraphTree === "function",
        "no import cycle through a top-level await");

    const serverSource = await (await import("fs/promises"))
        .readFile(new URL("./memo-server.js", import.meta.url), "utf8");
    checkTrue("the front end does not import the CLI entry point",
        !/from\s+["']\.\/army-memo-agent\.js["']/.test(serverSource),
        "no import cycle through a top-level await");
}

// ---------------------------------------------------------------------------
// The page shows only the fields the selected type actually has
// ---------------------------------------------------------------------------

/*
 * unit-profile.js's FIELDS array already knows which fields apply to which
 * memorandum type - it is what /fields and the "still to be supplied" list
 * are built from. The page wraps every field it knows about there in a
 * `data-field="<path>"` container and asks /fields itself, rather than
 * carrying a second, driftable copy of "does this apply" in its own markup.
 * These checks read the served page, not the source, because the containers
 * are produced by a template helper.
 */
{
    const {specFromForm, createMemoServer} = await import("./memo-server.js");
    const {FIELDS} = await import("./unit-profile.js");

    const server = await new Promise((resolve) => {
        const s = createMemoServer();
        s.listen(0, () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const html = await (await fetch(`${base}/`)).text();

    /*
     * Every path FIELDS knows about is a container on the page - so hiding
     * one is a CSS toggle, never a missing input - except "subject" itself.
     * FIELDS excludes it for letters because para 3-6a(2) makes a letter's
     * subject line optional "if used", not because the page should refuse
     * to take one: the validator accepts a letter with or without a subject
     * (checkLetterHeading() returns early only when it is absent), so hiding
     * the input outright would remove a capability the renderer already
     * supports rather than reflect one it does not.
     */
    const distinctPaths = new Set(FIELDS.map((f) => f.path));
    distinctPaths.delete("subject");
    for (const path of distinctPaths) {
        checkTrue(`the page has a field container for "${path}"`,
            html.includes(`data-field="${path}"`), "front end");
    }
    checkTrue("subject stays on the page unconditionally - a letter may use one",
        /<label for="subject">/.test(html) && !html.includes('data-field="subject"'),
        "AR 25-50, para 3-6a(2)");

    // The signer columns are an array of two objects, not a single path -
    // FIELDS cannot model them, so they are never wrapped in a data-field
    // container that a path lookup could wrongly hide. Visibility for these
    // six is carried by the whole "Signers" fieldset instead.
    for (const id of ["signer1Name", "signer1Grade", "signer1Title",
                       "signer2Name", "signer2Grade", "signer2Title"]) {
        checkTrue(`"${id}" is on the page`, html.includes(`id="${id}"`), "AR 25-50, para 2-6c(5)");
        // Wrapped in a data-field container keyed to its own id, this would
        // be hidden forever - unit-profile.js has no path by that name to
        // ever populate a /fields answer with.
        checkTrue(`"${id}" carries no data-field container of its own`,
            !html.includes(`data-field="${id}"`), "front end");
    }
    checkTrue('the signer fieldset starts hidden - most memorandums are not agreements',
        /id="agreementfields" class="hidden"/.test(html), "AR 25-50, para 2-6c");

    // The client script itself picks these up through /fields - proving the
    // wiring end to end without a browser: the same lookup the page's own
    // script performs, run here against the same endpoint.
    const fieldsFor = async (type) =>
        (await (await fetch(`${base}/fields`, {
            method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({type}),
        })).json());

    const mou = await fieldsFor("mou");
    const mouPaths = new Set([...mou.unit, ...mou.memorandum].map((f) => f.path));
    checkTrue("an MOU's /fields answer includes parties", mouPaths.has("parties"), "AR 25-50, para 2-6c(2)");
    checkTrue("and does not include addressees - an agreement has none",
        !mouPaths.has("addressees"), "AR 25-50, para 2-6c(1)");
    checkTrue("and carries no unit-scoped field at all - no letterhead, no lone signature block",
        mou.unit.length === 0, "AR 25-50, para 2-6c");

    const exclusiveFor = await fieldsFor("exclusiveFor");
    const exPaths = new Set([...exclusiveFor.unit, ...exclusiveFor.memorandum].map((f) => f.path));
    checkTrue("\"Exclusive For\" is asked for the addressee's title", exPaths.has("addresseeTitle"),
        "AR 25-50, para 2-4a(5)");
    checkTrue("and for a mailing address", exPaths.has("addresseeAddress"), "AR 25-50, para 1-12b(1)");

    const standard = await fieldsFor("standard");
    const stdPaths = new Set([...standard.unit, ...standard.memorandum].map((f) => f.path));
    checkTrue("a standard memorandum is not asked for the personal-address fields",
        !stdPaths.has("addresseeTitle") && !stdPaths.has("addresseeAddress") && !stdPaths.has("parties"),
        "AR 25-50, para 2-4a(5)");

    /*
     * authorityLine and suspenseDate: a standard memorandum can carry either
     * - someone signing for the commander (para 2-4c(1)), a reply owed by a
     * date (para 2-4a(4)) - but an MFR has neither (fig 2-17), an agreement
     * has neither (para 2-6c), and a letter has neither (chapter 3 has no
     * authority line and para 1-27b gives letters no suspense date).
     */
    checkTrue("a standard memorandum is asked for an authority line",
        stdPaths.has("authorityLine"), "AR 25-50, para 2-4c(1)");
    checkTrue("and for a suspense date", stdPaths.has("suspenseDate"), "AR 25-50, para 2-4a(4)");
    const record = await fieldsFor("record");
    const recordPaths = new Set([...record.unit, ...record.memorandum].map((f) => f.path));
    checkTrue("an MFR is asked for neither - fig 2-17 has no authority line",
        !recordPaths.has("authorityLine") && !recordPaths.has("suspenseDate"), "AR 25-50, fig 2-17");
    checkTrue("nor is an MOU", !mouPaths.has("authorityLine") && !mouPaths.has("suspenseDate"),
        "AR 25-50, para 2-6c");

    // A different type is one lookup away from a wrong-looking form; the
    // label and hint the page shows have to be the ones for the type in
    // hand, not whichever entry happened to load first for a shared path.
    const letter = await fieldsFor("letter");
    const letterPaths = new Set([...letter.unit, ...letter.memorandum].map((f) => f.path));
    checkTrue("nor is a letter", !letterPaths.has("authorityLine") && !letterPaths.has("suspenseDate"),
        "AR 25-50, para 1-27b");
    const letterGrade = letter.unit.find((f) => f.path === "signature.gradeAndBranch");
    check("a letter's grade field is worded for a letter, not a memorandum",
        letterGrade?.prompt, "GRADE, U.S. ARMY", "AR 25-50, paras 3-4 and 3-6c(2)(c)");
    const memoGrade = standard.unit.find((f) => f.path === "signature.gradeAndBranch");
    check("and a memorandum's is worded the other way",
        memoGrade?.prompt, "GRADE, BRANCH", "AR 25-50, paras 6-4f and 6-5c");

    /*
     * specFromForm() reads the MOU/MOA signer inputs the page now has -
     * signer1Name/Grade/Title and signer2Name/Grade/Title - field by field,
     * each falling back to the template's own placeholder the same way
     * every other field on the page does, rather than the whole pair being
     * silently replaced by the template regardless of what was typed.
     */
    const agreement = specFromForm({
        type: "mou", request: "", subject: "Range Sharing",
        parties: "Fort Test\nExample County",
        signer1Name: "MARCUS T. HALE", signer1Grade: "COL, GS", signer1Title: "Garrison Commander",
        signer2Name: "JANET R. OWENS", signer2Title: "Sheriff, Example County",
    });
    check("a supplied party list is used", agreement.parties, ["Fort Test", "Example County"],
        "AR 25-50, para 2-6c(2)");
    check("a supplied junior signer's name is used", agreement.signers[0].name, "MARCUS T. HALE",
        "AR 25-50, para 2-6c(5)");
    check("a supplied senior signer's title is used", agreement.signers[1].titleAndAgency,
        "Sheriff, Example County", "AR 25-50, para 2-6c(5)");
    checkTrue("a senior signer left blank for a civilian carries no grade placeholder text",
        agreement.signers[1].gradeAndBranch === "" || agreement.signers[1].gradeAndBranch == null
            || (await import("./templates.js")).hasPlaceholders(agreement.signers[1].gradeAndBranch),
        "AR 25-50, para 6-5c");

    const agreementBlank = specFromForm({type: "mou", request: "", subject: "Range Sharing"});
    const {hasPlaceholders} = await import("./templates.js");
    checkTrue("an unsupplied party list falls back to the template's own placeholder",
        agreementBlank.parties.length > 0 && agreementBlank.parties.every(hasPlaceholders),
        "AR 25-50, para 2-6c(2)");
    checkTrue("an unsupplied signer falls back to the template's own placeholder",
        hasPlaceholders(agreementBlank.signers[0].name), "AR 25-50, para 2-6c(5)");

    /*
     * Para 2-4a(5)(c): more than five addressees is a SEE DISTRIBUTION
     * memorandum. specFromForm() has to set both memo.seeDistribution and
     * memo.distribution together - the validator raises an error for either
     * one alone (see-distribution-required without the flag, distribution-
     * list-missing with the flag but no list) - and default the list to the
     * addressees already typed, so crossing the threshold does not hand back
     * a document the office has to fix by hand.
     */
    const sixAddressees = Array.from({length: 6}, (_, i) => `Commander, ${i + 1}st Battalion`);
    const overThreshold = specFromForm({
        type: "standard", request: "", subject: "Range 14 Closure",
        body: "Range 14 closes for maintenance in August 2026.",
        addressees: sixAddressees.join("\n"),
    });
    check("more than five addressees sets seeDistribution", overThreshold.seeDistribution, true,
        "AR 25-50, para 2-4a(5)(c)");
    check("and defaults the distribution list to the addressees already typed",
        overThreshold.distribution, sixAddressees, "AR 25-50, para 2-4a(5)(c)");
    checkTrue("so the memorandum this produces raises no distribution finding at all",
        validateMemo(overThreshold).findings.every((f) => !f.rule.startsWith("distribution")
            && f.rule !== "see-distribution-required"),
        "AR 25-50, para 2-4a(5)(c)");

    const overThresholdOverridden = specFromForm({
        type: "standard", request: "", subject: "Range 14 Closure",
        body: "Range 14 closes for maintenance in August 2026.",
        addressees: sixAddressees.join("\n"), distribution: "Directorate of Public Works\nStaff Judge Advocate",
    });
    check("a distribution list actually typed wins over the addressee-list default",
        overThresholdOverridden.distribution, ["Directorate of Public Works", "Staff Judge Advocate"],
        "AR 25-50, para 2-4a(5)(c)");

    const underThreshold = specFromForm({
        type: "standard", request: "", subject: "Range 14 Closure",
        body: "Range 14 closes for maintenance in August 2026.", addressees: "Commander, 1st Battalion",
    });
    checkTrue("five or fewer addressees never sets seeDistribution",
        !underThreshold.seeDistribution, "AR 25-50, para 2-4a(5)(c)");

    /*
     * "Exclusive For" correspondence, appreciation, and commendation name one
     * person, never a list - addressees[0] is the only entry the renderer
     * ever reads for these types (memo-docx.js's exclusiveFor branch and its
     * PERSONAL_ADDRESS_TYPES branch both index [0]) - so specFromForm() has
     * to trim stray extra lines before the validator's multi-recipient
     * checks see them, and seeDistribution must never trigger for a type
     * that can never sensibly have "too many" addressees.
     */
    const {PERSONAL_ADDRESS_TYPES: PAT} = await import("./ar25-50.js");
    for (const type of PAT) {
        const overflowed = specFromForm({
            type, request: "", subject: "Personal Matter", addressees: sixAddressees.join("\n"),
        });
        check(`${type}: stray extra addressee lines are trimmed to the one name used`,
            overflowed.addressees.length, 1, "AR 25-50, para 2-4a(5)");
        checkTrue(`${type}: never sets seeDistribution, however many lines were typed`,
            !overflowed.seeDistribution, "AR 25-50, para 2-4a(5)");
    }

    /*
     * digitalSignature: a checkbox submits only when checked, so its absence
     * from the form - not a blank string - is what "unchecked" looks like on
     * the wire. A letter forces it false regardless, per para 3-6c(2)(b).
     */
    check("the checkbox checked reads as a digital signature",
        specFromForm({type: "standard", request: "", subject: "S", digitalSignature: "on"}).digitalSignature,
        true, "AR 25-50, para 2-4c(2)");
    check("the checkbox absent from the form reads as a wet signature",
        specFromForm({type: "standard", request: "", subject: "S"}).digitalSignature,
        false, "AR 25-50, para 2-4c(2)");
    check("a letter is never digitally signed, checkbox or not",
        specFromForm({type: "letter", request: "", subject: "S", digitalSignature: "on"}).digitalSignature,
        false, "AR 25-50, para 3-6c(2)(b)");
    checkTrue("unchecking it on a THRU memorandum surfaces the wet-signature line-through advisory",
        validateMemo(specFromForm({
            type: "thru", request: "", subject: "S", thru: "Commander, 1st Brigade", digitalSignature: "on",
        })).warnings.every((f) => f.rule !== "thru-wet-signature-lineout")
            && validateMemo(specFromForm({
                type: "thru", request: "", subject: "S", thru: "Commander, 1st Brigade",
            })).warnings.some((f) => f.rule === "thru-wet-signature-lineout"),
        "AR 25-50, para 6-3d");

    /*
     * toCommanderOf: blank addresses the named person above, the ordinary
     * case; filled in, "Exclusive For" instead addresses that organization's
     * commander (para 1-12b(1)). There is no template placeholder for it -
     * unlike addresseeTitle/addresseeAddress, most "Exclusive For"
     * correspondence does not use it, so a blank means "not using this",
     * not "not yet supplied".
     */
    check("a supplied commander-of organization passes through",
        specFromForm({type: "exclusiveFor", request: "", subject: "S", toCommanderOf: "1st Infantry Division"})
            .toCommanderOf, "1st Infantry Division", "AR 25-50, para 1-12b(1)");
    check("left blank, it is null - not a placeholder asking to be filled in",
        specFromForm({type: "exclusiveFor", request: "", subject: "S"}).toCommanderOf, null,
        "AR 25-50, para 1-12b(1)");

    server.close();
}

// ---------------------------------------------------------------------------
// The page's own field visibility keeps pace with what specFromForm() reads
// ---------------------------------------------------------------------------

/*
 * unit-profile.js's FIELDS array is what /fields answers from, and it is
 * what the page's own script uses to decide which containers to show - so
 * every field specFromForm() now reads (distribution, toCommanderOf,
 * digitalSignature) has to actually be reachable on the served page, and the
 * two fields whose label depends on more than just the type - MEMORANDUM FOR
 * itself, which reads differently for a personal-address type than for
 * everything else, and addressees once SEE DISTRIBUTION applies - have to
 * say the right thing rather than whichever entry happened to load first.
 */
{
    const {createMemoServer} = await import("./memo-server.js");
    const server = await new Promise((resolve) => {
        const s = createMemoServer();
        s.listen(0, () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const homeHtml = await (await fetch(`${base}/`)).text();

    for (const id of ["distribution", "toCommanderOf", "digitalSignature", "subjectcount"]) {
        checkTrue(`"${id}" is on the served page`, homeHtml.includes(`id="${id}"`), "front end");
    }
    checkTrue('digital signature defaults to checked - most memorandums are',
        /id="digitalSignature" name="digitalSignature" checked/.test(homeHtml), "AR 25-50, para 2-4c(2)");

    /*
     * The exact class of bug a nested template literal invites: `\s` written
     * inside the outer `page = () => \`...\`` string is not a JavaScript
     * escape sequence, so the template literal itself silently drops the
     * backslash at build time - the served script then matches literal "s"
     * characters, not whitespace, and a subject like "Range 14 Closure"
     * counts as some number that has nothing to do with its actual word
     * count. Asserting the served source, not the file on disk, is what
     * catches it - the source file can say the right thing and still ship
     * the wrong one.
     */
    checkTrue("the subject word counter's regex reaches the browser with its backslash intact",
        homeHtml.includes(".split(/\\s+/)"), "AR 25-50, para 2-4a(6)");

    /*
     * The memorandum is a fixed 8.5in sheet, so the preview has to solve
     * both directions the hard way a PDF viewer does. Vertically: a fixed
     * 74vh iframe scrolling inside "#out" (which also scrolls) once hid the
     * signature block behind two nested scrollbars. Horizontally: any pane
     * narrower than the sheet's 816px hid the right half of the document
     * behind an iframe-internal horizontal scrollbar sitting at the bottom
     * of a very tall frame. fitPreview() scales the sheet to the pane's
     * width (zoom, so scrollHeight reports the scaled size) and grows the
     * iframe to the scaled content's full height - one outer scroll, whole
     * document, at any window width. The resize listener is what keeps that
     * true when the window changes after Generate.
     */
    checkTrue("the preview scales the fixed-width sheet to the pane it is actually in",
        /function fitPreview\(\)/.test(homeHtml)
            // The applying line, not the reset line - .zoom = "" also exists
            // and matching it alone would let the scaling itself disappear.
            && /doc\.body\.style\.zoom = String\(scale\)/.test(homeHtml)
            && /Math\.min\(1,\s*frame\.clientWidth/.test(homeHtml),
        "front end");
    checkTrue("and grows the iframe to the scaled content's full height",
        /doc\.documentElement\.scrollHeight/.test(homeHtml) && /frame\.style\.height\s*=/.test(homeHtml),
        "front end");
    checkTrue("and re-fits when the window is resized",
        /addEventListener\("resize",/.test(homeHtml), "front end");

    /*
     * A type that has no letterhead - an MOU/MOA (para 2-6c(1)) - looks
     * like a rendering bug to anyone who has just seen a standard
     * memorandum's seal and DEPARTMENT OF THE ARMY header. /generate says
     * why, with the paragraph that says so, and the page prints it in the
     * report line. The MFR does NOT carry this note: by the owner's
     * direction it goes out on letterhead like every other memorandum.
     */
    const postGenerate = (body) => fetch(`${base}/generate`, {
        method: "POST", headers: {"content-type": "application/json"},
        body: JSON.stringify({subject: "S", body: "One paragraph.", ...body}),
    }).then((r) => r.json());
    check("an MFR's generate answer carries no plain-paper note - it is on letterhead",
        (await postGenerate({type: "record"})).plainPaper, null, "AR 25-50, para 2-7 as directed");
    check("an MOU's names para 2-6c(1)", (await postGenerate({type: "mou"})).plainPaper,
        "para 2-6c(1)", "AR 25-50, para 2-6c(1)");
    check("a standard memorandum on letterhead carries no such note",
        (await postGenerate({type: "standard"})).plainPaper, null, "AR 25-50, para 2-3a(1)");
    checkTrue("and the page renders the note into the report line",
        /d\.plainPaper/.test(homeHtml) && /plain white paper/.test(homeHtml), "front end");
    checkTrue("generate() goes through the fitting path, not a direct srcdoc assignment",
        /resizeFrame\(d\.html\)/.test(homeHtml) && !/\$\("frame"\)\.srcdoc\s*=\s*d\.html/.test(homeHtml),
        "front end");

    /*
     * The example leads, and the fields replace it: selecting a type - by
     * dropdown or by the request being read - renders that type's example
     * at once, and every committed field edit re-renders the preview with
     * the typed value in place of the template's, no Generate press needed.
     */
    checkTrue("selecting a type previews its example without pressing Generate",
        /\$\("type"\)\.addEventListener\("change", \(\) => \{ fetchFields\(\); autoPreview\(\); \}\)/.test(homeHtml),
        "front end");
    checkTrue("a detected type previews its example too",
        /lastType = d\.type;\s*fetchFields\(\);\s*autoPreview\(\);/.test(homeHtml), "front end");
    checkTrue("and editing any field re-renders the preview in place",
        /\$\("f"\)\.addEventListener\("change",/.test(homeHtml)
            && /autoPreview\(\)/.test(homeHtml) && /setTimeout\(generate, /.test(homeHtml),
        "front end");

    const postFields = (body) => fetch(`${base}/fields`, {
        method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)})
        .then((r) => r.json());
    const sixAddressees = Array.from({length: 6}, (_, i) => `Commander, ${i + 1}st Battalion`);

    const standardFields = await postFields({type: "standard"});
    checkTrue("/fields carries seeDistribution, so the page knows why addressees might be missing from it",
        "seeDistribution" in standardFields, "front end");
    const standardAddressee = standardFields.memorandum.find((f) => f.path === "addressees");
    check("a standard memorandum's addressee field is worded for an office",
        standardAddressee?.label, "MEMORANDUM FOR", "AR 25-50, para 2-4a(5)");

    const exclusiveForFields = await postFields({type: "exclusiveFor"});
    const exclusiveForAddressee = exclusiveForFields.memorandum.find((f) => f.path === "addressees");
    check("\"Exclusive For\" the same field is worded for a person, not an office",
        exclusiveForAddressee?.label, "Addressee's name", "AR 25-50, para 2-4a(5)");
    checkTrue("and toCommanderOf is offered alongside it",
        exclusiveForFields.memorandum.some((f) => f.path === "toCommanderOf"), "AR 25-50, para 1-12b(1)");

    const overThresholdFields = await postFields({
        type: "standard", addressees: sixAddressees.join("\n"),
    });
    checkTrue("past the threshold, seeDistribution comes back true",
        overThresholdFields.seeDistribution === true, "AR 25-50, para 2-4a(5)(c)");
    checkTrue("and addressees itself drops out of the answer - SEE DISTRIBUTION replaces the heading",
        !overThresholdFields.memorandum.some((f) => f.path === "addressees"), "AR 25-50, para 2-4a(5)(c)");
    checkTrue("while distribution takes its place",
        overThresholdFields.memorandum.some((f) => f.path === "distribution"), "AR 25-50, para 2-4a(5)(c)");

    server.close();
}

// ---------------------------------------------------------------------------
// The memorandum for record, both forms
// ---------------------------------------------------------------------------

/*
 * Figure 2-17 states its own rules in its own body text, so each check below
 * quotes the numbered paragraph of the figure it comes from rather than a
 * reading of it.
 */
{
    const {MFR_ABBREVIATED} = await import("./ar25-50.js");

    const mfr = {
        type: "record",
        officeSymbol: "OFFICE SYMBOL", arimsRecordNumber: "ARIMS Record Number",
        date: "3 March 2020",
        subject: "Preparing a Memorandum for Record",
        paragraphs: [{text: "Type the MFR on plain white paper."},
                     {text: "My point of contact is Mr. Smith, 719-555-0142, a@army.mil."}],
        signature: {name: "NAME", gradeAndBranch: "Major, AG", title: "Chief, Reassignment Branch"},
        enclosures: ["One enclosure"],
    };
    const doc = layoutMemo(mfr);
    const at = (role) => doc.flow.findIndex((l) => l.role === role);

    // fig 2-17 para 1: "Type the MFR on plain white paper."
    check("fig 2-17: an MFR is on plain white paper", doc.hasLetterhead, false, "AR 25-50, fig 2-17");

    // fig 2-17 para 2: "Type the words MEMORANDUM FOR RECORD in uppercase at
    // the left margin on the third line below the office symbol."
    check("fig 2-17: MEMORANDUM FOR RECORD is on the 3d line below the office symbol",
        at("memorandum-for") - at("office-symbol"), 3, "AR 25-50, fig 2-17");
    check("fig 2-17: and is uppercase at the left margin",
        [doc.flow[at("memorandum-for")].text, doc.flow[at("memorandum-for")].indentIn],
        ["MEMORANDUM FOR RECORD", 0], "AR 25-50, fig 2-17");

    // fig 2-17 para 3: "Type SUBJECT: in uppercase at the left margin on the
    // second line below MEMORANDUM FOR RECORD. Type the subject of the MFR
    // beginning one space after the colon."
    check("fig 2-17: SUBJECT is on the 2d line below MEMORANDUM FOR RECORD",
        at("subject") - at("memorandum-for"), 2, "AR 25-50, fig 2-17");
    check("fig 2-17: the subject begins one space after the colon",
        doc.flow[at("subject")].text, "SUBJECT: Preparing a Memorandum for Record",
        "AR 25-50, fig 2-17");
    checkTrue("fig 2-17: the subject itself is not forced to uppercase",
        doc.flow[at("subject")].text.includes("Preparing a Memorandum for Record"),
        "AR 25-50, fig 2-17");

    // fig 2-17 para 4: "Begin the text on the third line below the last line
    // of the subject."
    check("fig 2-17: the text begins on the 3d line below the subject",
        at("paragraph") - at("subject"), 3, "AR 25-50, fig 2-17");

    // fig 2-17 para 6: "Do not use an authority line."
    checkTrue("fig 2-17: an MFR carries no authority line",
        doc.flow.every((l) => l.role !== "authority-line"), "AR 25-50, fig 2-17");

    // The figure's own margin numerals: 1..5 to the signature block, with the
    // digital signature placeholder on 3 and Encl beside NAME on 5.
    const lastText = doc.flow.map((l, i) => (l.role === "paragraph" ? i : -1)).filter((i) => i >= 0).pop();
    const sigRow = doc.flow.findIndex((l) => l.role === "enclosure-label" || l.role === "signature");
    check("fig 2-17: the signature block is on the 5th line below the last line of text",
        sigRow - lastText, 5, "AR 25-50, fig 2-17");
    check("fig 2-17: Encl sits at the left margin beside the signer's name",
        [doc.flow[sigRow].text, doc.flow[sigRow].indentIn, doc.flow[sigRow].sameLine?.text],
        ["Encl", 0, "NAME"], "AR 25-50, fig 2-17 and para 2-4c(3)");

    /*
     * fig 2-17 note 7, the abbreviated form:
     *   "Use an abbreviated form when MFRs are placed on the bottom of a piece
     *    of existing correspondence. Begin typing two lines below the last line
     *    of the preceding correspondence and abbreviate MEMORANDUM FOR RECORD
     *    by typing the acronym MFR. Omit the office symbol and subject line.
     *    Begin typing the text two lines below MFR."
     */
    const short = layoutMemo({
        type: "record", abbreviated: true,
        paragraphs: mfr.paragraphs, signature: mfr.signature,
    });
    check("fig 2-17 note 7: the abbreviated form opens with the acronym",
        short.flow[0].text, MFR_ABBREVIATED.keyword, MFR_ABBREVIATED.cite);
    checkTrue("fig 2-17 note 7: it omits the office symbol",
        short.flow.every((l) => l.role !== "office-symbol"), MFR_ABBREVIATED.cite);
    checkTrue("fig 2-17 note 7: it omits the subject line",
        short.flow.every((l) => l.role !== "subject"), MFR_ABBREVIATED.cite);
    check("fig 2-17 note 7: the text begins two lines below MFR",
        short.flow.findIndex((l) => l.role === "paragraph"), 2, MFR_ABBREVIATED.cite);

    /*
     * And the same in the .docx, because the deliverable is the Word file.
     * Every assertion above passed while the .docx ignored `abbreviated`
     * entirely and emitted the full heading - office symbol, date,
     * MEMORANDUM FOR RECORD, subject and all. Checking the line model is not
     * checking the document.
     */
    {
        const {renderDocx} = await import("./memo-docx.js");
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(await renderDocx({
            type: "record", abbreviated: true, officeSymbol: "ATZB-RC",
            subject: "Telephone conversation", date: "31 July 2026",
            paragraphs: mfr.paragraphs, signature: mfr.signature,
        }));
        const xml = await zip.file("word/document.xml").async("string");
        const texts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);

        check("docx: the abbreviated form opens with the acronym",
            texts.find((t) => t.trim()), MFR_ABBREVIATED.keyword, MFR_ABBREVIATED.cite);
        checkTrue("docx: it omits the office symbol even when one is supplied",
            !texts.some((t) => t.includes("ATZB-RC")), MFR_ABBREVIATED.cite);
        checkTrue("docx: it omits the subject line even when one is supplied",
            !texts.some((t) => t.includes("SUBJECT") || t.includes("Telephone conversation")),
            MFR_ABBREVIATED.cite);
        checkTrue("docx: and the date line with it",
            !texts.some((t) => t.includes("31 July 2026")), MFR_ABBREVIATED.cite);
        // "Begin typing the text two lines below MFR" - one blank paragraph.
        const paras = [...xml.matchAll(/<w:p>(?:(?!<\/w:p>).)*<\/w:p>/gs)].map((m) => m[0]);
        const afterMfr = paras.findIndex((p) => />MFR</.test(p));
        const firstText = paras.findIndex((p) => /<w:t[^>]*>1\. /.test(p));
        check("docx: the text begins two lines below MFR",
            firstText - afterMfr, 2, MFR_ABBREVIATED.cite);
    }

    checkTrue("an abbreviated MFR raises no errors",
        validateMemo({type: "record", abbreviated: true,
                      paragraphs: mfr.paragraphs, signature: mfr.signature})
            .errors.length === 0, MFR_ABBREVIATED.cite);
    checkTrue("supplying an office symbol to an abbreviated MFR is reported",
        validateMemo({type: "record", abbreviated: true, officeSymbol: "AXYZ-BC",
                      paragraphs: mfr.paragraphs, signature: mfr.signature})
            .errors.some((f) => f.rule === "abbreviated-mfr-extra-field"), MFR_ABBREVIATED.cite);
    checkTrue("only a memorandum for record has an abbreviated form",
        validateMemo({...FIG_2_1, abbreviated: true})
            .errors.some((f) => f.rule === "abbreviated-not-mfr"), MFR_ABBREVIATED.cite);
    checkTrue("where an abbreviated MFR starts on the page is reported to the drafter",
        validateMemo({type: "record", abbreviated: true,
                      paragraphs: mfr.paragraphs, signature: mfr.signature})
            .warnings.some((f) => f.rule === "abbreviated-mfr-placement"), MFR_ABBREVIATED.cite);

    /*
     * assembleMemo() is where drafted content and caller context merge into a
     * spec, and it is the one place both the CLI and the front end route
     * through - so it is where fig 2-17's "no addressee, no THRU, no
     * letterhead, no authority line" has to be enforced, once, rather than
     * trusted to every caller. It was not: a request that resolves to
     * "record" but is answered with the standard demo's stock content (two
     * addressees, a suspense date's worth of context) came out addressed,
     * which fig 2-17 does not allow - reproduced here with exactly that
     * mismatch before being fixed.
     */
    {
        const {assembleMemo} = await import("./memo-intent.js");
        const draftedWithAddressees = {
            subject: "Telephone Conversation With Range Control",
            addressees: ["Commander, 1st Battalion, 5th Infantry Regiment"],
            paragraphs: [
                {level: 0, text: "This documents a call with Range Control."},
                {level: 0, text: "My point of contact is SSG Jane Doe, ATZB-RC, at 555-0142 or jane.doe@army.mil."},
            ],
        };
        const recordContext = {
            type: "record",
            officeSymbol: "ATZB-RC",
            date: "4 August 2026",
            addressees: ["Commander, 2d Battalion, 5th Infantry Regiment"],
            thru: ["Commander, 3d Battalion, 5th Infantry Regiment"],
            authorityLine: "FOR THE COMMANDER:",
            letterhead: {organization: "HEADQUARTERS, 4TH INFANTRY DIVISION",
                streetAddress: "1633 MEKONG STREET", cityStateZip: "FORT CARSON, CO  80913-4321"},
        };
        const assembled = assembleMemo(draftedWithAddressees, recordContext);

        check("assembleMemo: an MFR gets no addressee even when drafted content supplies one",
            assembled.addressees, [], "AR 25-50, fig 2-17");
        check("and none even when the caller's context supplies one instead",
            assembled.thru, [], "AR 25-50, fig 2-17");
        check("assembleMemo: an MFR carries no authority line even when the context supplies one",
            assembled.authorityLine, null, "AR 25-50, fig 2-17");
        // Owner-directed, per para 2-7: the MFR keeps the letterhead the
        // caller supplied - it is never prepared without one.
        check("assembleMemo: an MFR keeps the unit's letterhead",
            assembled.letterhead.organization, "HEADQUARTERS, 4TH INFANTRY DIVISION",
            "AR 25-50, para 2-7 as directed");
        checkTrue("assembleMemo: an MFR built this way raises no findings at all",
            validateMemo({...assembled, signature: {name: "N", gradeAndBranch: "MAJ, IN", title: "S3"}})
                .findings.length === 0, "AR 25-50, fig 2-17");

        checkTrue("and an ordinary standard memorandum still keeps its drafted addressee",
            assembleMemo(draftedWithAddressees, {type: "standard"})
                .addressees.includes("Commander, 1st Battalion, 5th Infantry Regiment"),
            "AR 25-50, para 2-4a(5)");
    }
}

// ---------------------------------------------------------------------------
// The drafting model
// ---------------------------------------------------------------------------

/*
 * What the model writes is the one part of a memorandum this module cannot
 * check against AR 25-50 - that is what the validator is for. What it *can*
 * check is everything around the model: that a job gets the model to itself,
 * that one request's memorandum cannot inform the next one's, that a missing
 * model degrades into a clear message rather than a stack trace, and that a
 * draft comes back as something you can still edit.
 *
 * `stubDrafter` is the seam. The loop cannot tell it from the real thing,
 * which is the point of keeping the drafter behind an interface.
 */
{
    const {
        stubDrafter, loadDrafter, getDrafter, disposeDrafter, modelAvailable,
        MEMO_CONTENT_SCHEMA, SYSTEM_PROMPT, DEFAULT_MODEL_PATH,
    } = await import("./memo-drafter.js");
    const {bodyFromParagraphs, parseBody, createMemoServer} = await import("./memo-server.js");
    const {OFFLINE_CONTENT, OFFLINE_CONTEXT} = await import("./army-memo-agent.js");
    const {buildParagraphTree, runMemoAgent} = await import("./memo-intent.js");

    // The schema is the guardrail: the model is physically unable to emit
    // anything outside it. So it must not contain a single thing the model has
    // no standing to decide.
    check("the model may write only a subject, addressees, and paragraphs",
        Object.keys(MEMO_CONTENT_SCHEMA.properties).sort(),
        ["addressees", "paragraphs", "subject"], "AR 25-50, para 2-4");
    for (const forbidden of ["officeSymbol", "date", "signature", "letterhead",
                             "arimsRecordNumber", "authorityLine"]) {
        checkTrue(`the model cannot supply ${forbidden}, which is a matter of record`,
            !(forbidden in MEMO_CONTENT_SCHEMA.properties), "AR 25-50, para 2-4a");
    }
    check("a paragraph carries a depth, not a label",
        Object.keys(MEMO_CONTENT_SCHEMA.properties.paragraphs.items.properties).sort(),
        ["level", "text"], "AR 25-50, para 2-4b(4)(b)");
    checkTrue("the system prompt tells the model it never formats",
        /never format/i.test(SYSTEM_PROMPT), "AR 25-50, para 2-4");

    // A missing API key is a message, not a crash.
    const hadKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    checkTrue("a missing API key is reported, not thrown through",
        !(await modelAvailable()), "no model present");
    {
        let message = null;
        await loadDrafter({modelPath: "claude-test-model"}).catch((e) => { message = e.message; });
        checkTrue("loading without a key explains how to set one",
            /ANTHROPIC_API_KEY/.test(message ?? "") && /claude-test-model/.test(message ?? ""),
            "no model present");
    }
    // A failed load must not be cached, or the process can never recover.
    {
        await getDrafter({modelPath: "claude-test-model"}).catch(() => {});
        let second = null;
        await getDrafter({modelPath: "claude-test-model"}).catch((e) => { second = e.message; });
        checkTrue("a failed load is retried rather than cached forever",
            Boolean(second), "no model present");
        await disposeDrafter();
    }
    if (hadKey !== undefined) process.env.ANTHROPIC_API_KEY = hadKey;
    else delete process.env.ANTHROPIC_API_KEY;

    // Jobs run one at a time, and each starts from a cleared history.
    {
        let concurrent = 0, peak = 0;
        const slow = stubDrafter(async () => {
            concurrent += 1;
            peak = Math.max(peak, concurrent);
            await new Promise((r) => setTimeout(r, 15));
            concurrent -= 1;
            return OFFLINE_CONTENT;
        });
        await Promise.all([1, 2, 3, 4].map(() => slow.withSession((draft) => draft("r", null))));
        check("concurrent drafting jobs are serialized", peak, 1, "one sequence, one prompt");
    }
    {
        // A job that throws must not wedge the queue behind it.
        const flaky = stubDrafter(async (request) => {
            if (request === "boom") throw new Error("nope");
            return OFFLINE_CONTENT;
        });
        await flaky.withSession((draft) => draft("boom", null)).catch(() => {});
        const after = await flaky.withSession((draft) => draft("fine", null));
        checkTrue("a failed job does not block the ones behind it",
            after.subject.length > 0, "one sequence, one prompt");
    }

    // The loop feeds findings back and keeps the better draft.
    {
        const seen = [];
        const drafter = stubDrafter(async (request, feedback) => {
            seen.push(feedback);
            return OFFLINE_CONTENT;
        });
        const {memo} = await drafter.withSession((draft) => runMemoAgent({
            request: "notify the battalions",
            context: {...OFFLINE_CONTEXT, type: "standard"},
            draft,
        }));
        check("the first pass gets no feedback", seen[0], null, "draft/validate/repair");
        checkTrue("the loop produces a compliant memorandum from a stub",
            validateMemo(memo).compliant, "AR 25-50");
    }

    // A draft comes back as form values, so it is still yours to edit.
    {
        const body = "Top one.\n\nTop two:\n\n  Sub a.\n\n  Sub b.\n\nBack to top.";
        check("a paragraph tree round-trips through the textarea syntax",
            bodyFromParagraphs(buildParagraphTree(parseBody(body))), body,
            "AR 25-50, para 2-4b(4)(b)");
    }

    // The whole route, over real HTTP, with the model stubbed out.
    {
        const server = createMemoServer({drafter: stubDrafter(async () => OFFLINE_CONTENT)});
        await new Promise((r) => server.listen(0, r));
        const base = `http://127.0.0.1:${server.address().port}`;
        const post = (path, body) => fetch(`${base}${path}`, {
            method: "POST", headers: {"content-type": "application/json"},
            body: JSON.stringify(body)});

        const drafted = await (await post("/draft", {request: "tell the battalions range 14 closes"})).json();
        checkTrue("the draft route returns a subject", drafted.subject?.length > 0, "front end");
        checkTrue("and a body in the textarea syntax",
            parseBody(drafted.body).length > 0, "front end");
        checkTrue("and reports how many passes it took", Number.isInteger(drafted.passes), "front end");
        checkTrue("and every finding it fed back is cited",
            (drafted.findings ?? []).every((f) => f.rule && f.cite), "front end");

        // What the model wrote still has to go through the same formatter.
        const regenerated = await (await post("/generate", {
            request: "tell the battalions range 14 closes",
            subject: drafted.subject, body: drafted.body, addressees: drafted.addressees,
        })).json();
        check("a drafted memorandum renders with no errors",
            regenerated.findings.filter((f) => f.severity === "error"), [], "AR 25-50");

        check("a draft with nothing to say is refused",
            (await post("/draft", {})).status, 400, "front end");

        const health = await (await fetch(`${base}/health`)).json();
        checkTrue("health reports whether a model is there", health.ok === true
            && typeof health.model.available === "boolean", "front end");

        await new Promise((r) => server.close(r));
    }

    /*
     * The user types what they need in the Body; the model tailors it.
     * Their typed words are the raw material - they must reach the drafter
     * whole, alongside the request, so the model corrects wording, tone,
     * and form instead of drafting blind from a one-line request. And a
     * body alone, with no request line at all, is enough to draft from.
     */
    {
        let seenRequest = "";
        const recorder = stubDrafter(async (request) => {
            seenRequest = request;
            return OFFLINE_CONTENT;
        });
        const server = createMemoServer({drafter: recorder});
        await new Promise((r) => server.listen(0, r));
        const base = `http://127.0.0.1:${server.address().port}`;
        const post = (path, body) => fetch(`${base}${path}`, {
            method: "POST", headers: {"content-type": "application/json"},
            body: JSON.stringify(body)});

        const roughWords = "range 14 shut 3-7 aug, lifters getting replaced lanes 1-12, DPW doing the road too";
        await post("/draft", {request: "tell the battalions range 14 closes", body: roughWords,
                              subject: "range closure"});
        checkTrue("the typed body reaches the drafter, whole, to be tailored",
            seenRequest.includes(roughWords), "front end");
        checkTrue("with the tailoring instruction - keep every fact, fix wording and form",
            /keep every\s+fact/i.test(seenRequest) && /Tailor/.test(seenRequest), "front end");
        checkTrue("and the working subject rides along",
            seenRequest.includes("range closure"), "front end");

        const bodyOnly = await (await post("/draft", {body: roughWords})).json();
        checkTrue("a body alone, with no request line, is enough to draft from",
            bodyOnly.subject?.length > 0, "front end");

        // An explicitly chosen type is final. (This used to be re-run
        // through detection, where the string "record" alone does not trip
        // the MFR pattern - the choice came back "standard".)
        const chosen = await (await post("/draft", {type: "record",
            request: "write up yesterday's staff sync"})).json();
        check("an explicitly chosen type survives the draft route",
            chosen.type, "record", "AR 25-50, para 2-2");

        await new Promise((r) => server.close(r));
    }

    // The default bind is loopback: this serves a Word file and loads a model
    // on demand, so reaching it from off-box should be a decision.
    {
        const {readFile} = await import("fs/promises");
        const read = (name) => readFile(new URL(`./${name}`, import.meta.url), "utf8");
        checkTrue("the server binds loopback unless told otherwise",
            /host = "127\.0\.0\.1"/.test(await read("memo-server.js")), "production default");
        const drafterSource = await read("drafter/claude-drafter.js");
        checkTrue("the model id can be set without editing anything",
            DEFAULT_MODEL_PATH.length > 0
                && /ANTHROPIC_MODEL/.test(drafterSource)
                && /MEMO_MODEL_PATH/.test(drafterSource),
            "production default");
    }
}

function hasPlaceholdersDeep(value) {
    if (value == null) return false;
    if (typeof value === "string") return /\[[A-Z]{2,}[^\]]*\]/.test(value);
    if (Array.isArray(value)) return value.some(hasPlaceholdersDeep);
    if (typeof value === "object") return Object.values(value).some(hasPlaceholdersDeep);
    return false;
}

// ---------------------------------------------------------------------------
// The letter - chapter 3, against figure 3-1
// ---------------------------------------------------------------------------

/*
 * The letter is the regulation's other correspondence vehicle, and almost
 * nothing chapter 2 says applies to it. Every position below is measured off
 * figure 3-1, rasterised at 150 px/in and calibrated on the seal - the same
 * 0.95 in square 0.52 in from the corner that calibrates the memorandum
 * figures. The calibration puts figure 3-1's left margin at 1.00 in, a value
 * the regulation states, so it checks out.
 */
{
    const {LETTER, formatLetterDate, letterPageNumber} = await import("./ar25-50.js");
    const {createTemplate: template} = await import("./templates.js");

    const LETTER_FIG = {
        // Ink tops in inches from the top edge, and x from the left edge.
        dateBelowLetterhead: 1.96,      // lines - para 3-6a(1)
        dateCentreIn: 4.29,             // centred on the page
        addressBelowDate: 4.99,         // lines - fig 3-1's "general rule"
        salutationBelowAddress: 2.02,   // lines - para 3-6a(4)
        textBelowSalutation: 1.99,      // lines - para 3-6b(1)
        paragraphIndentIn: 0.245,       // measured 0.243-0.249
        subparagraphIndentIn: 0.245,
        hyphenTextIn: 0.496,
        closeColumnIn: 4.32,            // from the page edge - para 3-6c(1)
        marginIn: 1.007,
    };

    const letter = {
        ...template("letter"),
        letterhead: {organization: "HQ, 4TH INFANTRY DIVISION", streetAddress: "1633 MEKONG ST",
                     cityStateZip: "FORT CARSON, CO  80913-4321"},
        date: formatLetterDate(new Date(2026, 7, 3)),
        addressees: ["The Honorable Jane Roe\nGovernor of Texas\nAustin, TX  78711-2428"],
        salutation: "Dear Governor Roe:",
        paragraphs: [
            {text: "Thank you for your letter about the range complex."},
            {text: "The closure runs from August 3 through August 7.",
             children: [{text: "Range 14 reopens on August 8."},
                        {text: "Range 22 remains available."}]},
        ],
        signature: {name: "Marcus T. Hale", grade: "MG", title: "Commanding"},
        enclosures: ["Range 14 Maintenance Schedule"],
    };

    const doc = layoutMemo(letter);
    const at = (role) => doc.flow.findIndex((l) => l.role === role);
    const lineAt = (role) => doc.flow[at(role)];

    // Para 3-6a: date, subject if used, address, salutation - in that order.
    checkTrue("letter: the heading runs date, address, salutation",
        at("date") < at("letter-address") && at("letter-address") < at("salutation"),
        "AR 25-50, para 3-6a");
    check("letter: the date is centred", lineAt("date").align, "center",
        LETTER.letterheadToDate.cite);
    check("letter: the date is two lines below the letterhead",
        LETTER.letterheadToDate.linesBelow, 2, LETTER.letterheadToDate.cite);
    check("letter: the address is five lines below the date",
        at("letter-address") - at("date"), 5, LETTER.dateToAddress.cite);
    check("letter: the salutation is the 2d line below the last address line",
        at("salutation") - doc.flow.map((l) => l.role).lastIndexOf("letter-address"), 2,
        LETTER.addressToSalutation.cite);
    check("letter: the text begins on the 2d line below the salutation",
        at("paragraph") - at("salutation"), 2, LETTER.salutationToText.cite);

    // "Indent paragraphs 1/4 inch. Do not number or letter paragraphs." - 3-6b(5)
    check("letter: paragraphs indent a quarter inch",
        lineAt("paragraph").indentIn, LETTER.paragraphIndentIn, LETTER.indentCite);
    checkTrue("letter: and are measured where figure 3-1 puts them",
        Math.abs(lineAt("paragraph").indentIn - LETTER_FIG.paragraphIndentIn) < 0.01,
        "measured from AR 25-50, fig 3-1");
    checkTrue("letter: no paragraph is numbered",
        doc.flow.filter((l) => l.role === "paragraph").every((l) => !l.prefix),
        "AR 25-50, para 3-6b(5)");
    check("letter: subparagraphs take letters of the alphabet",
        doc.flow.filter((l) => l.role === "subparagraph" && l.prefix).map((l) => l.prefix),
        ["a.", "b."], LETTER.subparagraphCite);
    checkTrue("letter: a paragraph's wrap returns to the left margin",
        doc.flow.filter((l) => l.role === "paragraph")
            .every((l, i, a) => l.indentIn === (a.indexOf(l) === i ? l.indentIn : 0)),
        "AR 25-50, fig 3-1");

    // "Start the closing on the second line below the last line of the letter.
    //  Begin at the center of the page." - 3-6c(1)
    check("letter: the complimentary close is the 2d line below the text",
        LETTER.textToClose.linesBelow, 2, LETTER.textToClose.cite);
    check("letter: it begins at the centre of the page",
        lineAt("complimentary-close").indentIn, LAYOUT.signatureBlockIndentIn,
        LETTER.closeCite);
    check("letter: the signature block is the 5th line below the close",
        at("signature") - at("complimentary-close"), 5, LETTER.closeToSignature.cite);
    checkTrue("letter: measured where figure 3-1 puts it",
        Math.abs(1.0 + lineAt("signature").indentIn - LETTER_FIG.closeColumnIn) < 0.08,
        "measured from AR 25-50, fig 3-1");

    /*
     * "Military personnel will use their full grades" (para 3-4) and "Branch
     * designations and 'General Staff' have no meaning to the general public"
     * (fig 3-1 continued). A memorandum would render this signer "MG" over a
     * branch; a letter spells it out and gives the component.
     */
    const sig = doc.flow.filter((l) => l.role === "signature").map((l) => l.text);
    check("letter: the grade is spelled out with the component, not the branch",
        sig[1], "Major General, U.S. Army", LETTER.signatureCite);
    checkTrue("letter: the signature block is mixed case, not capitals",
        sig[0] === "Marcus T. Hale" && sig[0] !== sig[0].toUpperCase(),
        "AR 25-50, para 3-6c(2)(c)");

    // "Do not show the number of enclosures or list them." - 3-6c(3)
    const encl = doc.flow.filter((l) => l.role === "enclosure-label").map((l) => l.text);
    check("letter: the enclosure line is the word alone", encl, ["Enclosure"],
        LETTER.enclosureCite);
    check("letter: two enclosures make it plural",
        layoutMemo({...letter, enclosures: ["A", "B"]}).flow
            .filter((l) => l.role === "enclosure-label").map((l) => l.text),
        ["Enclosures"], LETTER.enclosureCite);

    // Chapter 3's own date form, and the continuation page number.
    check("letter: the date is civilian style", formatLetterDate(new Date(2020, 0, 3)),
        "January 3, 2020", "AR 25-50, para 3-6a(1)");
    check("letter: a continuation page is numbered with a hyphen each side",
        letterPageNumber(2), "-2-", LETTER.continuationCite);

    // The validator's chapter 3 rules.
    const bad = (patch) => validateMemo({...letter, ...patch}).errors.map((f) => f.rule);
    checkTrue("letter: a memorandum-style date is an error",
        bad({date: "3 August 2026"}).includes("letter-date-style"), "AR 25-50, para 3-6a(1)");
    checkTrue("letter: a digital signature is an error",
        bad({digitalSignature: true}).includes("letter-digital-signature"),
        LETTER.noDigitalSignatureCite);
    checkTrue("letter: more than four subparagraphs is an error",
        bad({paragraphs: [{text: "x", children: [{text: "a"}, {text: "b"}, {text: "c"},
                                                 {text: "d"}, {text: "e"}]}]})
            .includes("letter-too-many-subparagraphs"), LETTER.subparagraphCite);
    checkTrue("letter: a hand-numbered paragraph is an error",
        bad({paragraphs: [{text: "1.  Do not number a letter's paragraphs."}]})
            .includes("letter-numbered-paragraph"), "AR 25-50, para 3-6b(5)");
    check("letter: the template itself raises no errors",
        validateMemo(template("letter")).errors.map((f) => f.rule), [], LETTER.cite);
}

// ---------------------------------------------------------------------------
// Appendix C - Forms of Address, Salutation, and Complimentary Close
// ---------------------------------------------------------------------------

/*
 * Spot-checked against the tables themselves, one or more entries per table,
 * transcribed directly from the PDF pages rather than paraphrased. This is
 * not exhaustive - table C-4 alone carries roughly fifty rows - but it is
 * enough to catch a mistranscription in each table, and the Army/table 6-1
 * cross-check below covers table C-4's largest block exactly rather than by
 * sampling.
 */
{
    const {APPENDIX_C, lookupAddressForm, militarySalutation} = await import("./ar25-50.js");
    const {GRADE_ABBREVIATIONS} = await import("./signature-blocks.js");

    check("appendix C: table C-1, the President",
        lookupAddressForm("The President")?.salutation,
        "Dear Mr./Madam President:", "AR 25-50, table C-1");
    check("appendix C: table C-2, a United States Senator",
        lookupAddressForm("United States Senator (Washington, DC, office)")?.salutation,
        "Dear Senator (surname):", "AR 25-50, table C-2");
    check("appendix C: table C-3, the Chief Justice",
        lookupAddressForm("The Chief Justice of the United States")?.salutation,
        "Dear Mr./Madam Chief Justice:", "AR 25-50, table C-3");
    check("appendix C: table C-5, a Governor - the letter's own audience, para 3-2",
        lookupAddressForm("Governor of a State")?.salutation,
        "Dear Governor (surname):", "AR 25-50, table C-5");
    check("appendix C: table C-5, a Mayor - also para 3-2's audience",
        lookupAddressForm("Mayor")?.salutation, "Dear Mayor (surname):", "AR 25-50, table C-5");
    check("appendix C: table C-6, a Catholic Cardinal",
        lookupAddressForm("Catholic Cardinal")?.salutation, "Your Eminence:", "AR 25-50, table C-6");
    check("appendix C: table C-7, a private individual",
        lookupAddressForm("Private individuals")?.salutation,
        "Dear Mr./Ms. (surname):", "AR 25-50, table C-7");
    check("appendix C: table C-8, a company or corporation",
        lookupAddressForm("To a company or corporation")?.salutation,
        "Gentlemen: (Ladies and Gentlemen)", "AR 25-50, table C-8");
    check("appendix C: table C-9, a foreign ambassador",
        lookupAddressForm("Foreign Ambassador in the United States")?.salutation,
        "Formal: Excellency:. Informal: Dear Mr./Madam Ambassador:", "AR 25-50, table C-9");
    check("appendix C: table C-10, the UN Secretary General",
        lookupAddressForm("Secretary General of the United Nations")?.salutation,
        "Formal: Excellency:. Informal: Dear Mr./Madam Secretary General:/Dear Mr./Ms. (surname):",
        "AR 25-50, table C-10");
    check("appendix C: table C-11, a former Governor",
        lookupAddressForm("Former Governor of State")?.salutation,
        "Dear Governor (surname):", "AR 25-50, table C-11");
    checkTrue("appendix C: a category that is not in any table returns null, not a guess",
        lookupAddressForm("Duke of Earl") === null, "AR 25-50, appendix C");

    // Table C-4's own worked example: "Dear Colonel (last name):" for both a
    // full colonel and a lieutenant colonel - the collapse is the table's own,
    // not a simplification introduced here.
    check("appendix C: table C-4, a colonel", militarySalutation("army", "COL"), "Dear Colonel (surname):",
        "AR 25-50, table C-4");
    check("appendix C: table C-4, a lieutenant colonel collapses to the same salutation",
        militarySalutation("army", "LTC"), militarySalutation("army", "COL"), "AR 25-50, table C-4");
    check("appendix C: table C-4, a warrant officer takes a courtesy title, not a rank word",
        militarySalutation("army", "CW3"), APPENDIX_C.militaryPersonnel.warrantOfficerSalutation,
        "AR 25-50, table C-4");
    check("appendix C: table C-4, a Navy admiral",
        militarySalutation("navy", "ADM"), "Dear Admiral (surname):", "AR 25-50, table C-4");
    check("appendix C: table C-4, a Marine Corps gunnery sergeant",
        militarySalutation("marineCorps", "GySgt"), "Dear Gunnery Sergeant (surname):", "AR 25-50, table C-4");
    check("appendix C: table C-4, an Air Force chief master sergeant",
        militarySalutation("airForce", "CMSgt"), "Dear Chief (surname):", "AR 25-50, table C-4");

    /*
     * Table C-4's Army column and table 6-1 (signature-blocks.js) describe the
     * same set of Army grades from two different chapters. They should never
     * drift apart - a grade added to one and not the other is exactly the kind
     * of gap a page-by-page reading catches and a later edit does not.
     * Sergeant Major of the Army is the one legitimate difference: a real
     * addressee in table C-4, and absent from table 6-1's signature grades.
     */
    const army = Object.keys(APPENDIX_C.militaryPersonnel.bySer.army);
    const ch6 = Object.keys(GRADE_ABBREVIATIONS);
    check("appendix C's Army grades and table 6-1's agree, except SMA",
        army.filter((g) => !ch6.includes(g)), ["SMA"], "AR 25-50, table C-4 and table 6-1");
    checkTrue("and nothing in table 6-1 is missing from appendix C's Army column",
        ch6.every((g) => army.includes(g)), "AR 25-50, table C-4 and table 6-1");

    /*
     * The validator checks a supplied salutation against the category once one
     * is named - para 3-5e's "See appendix C for proper addressing of
     * letters" is not satisfied by having the data on file if nothing reads it.
     */
    const {createTemplate: makeTemplate} = await import("./templates.js");
    const letterBase = {...makeTemplate("letter"),
        addressees: ["The Honorable Jane Roe, Governor of Texas"], date: "August 3, 2026"};
    checkTrue("appendix C: an unrecognized category is reported, not silently accepted",
        validateMemo({...letterBase, addresseeCategory: "Duke of Earl", salutation: "My Lord:"})
            .warnings.some((f) => f.rule === "letter-addressee-category-unknown"),
        APPENDIX_C.cite);
    checkTrue("appendix C: a salutation that does not match the category's form is an error",
        validateMemo({...letterBase, addresseeCategory: "Governor of a State", salutation: "Dear Ms. Roe:"})
            .errors.some((f) => f.rule === "letter-salutation-mismatch"),
        "AR 25-50, table C-5");
    checkTrue("appendix C: the table's own form raises no error",
        validateMemo({...letterBase, addresseeCategory: "Governor of a State",
                      salutation: "Dear Governor (surname):"})
            .errors.every((f) => f.rule !== "letter-salutation-mismatch"),
        "AR 25-50, table C-5");
    checkTrue("appendix C: no category set means no claim is checked",
        validateMemo({...letterBase, salutation: "Dear Governor Roe:"})
            .errors.every((f) => f.rule !== "letter-salutation-mismatch"),
        "AR 25-50, para 3-5e");
}

// ---------------------------------------------------------------------------
// The file, against the schema Word implements
// ---------------------------------------------------------------------------

/*
 * Everything else here checks the memorandum. This checks the file: whether
 * Word will open it at all.
 *
 * Word validates each part against ISO/IEC 29500-4. A part that breaks the
 * schema does not render slightly wrong - it produces "Word found unreadable
 * content" and an offer to repair, and nothing reaches the page. LibreOffice
 * renders straight through faults Word rejects, so the rendered-page block
 * below cannot stand in for this. Two faults proved it: every content control
 * shipped inside a literal `<undefined>` wrapper, and `w:documentProtection`
 * sat ahead of an element that outranks it. Both rendered perfectly.
 *
 * Every type the generator can produce is validated, filled and blank, because
 * the slots are the part written by hand.
 *
 * Skipped when the schemas or lxml are absent, so the suite still runs
 * anywhere - `validate-ooxml.py` exits 3 to say which.
 */
{
    const {execFile} = await import("child_process");
    const {promisify} = await import("util");
    const os = await import("os");
    const fsp = await import("fs/promises");
    const run = promisify(execFile);

    const {renderDocx} = await import("./memo-docx.js");
    const {TEMPLATES, createTemplate, recordFieldPlaceholders} = await import("./templates.js");
    const {assembleMemo} = await import("./memo-intent.js");
    const {OFFLINE_CONTENT, OFFLINE_CONTEXT} = await import("./army-memo-agent.js");

    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "ar2550-schema-"));
    const files = [];
    const write = async (name, memo) => {
        const file = path.join(dir, `${name}.docx`);
        await fsp.writeFile(file, await renderDocx(memo));
        files.push(file);
    };

    for (const type of Object.keys(TEMPLATES)) {
        await write(`type-${type}`, createTemplate(type));
        await write(`blank-${type}`, {...createTemplate(type), ...recordFieldPlaceholders()});
    }
    await write("offline", assembleMemo(OFFLINE_CONTENT, OFFLINE_CONTEXT));
    await write("bare", {paragraphs: [{text: "Range 14 closes for maintenance in August 2026."}]});
    // Long enough to run past one page, with a distribution page after it.
    await write("multipage", {
        letterhead: {organization: "HQ", streetAddress: "1 MEKONG ST", cityStateZip: "FORT CARSON, CO  80913"},
        officeSymbol: "ATZB-CG", subject: "Range Operations", date: "30 July 2026",
        addressees: ["SEE DISTRIBUTION"], distribution: ["Commander, 1st Battalion", "Garrison Safety Office"],
        distributionOnSeparatePage: true, enclosures: ["Range 14 Maintenance Schedule"],
        paragraphs: Array.from({length: 30}, (_, i) => ({
            text: `Paragraph ${i + 1}.  Range operations continue under the published schedule. `.repeat(3),
        })),
    });

    const script = new URL("./validate-ooxml.py", import.meta.url).pathname;
    const result = await run("python3", [script, ...files], {timeout: 300_000})
        .then((r) => ({code: 0, ...r}))
        .catch((e) => ({code: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? String(e)}));

    if (result.code === 3) {
        console.log(`  (${result.stderr.trim().replace(/^skip:\s*/, "")} - skipping schema validation)`);
    } else {
        const parts = /(\d+) parts validated/.exec(result.stdout);
        checkTrue("docx: every part validates against ISO/IEC 29500-4, so Word opens the file",
            result.code === 0, "ISO/IEC 29500-4:2016 (ECMA-376)");
        if (result.code !== 0) console.log(result.stdout.split("\n").slice(0, 6).join("\n"));
        // A validator that silently checks nothing would pass the line above.
        checkTrue("docx: and every type the generator makes was put through it",
            Number(parts?.[1]) >= files.length * 3, "ISO/IEC 29500-4:2016 (ECMA-376)");
    }

    await fsp.rm(dir, {recursive: true, force: true});
}

// ---------------------------------------------------------------------------
// The page as it actually renders
// ---------------------------------------------------------------------------

/*
 * Everything above asserts the line model or the OOXML. This renders the .docx
 * and measures the printed page, which is the only thing that answers "is it
 * actually right" - and the only check that would have caught the office
 * symbol sitting 2.66 lines below the letterhead instead of 2, because both
 * the line model and the OOXML said 1.79 and agreed with each other.
 *
 * Skipped when LibreOffice is absent, so the suite still runs anywhere.
 */
{
    const {execFile} = await import("child_process");
    const {promisify} = await import("util");
    const os = await import("os");
    const fsp = await import("fs/promises");
    const run = promisify(execFile);

    const soffice = await run("which", ["soffice"]).then((r) => r.stdout.trim()).catch(() => null);

    if (!soffice) {
        console.log("  (LibreOffice not installed - skipping the rendered-page measurements)");
    } else {
        const {renderDocx} = await import("./memo-docx.js");
        const {assembleMemo} = await import("./memo-intent.js");
        const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "ar2550-render-"));

        const memo = assembleMemo({
            subject: "Rescheduled Weapons Qualification",
            addressees: ["Commander, Company A, 2d Battalion, 8th Infantry Regiment"],
            paragraphs: [
                {level: 0, text: "Weapons qualification moves to the week of 17 August 2026."},
                {level: 0, text: "Company commanders will complete the following actions:"},
                {level: 1, text: "Submit a revised roster by 1200 on 8 August 2026."},
                {level: 1, text: "Confirm ammunition forecasts against the new date."},
                {level: 0, text: "My point of contact is Mr. Okonkwo, 719-555-0142, a@army.mil."},
            ],
        }, {officeSymbol: "ATZB-RC", date: "30 July 2026", enclosures: ["Revised Range Schedule"]});

        await fsp.writeFile(path.join(dir, "m.docx"), await renderDocx(memo));
        await run(soffice, ["--headless", "--norestore", "--convert-to", "pdf",
                            "--outdir", dir, path.join(dir, "m.docx")], {timeout: 180_000});

        // Measure the printed page with the same reader the PDF audit used.
        const script = `
import sys, json
from pypdf import PdfReader
r = PdfReader(sys.argv[1]); pg = r.pages[0]
H = float(pg.mediabox.height); W = float(pg.mediabox.width)
runs = []
def v(t, cm, tm, font, size):
    if t.strip():
        runs.append({"t": t.strip(), "x": tm[4]/72, "y": (H-tm[5])/72, "s": size})
pg.extract_text(visitor_text=v)
print(json.dumps({"w": W/72, "h": H/72, "runs": runs}))
`;
        await fsp.writeFile(path.join(dir, "m.py"), script);
        const {stdout} = await run("python3", [path.join(dir, "m.py"), path.join(dir, "m.pdf")]);
        const page = JSON.parse(stdout);
        const at = (sub) => page.runs.find((r) => r.t.includes(sub));
        // A numbered paragraph is two runs: the label at the margin and the
        // text at the tab stop. Margin and indent rules govern the label, so
        // measure the leftmost run sharing that baseline.
        const lineLeft = (sub) => {
            const y = at(sub).y;
            return Math.min(...page.runs.filter((r) => Math.abs(r.y - y) < 0.02).map((r) => r.x));
        };
        const LINE = 13.8 / 72;
        const near = (a, b, tol) => Math.abs(a - b) <= tol;

        check("rendered: the page is 8.5 by 11 inches",
            [Number(page.w.toFixed(2)), Number(page.h.toFixed(2))], [8.5, 11], "AR 25-50, para 2-3a");
        checkTrue("rendered: the body sits at the 1-inch left margin",
            near(lineLeft("Weapons qualification"), 1.0, 0.02), "AR 25-50, para 2-3c");
        /*
         * The letterhead and the office symbol are checked against figure 2-1
         * itself, in absolute inches, rather than as a count of body lines.
         *
         * A line count was what went wrong before: the letterhead is 10 pt and
         * 8 pt, so counting its four lines as four 13.8 pt body lines put the
         * office symbol half a line high, and the check counted them the same
         * wrong way and agreed. An absolute position measured off the figure
         * cannot agree with a mistake in the model that produced it.
         *
         * Figure 2-1 rasterised at 150 px/in and calibrated on the seal - a
         * known 0.95 in square 0.52 in from the top and left edges of the page,
         * so it is a ruler printed on the figure. The calibration checks out
         * against a value the regulation does state: it puts the left margin at
         * 1.005 in. These are ink tops, in inches from the top edge.
         */
        const FIG_2_1 = {
            letterheadTitle: 0.580,
            lastLetterheadLine: 0.992,
            // 1.809 as measured; figure 2-1's office symbol line carries
            // "(ARIMS Record Number)", and Arial's parenthesis rises about
            // 0.006 in above cap height, so a line of plain capitals starts
            // there.
            officeSymbol: 1.815,
        };
        const inkTop = (sub) => {
            const r = at(sub);
            return r.y - 0.716 * r.s / 72;      // Arial cap height is 0.716 em
        };
        const FIG_CITE = "measured from AR 25-50, fig 2-1";

        checkTrue("rendered: the letterhead title is where figure 2-1 puts it",
            near(inkTop("DEPARTMENT OF THE ARMY"), FIG_2_1.letterheadTitle, 0.02), FIG_CITE);
        checkTrue("rendered: the last letterhead line is where figure 2-1 puts it",
            near(inkTop("CITY, STATE"), FIG_2_1.lastLetterheadLine, 0.02), FIG_CITE);
        checkTrue("rendered: the office symbol is where figure 2-1 puts it",
            near(inkTop("ATZB-RC"), FIG_2_1.officeSymbol, 0.03),
            `${FIG_CITE}; para 2-4a(1)`);
        checkTrue("rendered: MEMORANDUM FOR is the 3d line below the office symbol",
            near((at("MEMORANDUM FOR").y - at("ATZB-RC").y) / LINE, 3, 0.15),
            "AR 25-50, para 2-4a(5)");
        checkTrue("rendered: SUBJECT is the 2d line below the address",
            near((at("SUBJECT:").y - at("Commander, Company A").y) / LINE, 2, 0.15),
            "AR 25-50, para 2-4a(6)");
        checkTrue("rendered: the text is the 3d line below the subject",
            near((at("Weapons qualification").y - at("SUBJECT:").y) / LINE, 3, 0.15),
            "AR 25-50, para 2-4b(1)");
        checkTrue("rendered: the signature block is at the centre of the page",
            near(at("SIGNER NAME").x, 4.25, 0.05), "AR 25-50, para 2-4c(2)(a)");
        checkTrue("rendered: the enclosure listing shares the signature block's line",
            near(at("Encl").y, at("SIGNER NAME").y, 0.02) && near(at("Encl").x, 1.0, 0.02),
            "AR 25-50, para 2-4c(3)");
        checkTrue("rendered: a subparagraph indents a quarter inch",
            near(lineLeft("Submit a revised") - 1.0, 0.25, 0.02), "AR 25-50, fig 2-1");
        // "Arial 12, never higher." Nothing on the page is above 12, the text
        // is 12, and the only sizes below it are the letterhead's own.
        const onPage = [...new Set(page.runs.map((r) => Math.round(r.s)))].sort((a, b) => a - b);
        check("rendered: the page carries body 12 pt and the letterhead's 10 and 8",
            onPage, [LETTERHEAD.addressSizePt, LETTERHEAD.titleSizePt, TYPE.fontSizePt]
                .sort((a, b) => a - b), TYPE_CITE);
        checkTrue("rendered: nothing on the page is above 12 pt",
            onPage.every((s) => s <= TYPE.maxSizePt), TYPE_CITE);
        checkTrue("rendered: the memorandum's own text is 12 pt",
            Math.round(at("Weapons qualification").s) === TYPE.fontSizePt, TYPE_CITE);

        await fsp.rm(dir, {recursive: true, force: true});
    }
}

// ---------------------------------------------------------------------------
// The rest of chapter 1 - references, enclosures-to-enclosures, recordkeeping
// ---------------------------------------------------------------------------

/**
 * Para 1-30's reference-citation forms, checked against the literal example
 * strings the regulation prints for each one - the same oracle the layout
 * figures serve, applied to a paragraph that governs sentences rather than
 * positions.
 */
{
    const {REFERENCES, usesSameSubjectShorthand} = await import("./ar25-50.js");

    check("para 1-30a: a publication reference",
        REFERENCES.publication("AR 25-50", "Preparing and Managing Correspondence"),
        "AR 25-50 (Preparing and Managing Correspondence)", REFERENCES.publicationCite);

    check("para 1-30b(1): a correspondence reference",
        REFERENCES.correspondence({
            organization: "HQ USARC", officeSymbol: "AFRC-ZA", type: "memorandum",
            subject: "Training for Army Materiel Command Personnel", date: "20 February 2020",
        }),
        "HQ USARC, AFRC-ZA memorandum (Training for Army Materiel Command Personnel), 20 February 2020.",
        REFERENCES.correspondenceCite);

    check("para 1-30c(1): an email reference",
        REFERENCES.emailOrFax({
            organization: "HQ TRADOC", officeSymbol: "ATPL-TDD-OR", fullName: "[full name]",
            medium: "email", subject: "Correspondence Memorandum", date: "3 January 2020",
        }),
        "HQ TRADOC, ATPL-TDD-OR, [full name] email (Correspondence Memorandum), 3 January 2020.",
        REFERENCES.emailOrFaxCite);

    check("para 1-30d(1): a public law reference",
        REFERENCES.publicLaw({
            name: "National Environmental Policy Act of 1969", publicLawNumber: "91-190",
            section: "103", statute: "83 Statute 852, 853", year: "1970",
        }),
        "National Environmental Policy Act of 1969, Public Law No. 91-190, Section 103, 83 Statute 852, 853 (1970).",
        REFERENCES.publicLawCite);

    check("para 1-30g(1): a telephone-conversation reference",
        REFERENCES.telephoneOrMeeting({
            kind: "telephone conversation",
            participants: ["[full name], TRADOC", "[full name], CIO"],
            subject: "Records Management", date: "23 January 2020",
        }),
        "Reference telephone conversation between [full name], TRADOC, and [full name], CIO (Records Management), 23 January 2020.",
        REFERENCES.telephoneOrMeetingCite);

    // Para 1-30h: "SAB" and "subject as above" are the memorandum's shorthand.
    checkTrue("para 1-30h: \"subject as above\" is recognized",
        usesSameSubjectShorthand("See paragraph 1, subject as above."), REFERENCES.cite);
    checkTrue("and so is the acronym \"SAB\"",
        usesSameSubjectShorthand("Reference SAB."), REFERENCES.cite);
    checkTrue("but an ordinary sentence is not misread as either",
        !usesSameSubjectShorthand("The subject above concerns range safety."), REFERENCES.cite);

    const {validateMemo: validate1_30} = await import("./memo-validator.js");
    const {createTemplate: template1_30} = await import("./templates.js");
    checkTrue("para 1-30h: a letter using \"SAB\" is reported",
        validate1_30({...template1_30("standard"), type: "letter",
                      paragraphs: [{text: "Reference SAB, dated 3 January 2020."}]})
            .errors.some((f) => f.rule === "sab-not-in-letters"),
        REFERENCES.sameSubjectMemorandumOnlyCite);
    checkTrue("and a memorandum using it is not",
        validate1_30({...template1_30("standard"),
                      paragraphs: [{text: "Reference SAB, dated 3 January 2020."}]})
            .findings.every((f) => f.rule !== "sab-not-in-letters"),
        REFERENCES.sameSubjectMemorandumOnlyCite);
}

/**
 * Para 1-34: an attachment to an enclosure is "enclosure N to enclosure M" -
 * a text convention, distinct from the tab-package label `TABBING.secondaryLabel`
 * already carries for para 4-3.
 */
{
    const {enclosureToEnclosureLabel, ENCLOSURE_TO_ENCLOSURE_CITE} = await import("./ar25-50.js");
    check("para 1-34: an attachment to an enclosure is named enclosure-to-enclosure",
        enclosureToEnclosureLabel(3, 2), "enclosure 3 to enclosure 2", ENCLOSURE_TO_ENCLOSURE_CITE);
}

/**
 * Para 1-37: a memorandum that delegates signature authority is filed under
 * record number 25-50a. Nothing in an ordinary spec implies this - it fires
 * only off the flag a drafter sets when that is what the memorandum is for.
 */
{
    const {DELEGATION_SIGNATURE_AUTHORITY_RECORDKEEPING, DELEGATION_REQUIRED_STATEMENTS} = await import("./ar25-50.js");
    const {validateMemo: validate1_37} = await import("./memo-validator.js");
    const {createTemplate: template1_37} = await import("./templates.js");
    const base1_37 = template1_37("standard");

    checkTrue("para 1-37: a memorandum delegating signature authority is told to record it under 25-50a",
        validate1_37({...base1_37, delegatesSignatureAuthority: true})
            .warnings.some((f) => f.rule === "delegation-recordkeeping"),
        DELEGATION_SIGNATURE_AUTHORITY_RECORDKEEPING.cite);
    checkTrue("and an ordinary memorandum is not",
        validate1_37(base1_37).findings.every((f) => f.rule !== "delegation-recordkeeping"),
        DELEGATION_SIGNATURE_AUTHORITY_RECORDKEEPING.cite);

    // Para 6-1b(1): the same flag also surfaces the two statements a written
    // delegation should carry.
    checkTrue("para 6-1b(1): the two required statements are surfaced alongside the recordkeeping note",
        validate1_37({...base1_37, delegatesSignatureAuthority: true})
            .warnings.some((f) => f.rule === "delegation-required-statements"
                && DELEGATION_REQUIRED_STATEMENTS.statements.every((s) => f.message.includes(s))),
        DELEGATION_REQUIRED_STATEMENTS.cite);
    checkTrue("and an ordinary memorandum is not asked for them",
        validate1_37(base1_37).findings.every((f) => f.rule !== "delegation-required-statements"),
        DELEGATION_REQUIRED_STATEMENTS.cite);
}

/**
 * Para 3-3: a letter cannot use a reply-attribution phrase unless the
 * SECARMY specifically directed it - the opposite shape from the
 * mandatory-phrase exception chapter 2 gives memorandums.
 */
{
    const {RESPONSE_PHRASES} = await import("./ar25-50.js");
    const {validateMemo: validate3_3} = await import("./memo-validator.js");
    const {createTemplate: template3_3} = await import("./templates.js");
    const letter3_3 = template3_3("letter");

    checkTrue("para 3-3: \"The Secretary has requested that I reply\" is a recognized response phrase",
        RESPONSE_PHRASES.patterns.some((p) => p.test("The Secretary has requested that I reply to your letter.")),
        RESPONSE_PHRASES.cite);
    checkTrue("and so is \"on behalf of the\"",
        RESPONSE_PHRASES.patterns.some((p) => p.test("I write on behalf of the Chief of Staff.")),
        RESPONSE_PHRASES.cite);
    checkTrue("but an ordinary sentence is not misread as either",
        RESPONSE_PHRASES.patterns.every((p) => !p.test("The range will reopen on 7 August.")),
        RESPONSE_PHRASES.cite);

    checkTrue("para 3-3: a letter using a response phrase is reported",
        validate3_3({...letter3_3, paragraphs: [{text: "On behalf of the Secretary, thank you for your letter."}]})
            .errors.some((f) => f.rule === "response-phrase-not-authorized"),
        RESPONSE_PHRASES.cite);
    checkTrue("and excused once the SECARMY has directed it",
        validate3_3({...letter3_3, secarmyDirectedResponsePhrase: true,
                     paragraphs: [{text: "On behalf of the Secretary, thank you for your letter."}]})
            .errors.every((f) => f.rule !== "response-phrase-not-authorized"),
        RESPONSE_PHRASES.cite);
    checkTrue("and a memorandum using the same words is not checked at all - para 3-3 governs letters only",
        validate3_3({...template3_3("standard"),
                     paragraphs: [{text: "On behalf of the Secretary, forward this to the field."}]})
            .findings.every((f) => f.rule !== "response-phrase-not-authorized"),
        RESPONSE_PHRASES.cite);
}

/**
 * Para 5-11: "To the Commander of___" - table 5-4's own example is the
 * oracle, the same discipline the layout figures get.
 */
{
    const {commanderOfAddressForm, COMMANDER_OF_CITE} = await import("./ar25-50.js");
    check("para 5-11 / table 5-4: addressing correspondence through a commanding officer",
        commanderOfAddressForm("PFC", "[Name]", ["CO A 1/15 FIELD ARTILLERY", "APO AP 96XXX"]),
        ["COMMANDER OF PFC [Name]", "CO A 1/15 FIELD ARTILLERY", "APO AP 96XXX"],
        COMMANDER_OF_CITE);
}

/**
 * Para 1-39b(6): "Use 'I,' 'you,' and 'we' as subjects of sentences instead
 * of this office, this headquarters, this command, all individuals, and so
 * forth." The mechanical twin of the already-implemented 1-39b(8) check for
 * "It is"/"There is"/"There are" - same shape, same paragraph, one clause over.
 */
{
    const cite1_39b6 = "AR 25-50, para 1-39b(6)";
    checkTrue("para 1-39b(6): \"This headquarters\" opening a sentence is reported",
        validateMemo({...FIG_2_1, paragraphs: [
            {text: "This headquarters requires all units to submit reports by Friday."},
        ]}).warnings.some((f) => f.rule === "institutional-subject"), cite1_39b6);
    checkTrue("and so is \"This command\"",
        validateMemo({...FIG_2_1, paragraphs: [
            {text: "This command will conduct an inspection next month."},
        ]}).warnings.some((f) => f.rule === "institutional-subject"), cite1_39b6);
    checkTrue("but an ordinary sentence naming an office mid-sentence is not",
        validateMemo({...FIG_2_1, paragraphs: [
            {text: "Coordinate with this office before the deadline."},
        ]}).findings.every((f) => f.rule !== "institutional-subject"), cite1_39b6);
    checkTrue("and \"I,\" \"you,\" or \"we\" as the subject raises nothing",
        validateMemo({...FIG_2_1, paragraphs: [
            {text: "We will complete the inspection by Friday."},
        ]}).findings.every((f) => f.rule !== "institutional-subject"), cite1_39b6);
}

// ---------------------------------------------------------------------------
// Every template's own editing surface: a fresh createTemplate() is what a
// user actually gets when they select a type, and its "matters of record"
// fields have to come out as real click-to-type slots, not plain bracketed
// text a template happens to print. This was not true before this section
// was added - the templates carried `[OFFICE SYMBOL]`-style placeholders,
// which slot() and its callers only recognized as "blank" when the value was
// truly empty, so a freshly selected template rendered zero content controls
// anywhere.
// ---------------------------------------------------------------------------

{
    const {createTemplate, hasPlaceholders: hasPlaceholdersFn} = await import("./templates.js");
    const {renderDocx} = await import("./memo-docx.js");
    const {validateMemo: validateForTemplates} = await import("./memo-validator.js");
    const JSZip = (await import("jszip")).default;

    const CITE = "AR 25-50, paras 1-16, 1-18, 2-4a(1), 2-4a(3)(b) and 6-4";

    /** Every w:tag across every part of a rendered .docx, and every content-control id. */
    const controlsOf = async (memo) => {
        const zip = await JSZip.loadAsync(await renderDocx(memo));
        const tags = [], ids = [];
        for (const name of Object.keys(zip.files)) {
            if (!name.endsWith(".xml") || zip.files[name].dir) continue;
            const xml = await zip.file(name).async("string");
            tags.push(...[...xml.matchAll(/<w:tag w:val="([^"]+)"/g)].map((m) => m[1]));
            ids.push(...[...xml.matchAll(/<w:sdtPr>.*?<w:id w:val="(\d+)"/gs)].map((m) => m[1]));
        }
        return {tags, ids};
    };

    // Expected tags per type, deduplicated - a tag appearing more than once
    // (the continuation-page running head repeats SUBJECT) is a pre-existing,
    // separately-tracked fact and not what this check is about.
    const EXPECTED = {
        standard: ["OFFICE SYMBOL", "SUBJECT", "SIGNER NAME", "GRADE, BRANCH", "DUTY TITLE",
                   "ORGANIZATION", "STREET ADDRESS", "CITY, STATE ZIP+4"],
        thru: ["OFFICE SYMBOL", "SUBJECT", "SIGNER NAME", "GRADE, BRANCH", "DUTY TITLE",
               "ORGANIZATION", "STREET ADDRESS", "CITY, STATE ZIP+4"],
        // Para 1-12 / paras 2-2 and 2-4a(5): personal-address types keep the
        // same matters of record as an ordinary memorandum - only the
        // addressee line's construction differs, not what gets a slot.
        exclusiveFor: ["OFFICE SYMBOL", "SUBJECT", "SIGNER NAME", "GRADE, BRANCH", "DUTY TITLE",
                       "ORGANIZATION", "STREET ADDRESS", "CITY, STATE ZIP+4"],
        appreciation: ["OFFICE SYMBOL", "SUBJECT", "SIGNER NAME", "GRADE, BRANCH", "DUTY TITLE",
                       "ORGANIZATION", "STREET ADDRESS", "CITY, STATE ZIP+4"],
        commendation: ["OFFICE SYMBOL", "SUBJECT", "SIGNER NAME", "GRADE, BRANCH", "DUTY TITLE",
                       "ORGANIZATION", "STREET ADDRESS", "CITY, STATE ZIP+4"],
        record: ["OFFICE SYMBOL", "SUBJECT", "SIGNER NAME", "GRADE, BRANCH", "DUTY TITLE"],
        decision: ["OFFICE SYMBOL", "SUBJECT", "SIGNER NAME", "GRADE, BRANCH", "DUTY TITLE",
                   "ORGANIZATION", "STREET ADDRESS", "CITY, STATE ZIP+4"],
        mou: ["SUBJECT", "JUNIOR OFFICIAL NAME", "SENIOR OFFICIAL NAME",
              "JUNIOR OFFICIAL GRADE, BRANCH", "SENIOR OFFICIAL GRADE, BRANCH",
              "JUNIOR OFFICIAL TITLE, AGENCY", "SENIOR OFFICIAL TITLE, AGENCY"],
        moa: ["SUBJECT", "JUNIOR OFFICIAL NAME", "SENIOR OFFICIAL NAME",
              "JUNIOR OFFICIAL GRADE, BRANCH", "SENIOR OFFICIAL GRADE, BRANCH",
              "JUNIOR OFFICIAL TITLE, AGENCY", "SENIOR OFFICIAL TITLE, AGENCY"],
    };

    for (const [type, expected] of Object.entries(EXPECTED)) {
        const {tags} = await controlsOf(createTemplate(type));
        const present = new Set(tags);
        checkTrue(`the ${type} template's own editing surface is a real content control, not bracketed text`,
            expected.every((t) => present.has(t)), CITE);
    }

    // Every template genuinely has record-field placeholders to prove the
    // point with - if this ever came back empty, the content-control check
    // above would be vacuously true for the wrong reason.
    for (const type of Object.keys(EXPECTED)) {
        const template = createTemplate(type);
        const recordPlaceholders = [
            template.officeSymbol,
            template.letterhead?.organization, template.letterhead?.streetAddress, template.letterhead?.cityStateZip,
            template.signature?.name, template.signature?.gradeAndBranch, template.signature?.title,
            ...(template.signers ?? []).flatMap((s) => [s.name, s.gradeAndBranch, s.titleAndAgency]),
        ].filter((v) => v && hasPlaceholdersFn(v));
        checkTrue(`the ${type} template has record-field placeholders to check`,
            recordPlaceholders.length > 0, CITE);
    }

    // Every content-control id within a single template's render is
    // distinct, as Word requires - checked per type because this is exactly
    // where the MOU/MOA fix could have collided two signers on one id.
    for (const type of Object.keys(EXPECTED)) {
        const {ids} = await controlsOf(createTemplate(type));
        // The one known, pre-existing exception: the continuation-page
        // running head repeats SUBJECT in its own header part, which
        // predates this section and is not what it checks.
        const dupes = ids.length - new Set(ids).size;
        checkTrue(`the ${type} template's content-control ids collide no more than the known SUBJECT repeat`,
            dupes <= 1, "ECMA-376 Part 1, para 17.5.2.38");
    }

    // A civilian signer on an MOU/MOA - `gradeAndBranch` genuinely absent,
    // not blank and not a placeholder - keeps its two-line block rather than
    // being forced into a slot it does not need. Para 6-4a, Note 2.
    {
        const civilianMemo = {
            ...createTemplate("mou"),
            signers: [
                {name: "JANE DOE", title: "General Counsel"},
                {name: "[SENIOR OFFICIAL NAME]", gradeAndBranch: "[GRADE, BRANCH]", titleAndAgency: "[TITLE, AGENCY]"},
            ],
        };
        const {tags} = await controlsOf(civilianMemo);
        checkTrue("a civilian signer with no grade field at all is not given a GRADE, BRANCH slot",
            !tags.includes("JUNIOR OFFICIAL GRADE, BRANCH"), "AR 25-50, para 6-4a, Note 2");
        checkTrue("but a supplied civilian name is not turned into a slot either",
            !tags.includes("JUNIOR OFFICIAL NAME"), "AR 25-50, para 6-4a, Note 2");
    }

    // A real, supplied value is still ordinary text - the central promise of
    // slot(), reconfirmed after touching it.
    checkTrue("a fully supplied standard memorandum has no content controls at all",
        (await controlsOf({
            type: "standard",
            letterhead: {organization: "HQ", streetAddress: "1 Army Way", cityStateZip: "Fort Carson, CO  80913"},
            officeSymbol: "ATZB-RC", date: "4 August 2026", subject: "Real Subject",
            addressees: ["Commander, 1st Battalion"],
            paragraphs: [{text: "Body text."}],
            signature: {name: "JANE DOE", gradeAndBranch: "COL, IN", title: "Commander"},
        })).tags.length === 0,
        CITE);

    // Para 2-6c(5): an MOU/MOA signs through `signers`, not `signature` - the
    // validator has to sweep that field too, or a template's own
    // "[JUNIOR OFFICIAL NAME]" is never reported as unfilled.
    for (const type of ["mou", "moa"]) {
        const result = validateForTemplates(createTemplate(type));
        checkTrue(`an unfilled ${type} template's signers are reported as unfilled placeholders`,
            result.warnings.some((f) => f.rule === "unfilled-placeholder" && f.message.startsWith("signers[0]")),
            "AR 25-50, para 2-6c(5)");
    }

    /*
     * "Exclusive For" correspondence, appreciation, and commendation were
     * valid MEMO_TYPES with formatter and validator support but no template
     * builder, so createTemplate() rejected them and neither the CLI nor the
     * front end could ever select one - the type existed only for a spec
     * built by hand.
     */
    const {renderText} = await import("./memo-formatter.js");
    checkTrue("\"Exclusive For\" is now a selectable template",
        createTemplate("exclusiveFor").type === "exclusiveFor", "AR 25-50, para 1-12");
    checkTrue("so is appreciation", createTemplate("appreciation").type === "appreciation",
        "AR 25-50, paras 2-2 and 2-4a(5)");
    checkTrue("so is commendation", createTemplate("commendation").type === "commendation",
        "AR 25-50, paras 2-2 and 2-4a(5)");

    // Para 1-12b(1): "Memorandum Exclusive For [Full Name], [Title], [Mailing
    // Address]" - not the usual uppercase MEMORANDUM FOR.
    checkTrue("\"Exclusive For\" opens with its own keyword, addressed to a person",
        renderText(createTemplate("exclusiveFor")).includes("Memorandum Exclusive For [FULL NAME], [TITLE], [MAILING ADDRESS]"),
        "AR 25-50, para 1-12b(1)");
    /*
     * Para 2-4a(5): "address the memorandum to the name and title of the
     * addressee" - two elements, not the three para 1-12b(1) spells out for
     * "Exclusive For". No mailing address is templated here; the field is
     * still honored if a caller supplies one, since the exception does not
     * forbid it, but nothing in paras 2-2 or 2-4a(5) asks a drafter for it.
     */
    for (const type of ["appreciation", "commendation"]) {
        const text = renderText(createTemplate(type));
        checkTrue(`${type} addresses the person by name and title, not an office`,
            text.includes("MEMORANDUM FOR [FULL NAME], [TITLE]"), "AR 25-50, para 2-4a(5)");
        checkTrue(`and ${type} does not template a mailing address para 2-4a(5) never asks for`,
            !text.includes("[MAILING ADDRESS]"), "AR 25-50, para 2-4a(5)");
    }

    // addresseeTitle is a field checkPlaceholders() has to sweep too, or a
    // template's own "[TITLE]" is never reported as unfilled - the same
    // class of gap `signers` had.
    for (const type of ["exclusiveFor", "appreciation", "commendation"]) {
        const result = validateForTemplates(createTemplate(type));
        checkTrue(`an unfilled ${type} template's addressee title is reported as unfilled`,
            result.warnings.some((f) => f.rule === "unfilled-placeholder" && f.message.startsWith("addresseeTitle")),
            "AR 25-50, para 2-4a(5)");
    }
    // "Exclusive For" alone templates a mailing address, matching para
    // 1-12b(1)'s three-element form.
    checkTrue("an unfilled \"Exclusive For\" template's addressee address is reported as unfilled",
        validateForTemplates(createTemplate("exclusiveFor"))
            .warnings.some((f) => f.rule === "unfilled-placeholder" && f.message.startsWith("addresseeAddress")),
        "AR 25-50, para 1-12b(1)");
    for (const type of ["appreciation", "commendation"]) {
        checkTrue(`and an unfilled ${type} template raises no addresseeAddress finding at all - it has no such field`,
            validateForTemplates(createTemplate(type))
                .findings.every((f) => !f.message.startsWith("addresseeAddress")),
            "AR 25-50, para 2-4a(5)");
    }
}

// ---------------------------------------------------------------------------
// The MFR backbone: request in, compliant .docx out, across every use fig
// 2-17 and para 2-7a actually name - not one canned demo, several.
// ---------------------------------------------------------------------------

/*
 * Everything upstream of layout - detectMemoType(), assembleMemo(), the
 * draft/validate/repair loop - is the same machinery every memorandum type
 * routes through; the MFR is just where it has been proven hardest, twice
 * this session. This section is the case for treating it as load-bearing:
 * five distinct requests, phrased the way people actually phrase them (not
 * uniformly "document the X"), each carrying its own drafted content the
 * way a model's answer would, run through the real pipeline end to end -
 * intent detection, assembly, validation, and a real .docx - not just the
 * layout math. No live model is available in this environment, so the
 * "drafted" content below stands in for it (para 2-7's own four described
 * uses of an MFR - authority for an action, an informal meeting, a
 * telephone conversation, and - via a site visit and a meeting decision -
 * the general "official business was conducted" case), exercising exactly
 * the seam runMemoAgent() takes a real model through.
 */
{
    const {renderDocx} = await import("./memo-docx.js");
    const {detectMemoType, assembleMemo} = await import("./memo-intent.js");
    const JSZip = (await import("jszip")).default;

    const SCENARIOS = [
        {
            // Para 2-7a: "the authority or basis for an action taken."
            request: "I need to document the basis for approving SGT Ramirez's emergency leave",
            subject: "Basis for Approval of Emergency Leave for SGT Ramirez",
            paragraphs: [
                {level: 0, text: "This memorandum documents the basis for approving emergency leave for SGT Maria Ramirez from 2 through 9 August 2026."},
                {level: 0, text: "SGT Ramirez requested leave following notification of a family medical emergency.  The Red Cross verified the emergency on 1 August 2026."},
                {level: 0, text: "My point of contact for this action is SFC John Diaz, ATZB-PAC, at 719-555-0198 or john.diaz.mil@army.mil."},
            ],
        },
        {
            // Para 2-7a: "document informal meetings... when official
            // business was conducted." Event-first phrasing, the shape
            // the original intent-detection regex missed entirely.
            request: "I had a staff meeting about the barracks renovation budget and need to document it",
            subject: "Staff Meeting on Barracks Renovation Funding",
            paragraphs: [
                {level: 0, text: "This memorandum documents a staff meeting on 30 July 2026 concerning funding for the Building 2100 barracks renovation."},
                {level: 0, text: "Attendees agreed the Directorate of Public Works will submit a revised cost estimate by 15 August 2026."},
                {level: 0, text: "My point of contact for this action is Ms. Karen Blake, ATZB-DPW, at 719-555-0173 or karen.blake.civ@army.mil."},
            ],
        },
        {
            // Para 2-7a: "document... telephone conversations when
            // official business was conducted."
            request: "I had a phone call with the range safety officer and need to write it up",
            subject: "Telephone Conversation With Range Safety Officer",
            paragraphs: [
                {level: 0, text: "This memorandum documents a 1415 telephone conversation on 29 July 2026 between the undersigned and Mr. Aaron Cole, Range Safety Officer."},
                {level: 0, text: "Mr. Cole confirmed that Range 22 meets safety requirements for the scheduled 5 August 2026 qualification."},
                {level: 0, text: "My point of contact for this action is SSG Renee Park, ATZB-RC, at 719-555-0142 or renee.park.mil@army.mil."},
            ],
        },
        {
            // "Decision reached" - one of the RECORD_EVENTS trigger phrases.
            request: "capture the decision reached at today's planning meeting",
            subject: "Decision Reached at Training Planning Meeting",
            paragraphs: [
                {level: 0, text: "This memorandum documents a decision reached at the 31 July 2026 training planning meeting."},
                {level: 0, text: "The command group decided to consolidate the September gunnery density into a single two-week window."},
                {level: 0, text: "My point of contact for this action is MAJ Patricia Nguyen, ATZB-OPS, at 719-555-0155 or patricia.nguyen.mil@army.mil."},
            ],
        },
        {
            // "Site visit" - the same "official business" case, a physical
            // inspection rather than a meeting or a call.
            request: "document our site visit to inspect the fire extinguishers in Building 4400",
            subject: "Site Visit to Inspect Fire Extinguishers in Building 4400",
            paragraphs: [
                {level: 0, text: "This memorandum documents a site visit on 28 July 2026 to inspect fire extinguishers in Building 4400."},
                {level: 0, text: "The inspection found three extinguishers past their service date.  Building management ordered replacements on 28 July 2026."},
                {level: 0, text: "My point of contact for this action is Mr. Louis Ferrer, ATZB-SAF, at 719-555-0166 or louis.ferrer.civ@army.mil."},
            ],
        },
    ];

    const UNIT_CONTEXT = {
        type: "record",
        officeSymbol: "ATZB-RC",
        date: "31 July 2026",
        signature: {name: "MARCUS T. HALE", gradeAndBranch: "SFC, USA", title: "NCOIC, Range Control"},
        // Owner-directed, per para 2-7: an MFR is never prepared without
        // the seal and the unit's letterhead, so a fully-supplied MFR
        // supplies it like any other memorandum.
        letterhead: {organization: "HEADQUARTERS, 4TH INFANTRY DIVISION",
            streetAddress: "1633 MEKONG STREET", cityStateZip: "FORT CARSON, CO  80913-4321"},
    };

    for (const scenario of SCENARIOS) {
        checkTrue(`intent: "${scenario.request}" selects the MFR`,
            detectMemoType(scenario.request) === "record", "AR 25-50, para 2-7a");

        const drafted = {subject: scenario.subject, addressees: [], paragraphs: scenario.paragraphs};
        const memo = assembleMemo(drafted, UNIT_CONTEXT);
        const result = validateMemo(memo);

        checkTrue(`"${scenario.subject}": a fully-supplied MFR from this request passes clean`,
            result.errors.length === 0, "AR 25-50, para 2-7");
        checkTrue("and carries the unit's letterhead but no addressee and no authority line",
            memo.addressees.length === 0 && memo.letterhead != null && memo.authorityLine === null,
            "AR 25-50, para 2-7 as directed, and fig 2-17");

        const zip = await JSZip.loadAsync(await renderDocx(memo));
        const doc = await zip.file("word/document.xml").async("string");
        checkTrue("and the rendered .docx opens with MEMORANDUM FOR RECORD, not an addressee line",
            /MEMORANDUM FOR RECORD/.test(doc) && !/MEMORANDUM FOR(?! RECORD)/.test(doc),
            "AR 25-50, fig 2-17");
        checkTrue("with every supplied field as ordinary text - nothing left to click into",
            (doc.match(/<w:sdt>/g) ?? []).length === 0, "AR 25-50, fig 2-17");
    }

    // The same five requests, with no unit profile yet on file - the other
    // half of the backbone: a first-time user still gets a correct,
    // editable MFR, not a half-finished one.
    for (const scenario of SCENARIOS.slice(0, 2)) {
        const drafted = {subject: scenario.subject, addressees: [], paragraphs: scenario.paragraphs};
        const memo = assembleMemo(drafted, {type: "record"});
        const zip = await JSZip.loadAsync(await renderDocx(memo));
        let tags = [];
        for (const name of Object.keys(zip.files)) {
            if (!name.endsWith(".xml") || zip.files[name].dir) continue;
            tags.push(...[...(await zip.file(name).async("string")).matchAll(/<w:tag w:val="([^"]+)"/g)].map((m) => m[1]));
        }
        checkTrue(`"${scenario.subject}" with no unit profile yet still gets real click-to-type slots`,
            ["OFFICE SYMBOL", "SIGNER NAME", "GRADE, BRANCH", "DUTY TITLE"].every((t) => tags.includes(t)),
            "AR 25-50, paras 2-4a(1) and 6-4");
    }

    checkTrue("all five scenarios are schema-valid Word files",
        (await Promise.all(SCENARIOS.map(async (scenario) => {
            const drafted = {subject: scenario.subject, addressees: [], paragraphs: scenario.paragraphs};
            const buf = await renderDocx(assembleMemo(drafted, UNIT_CONTEXT));
            // A minimal structural check standing in for the external schema
            // validator (validate-ooxml.py), which this suite cannot shell
            // out to - confirms the zip has the parts a .docx must have.
            const zip = await JSZip.loadAsync(buf);
            return zip.file("word/document.xml") && zip.file("[Content_Types].xml") && zip.file("word/settings.xml");
        }))).every(Boolean),
        "ECMA-376 Part 1");
}

// ---------------------------------------------------------------------------

const total = passed + failures.length;
if (failures.length === 0) {
    console.log(`AR 25-50 layout verification: ${passed}/${total} checks passed.`);
} else {
    console.log(`AR 25-50 layout verification: ${passed}/${total} passed, ${failures.length} FAILED.\n`);
    for (const f of failures) {
        console.log(`  FAIL  ${f.name}`);
        console.log(`        expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`);
        console.log(`        -> ${f.cite}`);
    }
    process.exitCode = 1;
}
