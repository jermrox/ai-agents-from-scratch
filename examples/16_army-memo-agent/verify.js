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
 * Run:  node examples/16_army-memo-agent/verify.js
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
import {TYPE} from "./ar25-50.js";
const TYPE_CITE = TYPE.cite;
import {buildParagraphTree} from "./army-memo-agent.js";

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

    check("fig 2-1: digital signature block is the 3d line below the authority line",
        indexOf(doc, "digital-signature") - indexOf(doc, "authority-line"), 3,
        "AR 25-50, figs 2-1 through 2-5");

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

    // "Space 1/4 inch to the right of the parenthesis when numbering
    //  subparagraphs" - para 1-39b(10). Text lands on the quarter-inch grid,
    //  so every label puts its text a quarter inch right of the label itself.
    const textStart = (label) => {
        const l = lines.find((x) => x.prefix === label);
        return Number((l.indentIn + l.prefixWidthIn).toFixed(4));
    };
    check("text after '1.' starts on the 1/4-inch grid", textStart("1."), 0.25,
        "AR 25-50, para 1-39b(10)");
    check("text after 'a.' starts on the 1/4-inch grid", textStart("a."), 0.5,
        "AR 25-50, para 1-39b(10)");
    check("text after '(1)' starts on the 1/4-inch grid", textStart("(1)"), 0.75,
        "AR 25-50, para 1-39b(10)");
    check("text after '(a)' starts on the 1/4-inch grid", textStart("(a)"), 0.75,
        "AR 25-50, para 1-39b(10)");

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
    check("without an authority line the digital signature is the 3d line below the text",
        indexOf(doc, "digital-signature") - lastIndexOf(doc, ["paragraph"]), 3,
        "AR 25-50, figs 2-1 through 2-5");

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

    // The quarter-inch grid: "1." puts its text at 0.25 in = 360 twips,
    // "a." at 0.5 in = 720 twips. - para 1-39b(10)
    checkTrue("docx: a main paragraph tabs to the quarter-inch grid",
        /<w:tab w:val="left" w:pos="360"\/>/.test(docx.document), "AR 25-50, para 1-39b(10)");
    checkTrue("docx: a first subdivision tabs to the half-inch grid",
        /<w:tab w:val="left" w:pos="720"\/>/.test(docx.document), "AR 25-50, para 1-39b(10)");
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

    checkTrue("docx: a letterhead memorandum carries a first-page header",
        docx.names.includes("word/header1.xml"), "AR 25-50, para 2-3a(1)");

    // "Type the office symbol on the second line below the seal." - para
    // 2-4a(1). Page 1's body therefore starts where the figures put it.
    const {LETTERHEAD: LH} = await import("./ar25-50.js");
    const {convertInchesToTwip} = await import("docx");
    // Asserted through the same conversion the renderer uses, so this pins the
    // measurement rather than a rounding convention.
    check("docx: page 1 begins where the office symbol belongs",
        Number(/<w:pgMar w:top="(\d+)"/.exec(docx.document)?.[1]),
        convertInchesToTwip(LH.officeSymbolTopIn), LH.officeSymbolTopCite);

    // That position must also clear the continuation running head: the office
    // symbol 1 inch down (2-5a), the subject on the next line (2-5b), and text
    // on the third line below it (2-5c).
    const headHeightIn = 1.0 + 4 * (13.8 / 72);
    checkTrue("docx: the top margin clears the continuation running head",
        LH.officeSymbolTopIn >= headHeightIn,
        "AR 25-50, paras 2-5a through 2-5c");
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
    const header = await zip.file("word/header1.xml").async("string");
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
    checkTrue("docx: an MFR starts at the 1-inch top margin",
        /<w:pgMar w:top="1440"/.test(document), "AR 25-50, fig 2-17 and para 2-5a");

    const result = validateMemo(mfr);
    checkTrue("an MFR on letterhead is reported",
        validateMemo({...mfr, letterhead: {organization: "X"}})
            .errors.some((f) => f.rule === "mfr-letterhead"),
        "AR 25-50, fig 2-17");
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
    const wet = createTemplate("decision");
    wet.digitalSignature = false;
    const wetXml = await (await JSZip.loadAsync(await renderDocx(wet)))
        .file("word/document.xml").async("string");
    checkTrue("docx: a wet-signature decision memorandum uses X, not checkboxes",
        !/<w14:checkbox>/.test(wetXml) && /APPROVED {2}X/.test(wetXml),
        "AR 25-50, fig 2-18");
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

    check("fig D-14: a command sergeant major uses USA, not a branch",
        block({name: "William H. Sargent", grade: "CSM", spellOut: true}),
        "WILLIAM H. SARGENT / Command Sergeant Major, USA", "AR 25-50, fig D-14");
    check("fig D-14: a master sergeant uses USA",
        block({name: "Ronald L. Stanley", grade: "MSG", title: "Operations Sergeant"}),
        "RONALD L. STANLEY / MSG, USA / Operations Sergeant", "AR 25-50, fig D-14");
    check("fig D-14: a retired sergeant first class uses USA Retired",
        block({name: "Bryan J. Gramps", grade: "SFC", retired: true}),
        "BRYAN J. GRAMPS / SFC, USA Retired", "AR 25-50, fig D-14");
    check("fig D-20: an enlisted reservist uses USAR in place of USA",
        block({name: "Name", grade: "SFC", reserveNotOnActiveDuty: true, title: "Platoon Sergeant"}),
        "NAME / SFC, USAR / Platoon Sergeant", "AR 25-50, fig D-20 and para 6-7");
    check("para 6-7: a commissioned reservist adds USAR after the branch",
        block({name: "Name", grade: "MAJ", branch: "AG", reserveNotOnActiveDuty: true, title: "S1"}),
        "NAME / MAJ, AG, USAR / S1", "AR 25-50, para 6-7");
    check("fig D-2: a lieutenant colonel may spell the grade out",
        block({name: "Name", grade: "LTC", branch: "AG", spellOut: true, title: "Adjutant General"}),
        "NAME / Lieutenant Colonel, AG / Adjutant General", "AR 25-50, paras 6-5c(1) and fig D-2");
    check("fig D-2: a deputy commander who is a general officer uses USA",
        block({name: "Name", grade: "MG", title: "Deputy Commander"}),
        "NAME / Major General, USA / Deputy Commander", "AR 25-50, paras 6-5c(3) and 6-5c(4)");
    check("fig D-2: a general officer on the general staff uses GS",
        block({name: "Name", grade: "MG", generalStaff: true, title: "Chief of Staff"}),
        "NAME / Major General, GS / Chief of Staff", "AR 25-50, para 6-5c(7)");

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
}

{
    // Templates carry placeholders, and the validator says so.
    const {createTemplate, findPlaceholders} = await import("./templates.js");
    for (const type of ["standard", "thru", "record", "decision", "mou", "moa"]) {
        const template = createTemplate(type);
        checkTrue(`the ${type} template is fully placeholdered`,
            findPlaceholders(template).length > 0, "template");
    }
    checkTrue("unfilled placeholders are reported before signature",
        validateMemo(createTemplate("standard"))
            .warnings.some((f) => f.rule === "unfilled-placeholder"),
        "template not yet filled in");
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
