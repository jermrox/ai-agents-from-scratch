/**
 * Word (.docx) output for AR 25-50 memorandums.
 *
 * This is the deliverable format: what actually gets staffed is a Word file,
 * and it has to stay correct after somebody opens it and edits the text.
 *
 * The design consequence is that the .docx is NOT a dump of the pre-broken
 * lines the other renderers use. Word gets whole paragraphs plus the exact
 * indents, tab stops, and spacing from AR 25-50, and does its own line
 * breaking. Edit a sentence and the paragraph reflows correctly; a document of
 * frozen one-line paragraphs would shatter on the first edit.
 *
 * The two agree because both measure Arial the same way - the layout engine
 * uses the Helvetica advance widths Arial is built to match.
 *
 * Nothing here invents a measurement. Every number traces to ar25-50.js:
 *   Arial 12 pt                    para 1-19
 *   1-inch left/right/bottom       para 2-3c, no right justification
 *   single spacing, blank line     para 2-4b(2)
 *   between paragraphs
 *   quarter-inch tab grid          para 1-39b(10)
 *   first line indented, wrap      para 2-4a(6) and figs 2-1 through 2-5
 *   flush to the left margin
 *   signature block at centre      para 2-4c(2)(a)
 *   page number centred at foot    para 2-5d
 */

import fs from "fs/promises";
import path from "path";
import {fileURLToPath} from "url";
import {
    Document, Packer, Paragraph, TextRun, Tab, TabStopType, AlignmentType, PageBreak,
    LineRuleType, Header, Footer, PageNumber, ImageRun, UnderlineType,
    CheckBox, convertInchesToTwip, ImportedXmlComponent,
} from "docx";

import {
    LAYOUT, TEXT_WIDTH_IN, TYPE, LETTERHEAD, SPACING, PARAGRAPH_LABELS,
    MAX_SUBDIVISION_DEPTH, ADDRESS_LIMITS, buildEnclosureListing, COPY_MARKERS,
    normalizePunctuationSpacing, formatMemoDate, AGREEMENT_FORMAT, LISTING,
    agreementParties, DECISION_APPROVAL, EXCLUSIVE_FOR, PERSONAL_ADDRESS_TYPES,
    normalizeZipSpacing,
} from "./ar25-50.js";
import {layoutMemo, usesLetterhead} from "./memo-formatter.js";
import {measureTextIn, breakLines} from "./text-metrics.js";
import {resolveSignature} from "./signature-blocks.js";

const IN = convertInchesToTwip;

/**
 * Line height. Word's "single" spacing is 240 twentieths of a point with
 * lineRule AUTO, which for 12 pt Arial resolves to the 13.8 pt the layout
 * engine assumes. Setting an exact rule instead would defeat the point: the
 * document has to keep working if the reviewing office is on a different Word
 * build.
 */
const SINGLE = {before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO};

const LINE_HEIGHT_IN = 13.8 / 72;

/**
 * docx-js expresses image dimensions in pixels at 96 dpi, not in points.
 * Passing points silently renders the seal at three quarters of its size,
 * which is exactly the kind of unit slip an "exact measurements" requirement
 * exists to catch, so the conversion is named rather than inlined.
 */
const PX_PER_IN = 96;

/** English Metric Units per inch, for the floating-position offsets. */
const EMU_PER_IN = 914400;

/** Every run in the document. No exceptions - para 1-19 and para 1-20. */
function run(text, extra = {}) {
    return new TextRun({text, font: TYPE.fontFamily, size: TYPE.fontSizePt * 2, ...extra});
}

function tabRun() {
    return new TextRun({children: [new Tab()], font: TYPE.fontFamily, size: TYPE.fontSizePt * 2});
}

const xmlEscape = (t) => String(t).replace(/[&<>]/g,
    (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;"}[c]));

/**
 * The run properties a run carries. - paras 1-19, 1-20
 *
 * The size is a parameter only because the letterhead is set smaller than the
 * body (LETTERHEAD.titleSizePt). Every run a writer types is TYPE.fontSizePt.
 */
const runProps = (sizePt = TYPE.fontSizePt) =>
    `<w:rPr><w:rFonts w:ascii="${TYPE.fontFamily}" w:hAnsi="${TYPE.fontFamily}" w:cs="${TYPE.fontFamily}"/>` +
    `<w:sz w:val="${sizePt * 2}"/><w:szCs w:val="${sizePt * 2}"/></w:rPr>`;

const RUN_PROPS = runProps();

/**
 * A hand-written XML fragment, as a component the document can hold.
 *
 * `ImportedXmlComponent.fromXmlString` hands back the *document* node rather
 * than the element in it: its rootKey is undefined, and serializing it writes a
 * literal `<undefined>` wrapper around the real element. That wrapper is in no
 * namespace and is legal nowhere, so Word declines to open the file - while
 * LibreOffice descends through it and renders the contents, which is how it
 * survived a rendered page. Unwrap it here, once.
 *
 * If a later docx release returns the element itself, `rootKey` is set and it
 * is used as-is. Either way the root name is checked, so this fails loudly
 * rather than quietly emitting something Word will reject.
 */
function importXml(xml, expectedRoot) {
    const parsed = ImportedXmlComponent.fromXmlString(xml);
    const node = parsed.rootKey === undefined ? parsed.root?.[0] : parsed;
    if (!node || node.rootKey !== expectedRoot) {
        throw new Error(`imported XML did not yield a <${expectedRoot}> element`);
    }
    return node;
}

/**
 * A stable, positive `w:id` for a content control.
 *
 * Word writes an id on every control. It is optional in the schema, but every
 * slot in a memorandum has a distinct prompt, so hashing the prompt gives ids
 * that are distinct within the document and identical from one run of the
 * generator to the next - the file stays byte-reproducible.
 */
function slotId(prompt) {
    let h = 0;
    for (const ch of prompt) h = (Math.imul(h, 31) + ch.codePointAt(0)) | 0;
    return (h & 0x7fffffff) || 1;
}

/**
 * A value, or a click-to-type slot where one belongs.
 *
 * A supplied value is an ordinary run. An unsupplied one becomes a plain-text
 * content control: it shows a grey prompt, it is a single click target, and
 * typing replaces the whole prompt rather than editing around it. The slot
 * carries the document's own run properties, so what you type comes out Arial
 * 12 like everything else - and `lockFormatting()` means it cannot be changed
 * to anything else.
 *
 * `w:lock="sdtContentLocked"` is deliberately NOT set: the point is that these
 * are the parts you fill in. What is locked is the formatting, not the text.
 *
 * The children of `w:sdtPr` are an xsd:sequence (ECMA-376 Part 1, para
 * 17.5.2.38): rPr, alias, tag, id, lock, placeholder, temporary, showingPlcHdr,
 * then the type. Emit them in any other order and Word answers with "unreadable
 * content" and offers to repair the file - LibreOffice accepts it either way,
 * so a rendered page cannot catch this. It is asserted in verify.js instead.
 */
function slot(value, prompt, sizePt = TYPE.fontSizePt) {
    const text = value == null ? "" : String(value).trim();
    if (text) return run(text, sizePt === TYPE.fontSizePt ? {} : {size: sizePt * 2});

    const props = runProps(sizePt);
    return importXml(
        `<w:sdt>` +
        `<w:sdtPr>` +
        props +
        `<w:alias w:val="${xmlEscape(prompt)}"/>` +
        `<w:tag w:val="${xmlEscape(prompt)}"/>` +
        `<w:id w:val="${slotId(prompt)}"/>` +
        `<w:showingPlcHdr/>` +
        `<w:text/>` +
        `</w:sdtPr>` +
        `<w:sdtContent><w:r>${props}<w:t xml:space="preserve">${xmlEscape(prompt)}</w:t></w:r></w:sdtContent>` +
        `</w:sdt>`,
        "w:sdt");
}

/** A regulation blank line. */
function blankParagraph(count = 1) {
    return Array.from({length: count}, () => new Paragraph({spacing: SINGLE, children: [run("")]}));
}

/** "Nth line below" emits N-1 blank paragraphs. */
function gapParagraphs(spacing) {
    return blankParagraph(Math.max(0, spacing.linesBelow - 1));
}

/** Next quarter-inch tab stop strictly past a position. - para 1-39b(10) */
function tabStopAfter(positionIn) {
    const stop = LAYOUT.labelGapIn;
    return (Math.floor((positionIn + 1e-9) / stop) + 1) * stop;
}

// ---------------------------------------------------------------------------
// Letterhead
// ---------------------------------------------------------------------------

/**
 * First-page header: the DoD seal at the left margin, the organization block
 * centred on the page.
 *
 * "All official letterhead stationery will bear the DoD seal" (para 1-16b(1))
 * and "do not print any seals, emblems, decorative devices, distinguishing
 * insignia, slogans, office symbols, names, or mottos on letterhead stationery
 * except those approved or directed by HQDA" (para 1-16b(2)).
 *
 * `seal` is the official seal image from the APD letterhead template. It is a
 * fixed asset - the seal does not change - so it is configured once and reused.
 * Without it the header carries the organization block alone rather than a
 * drawn approximation, which para 1-16b(2) would not permit.
 */
function letterheadHeader(memo, sealImage) {
    const lh = memo.letterhead ?? {};
    // "DEPARTMENT OF THE ARMY" is fixed; the three lines under it are the
    // office's, and stay slots until it says what they are. - para 1-18
    const upper = (v) => (v ? String(v).trim().toUpperCase() : "");
    const lines = [
        {text: LETTERHEAD.lines[0], sizePt: LETTERHEAD.titleSizePt},
        {text: upper(lh.organization), prompt: "ORGANIZATION", sizePt: LETTERHEAD.addressSizePt},
        {text: upper(lh.streetAddress), prompt: "STREET ADDRESS", sizePt: LETTERHEAD.addressSizePt},
        {text: upper(lh.cityStateZip), prompt: "CITY, STATE ZIP+4", sizePt: LETTERHEAD.addressSizePt},
    ];

    /*
     * The seal is anchored to the page, not laid out in the flow, so the
     * centred text block is not pushed off centre by it - the figures centre
     * the organization block on the page, not on the space beside the seal.
     *
     * It rides in the *first letterhead paragraph* rather than one of its own.
     * A paragraph of its own still occupies a line, even though the image in it
     * is floating, and that line pushed the whole letterhead 0.19 in down the
     * page for no reason - figure 2-1 puts the title at 0.554 in and it was
     * landing at 0.747.
     */
    const sealRun = sealImage ? [new ImageRun({
        data: sealImage,
        type: "png",
        // Exactly 0.95 inch square at the measured offsets - the artwork is
        // placed, never scaled to taste.
        // Not rounded: 0.95 in is 91.2 px, and rounding to 91 would render the
        // seal 0.002 in small.
        transformation: {
            width: LETTERHEAD.sealDiameterIn * PX_PER_IN,
            height: LETTERHEAD.sealDiameterIn * PX_PER_IN,
        },
        floating: {
            horizontalPosition: {offset: Math.round(LETTERHEAD.sealLeftIn * EMU_PER_IN)},
            verticalPosition: {offset: Math.round(LETTERHEAD.sealTopIn * EMU_PER_IN)},
            behindDocument: false,
        },
    })] : [];

    const children = lines.map((l, i) => new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO},
        children: [
            ...(i === 0 ? sealRun : []),
            l.text
                ? new TextRun({text: l.text, font: TYPE.fontFamily, size: l.sizePt * 2, bold: true})
                : slot(null, l.prompt, l.sizePt),
        ],
    }));

    return new Header({children});
}

/**
 * Continuation-page header: office symbol at the left margin 1 inch from the
 * top, subject on the line below, text resuming on the third line below the
 * subject. - paras 2-5a through 2-5c
 *
 * The half-inch space before the office symbol is what puts it at 1 inch: the
 * header itself begins at the half-inch header distance set on the section.
 */
function continuationHeader(memo) {
    // An MOU or MOA has no office symbol, so its continuation pages repeat the
    // subject alone. - figs 2-15 and 2-16
    if (memo.type === "mou" || memo.type === "moa") {
        return new Header({
            children: [
                new Paragraph({
                    spacing: {...SINGLE, before: IN(1.0 - LETTERHEAD.letterheadTopIn)},
                    children: [run("SUBJECT: "), slot(memo.subject, "SUBJECT")],
                }),
                ...blankParagraph(SPACING.continuationSubjectToText.linesBelow - 1),
            ],
        });
    }

    const symbol = memo.officeSymbol ?? "";

    return new Header({
        children: [
            new Paragraph({
                spacing: {...SINGLE, before: IN(1.0 - LETTERHEAD.letterheadTopIn)},
                children: [run(symbol)],
            }),
            new Paragraph({spacing: SINGLE, children: [run("SUBJECT: "), slot(memo.subject, "SUBJECT")]}),
            ...blankParagraph(SPACING.continuationSubjectToText.linesBelow - 1),
        ],
    });
}

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

/**
 * Office symbol at the left margin, date flush right on the same line. The
 * office symbol stands alone - no ARIMS record number is emitted.
 */
function officeSymbolParagraph(memo) {
    return new Paragraph({
        spacing: SINGLE,
        tabStops: [{type: TabStopType.RIGHT, position: IN(TEXT_WIDTH_IN)}],
        children: [slot(memo.officeSymbol, "OFFICE SYMBOL"), tabRun(), slot(memo.date, "DATE")],
    });
}

/**
 * Address block. Word wraps these, so the flush-left continuation of a single
 * address (para 2-4a(5)) is `indent: {left: 0}` and the quarter-inch
 * continuation of a multiple-address block (para 2-4a(5)(b)) is a hanging
 * indent.
 */
function addressParagraph(text, {hanging = false} = {}) {
    return new Paragraph({
        spacing: SINGLE,
        indent: hanging
            ? {left: IN(LAYOUT.multiAddressWrapIndentIn), hanging: IN(LAYOUT.multiAddressWrapIndentIn)}
            : undefined,
        children: [run(text)],
    });
}

/**
 * MOU/MOA heading - para 2-6c(1).
 *
 * "Center the title 'MEMORANDUM OF UNDERSTANDING' or 'MEMORANDUM OF
 *  AGREEMENT' on the second line below the seal. Type the word 'BETWEEN,' also
 *  centered, on the line immediately following the title. Center the names of
 *  agreeing agencies, separated by the word 'AND' on the line immediately
 *  following the word 'BETWEEN.'"
 *
 * An agreement carries no office symbol, date line, or addressee.
 */
function agreementHeadingParagraphs(memo) {
    const centred = (text) => new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: SINGLE,
        children: [run(text)],
    });

    const out = [
        centred(memo.type === "moa" ? "MEMORANDUM OF AGREEMENT" : "MEMORANDUM OF UNDERSTANDING"),
        centred(AGREEMENT_FORMAT.betweenKeyword),
    ];

    for (const partyLine of agreementParties(memo.parties ?? [])) out.push(centred(partyLine));

    // "Type the word 'SUBJECT:' at the left margin on the second line below the
    //  last line of the agreeing agencies' titles." - para 2-6c(2)
    out.push(...blankParagraph(AGREEMENT_FORMAT.subjectLinesBelowAgencies - 1));
    out.push(new Paragraph({spacing: SINGLE, children: [run("SUBJECT: "), slot(memo.subject, "SUBJECT")]}));
    // "Begin the first line of text at the left margin on the third line below
    //  the last line of the subject." - para 2-6c(3)
    out.push(...blankParagraph(AGREEMENT_FORMAT.textLinesBelowSubject - 1));
    return out;
}

/**
 * MOU/MOA closing - para 2-6c(5).
 *
 * "Signature blocks on MOUs and MOAs are unique because the signature blocks of
 *  the agreeing agencies' parties appear on the same line [...] on the fifth
 *  line following the last line of text [...] preceded by overscoring [...] in
 *  protocol order, with the senior official on the right."
 */
function agreementClosingParagraphs(memo) {
    const out = blankParagraph(AGREEMENT_FORMAT.signatureLinesBelowText - 1);
    const colIn = AGREEMENT_FORMAT.signatureColumnIn;
    const tabs = [{type: TabStopType.LEFT, position: IN(colIn)}];

    const ruleOf = (widthIn) => {
        const one = measureTextIn("_", TYPE.fontSizePt);
        return "_".repeat(Math.max(1, Math.round(widthIn / one)));
    };
    const nameRule = ruleOf(AGREEMENT_FORMAT.signatureRuleIn);
    const dateRule = ruleOf(AGREEMENT_FORMAT.dateRuleIn);

    // Rows of one column: overscore, block, date rule, centred caption.
    const column = (signer) => {
        const rows = [{text: nameRule, indentIn: 0}];
        if (signer.name) rows.push({text: String(signer.name).toUpperCase(), indentIn: 0});
        const grade = signer.gradeAndBranch ?? signer.grade;
        if (grade) rows.push({text: grade, indentIn: 0});
        const title = signer.titleAndAgency ?? signer.title;
        if (title) {
            // Para 6-4c: a title needing a second line continues at 1/4 inch.
            for (const part of wrapSignatureTitle(title, AGREEMENT_FORMAT.signatureRuleIn)) {
                rows.push(part);
            }
        }
        rows.push({text: dateRule, indentIn: 0});
        rows.push({text: AGREEMENT_FORMAT.dateCaption, indentIn: captionOffsetIn()});
        return rows;
    };

    const signers = memo.signers ?? [];
    const left = signers[0] ? column(signers[0]) : [];
    const right = signers[1] ? column(signers[1]) : [];

    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const children = [];
        if (left[i]) children.push(run(indentText(left[i])));
        children.push(tabRun());
        if (right[i]) children.push(run(indentText(right[i])));
        out.push(new Paragraph({spacing: SINGLE, tabStops: tabs, children}));
    }

    // "If an MOU or MOA has three agreeing agencies, center the signature
    //  block of the highest ranking official at the bottom." - para 2-6c(5)(d)
    if (signers[2]) {
        out.push(...blankParagraph(AGREEMENT_FORMAT.signatureLinesBelowText - 1));
        const centreIn = (TEXT_WIDTH_IN - AGREEMENT_FORMAT.signatureRuleIn) / 2;
        for (const row of column(signers[2])) {
            out.push(new Paragraph({
                spacing: SINGLE,
                indent: {left: IN(centreIn + row.indentIn)},
                children: [run(row.text)],
            }));
        }
    }

    // The enclosure listing sits at the left margin below the blocks. - fig 2-15
    const agreementListing = buildEnclosureListing(memo.enclosures ?? []);
    if (agreementListing.label) {
        out.push(...blankParagraph(1));
        out.push(new Paragraph({spacing: SINGLE, children: [run(agreementListing.label)]}));
        for (const entry of agreementListing.entries) {
            out.push(new Paragraph({spacing: SINGLE, children: [run(entry.text)]}));
        }
    }

    return out;
}

/** "(Date)" is centred beneath its own rule. */
function captionOffsetIn() {
    const w = measureTextIn(AGREEMENT_FORMAT.dateCaption, TYPE.fontSizePt);
    return (AGREEMENT_FORMAT.dateRuleIn - w) / 2;
}

/** Indentation inside a signature column, expressed as leading spaces. */
function indentText(row) {
    if (!row.indentIn) return row.text;
    const space = measureTextIn(" ", TYPE.fontSizePt);
    return " ".repeat(Math.max(0, Math.round(row.indentIn / space))) + row.text;
}

/** Wrap a signature title to its column, continuing at 1/4 inch. - para 6-4c */
function wrapSignatureTitle(title, columnIn, continuation = false) {
    const indentForLine = (i) =>
        (i === 0 && !continuation ? 0 : LAYOUT.multiAddressWrapIndentIn);
    return breakLines(title, {
        sizePt: TYPE.fontSizePt,
        indentForLine,
        widthForLine: (i) => columnIn - indentForLine(i),
    }).map((b) => ({text: b.text, indentIn: b.indentIn}));
}

/**
 * A distribution or copy-furnished entry: blocked flush with the left margin
 * (para 2-4a(5)(c), fig 2-14), with subordinate entries indented as figure 2-8
 * indents the Army commands under "Commander".
 */
function listingParagraph(entry) {
    const text = typeof entry === "string" ? entry : (entry.text ?? "");
    const level = typeof entry === "string" ? 0 : (Number.isFinite(entry.indent) ? entry.indent : 0);
    return new Paragraph({
        spacing: SINGLE,
        indent: level ? {left: IN(level * LISTING.subEntryIndentIn)} : undefined,
        children: [run(text)],
    });
}

function buildHeadingParagraphs(memo) {
    const out = [];
    // ZIP two spaces after the State - para 5-10b.
    const styleAddress = (a) => normalizeZipSpacing(
        memo.addressStyle === "uppercase" ? String(a).toUpperCase() : String(a));

    // Suspense date: flush right, bold, two lines above the date line. - 2-4a(4)
    if (memo.suspenseDate) {
        out.push(new Paragraph({
            spacing: SINGLE,
            tabStops: [{type: TabStopType.RIGHT, position: IN(TEXT_WIDTH_IN)}],
            children: [tabRun(), run(`S: ${memo.suspenseDate}`, {bold: true})],
        }));
        out.push(...blankParagraph(SPACING.suspenseAboveDate.linesAbove - 1));
    }

    out.push(officeSymbolParagraph(memo));
    out.push(...gapParagraphs(SPACING.officeSymbolToMemorandumFor));

    const thru = memo.thru ?? [];
    const addressees = memo.addressees ?? [];

    if (memo.type === "record") {
        out.push(new Paragraph({spacing: SINGLE, children: [run("MEMORANDUM FOR RECORD")]}));
    } else if (memo.type === "exclusiveFor") {
        // "Memorandum Exclusive For [Full Name], [Title], [Mailing Address]"
        // - para 1-12b(1). Not the uppercase MEMORANDUM FOR.
        const keyword = memo.toCommanderOf
            ? EXCLUSIVE_FOR.commanderKeyword
            : EXCLUSIVE_FOR.keyword;
        const target = [memo.toCommanderOf ?? addressees[0], memo.addresseeTitle, memo.addresseeAddress]
            .filter(Boolean).join(", ");
        out.push(addressParagraph(`${keyword} ${target}`.trim()));
    } else {
        // After a THRU chain the addressee line reads "FOR". - figs 2-11, 2-12
        const keyword = thru.length ? "FOR" : "MEMORANDUM FOR";

        if (thru.length === 1) {
            out.push(addressParagraph(`MEMORANDUM THRU ${styleAddress(thru[0])}`));
            out.push(...blankParagraph(1));
        } else if (thru.length > 1) {
            out.push(new Paragraph({spacing: SINGLE, children: [run("MEMORANDUM THRU")]}));
            out.push(...gapParagraphs(SPACING.memorandumForToFirstAddress));
            thru.forEach((stop, i) => {
                out.push(addressParagraph(styleAddress(stop), {hanging: true}));
                if (i < thru.length - 1) out.push(...blankParagraph(1));
            });
            out.push(...blankParagraph(1));
        }

        if (memo.seeDistribution || addressees.length > ADDRESS_LIMITS.seeDistributionAbove) {
            out.push(new Paragraph({spacing: SINGLE, children: [run(`${keyword} SEE DISTRIBUTION`)]}));
        } else if (addressees.length <= 1) {
            // Appreciation and commendation address the person. - para 2-4a(5)
            const personal = PERSONAL_ADDRESS_TYPES.includes(memo.type)
                ? [addressees[0], memo.addresseeTitle, memo.addresseeAddress].filter(Boolean).join(", ")
                : null;
            // No addressee yet: the label stands with a slot to click into.
            const target = personal ?? (addressees[0] ? styleAddress(addressees[0]) : null);
            out.push(target
                ? addressParagraph(`${keyword} ${target}`)
                : new Paragraph({spacing: SINGLE,
                                 children: [run(`${keyword} `), slot(null, "ADDRESSEE")]}));
        } else {
            out.push(new Paragraph({spacing: SINGLE, children: [run(keyword)]}));
            out.push(...gapParagraphs(SPACING.memorandumForToFirstAddress));
            for (const a of addressees) out.push(addressParagraph(styleAddress(a), {hanging: true}));
        }
    }

    out.push(...gapParagraphs(SPACING.addressToSubject));
    out.push(new Paragraph({spacing: SINGLE, children: [run("SUBJECT: "), slot(memo.subject, "SUBJECT")]}));
    out.push(...gapParagraphs(SPACING.subjectToBody));
    return out;
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

/**
 * One Word paragraph per regulation paragraph, so the document stays editable.
 *
 *   indent.firstLine  puts the label at the subdivision indent
 *   indent.left = 0   returns the wrap to the left margin - para 2-4a(6)
 *   tabStops          places the text on the quarter-inch grid - para 1-39b(10)
 *
 * `keepLines` on paragraphs of three lines or fewer implements para 2-5c(1)
 * ("do not divide a paragraph of three lines or fewer between pages") and
 * `widowControl` implements para 2-5c(2).
 */
function bodyParagraphs(memo, doc) {
    const paragraphs = memo.paragraphs ?? [];
    const numbered = paragraphs.length > 1;
    const out = [];

    // Line counts come from the layout engine so keepLines matches what the
    // regulation's three-line rule is actually about.
    const lineCounts = new Map();
    doc.bodyBlocks.forEach((b) => lineCounts.set(b.text, b.lines.length));

    const walk = (nodes, depth) => {
        let ordinal = 0;
        nodes.forEach((node) => {
            const indentIn = LAYOUT.indentByLevelIn[Math.min(depth, LAYOUT.indentByLevelIn.length - 1)];
            const index = node.literal ? ordinal : ordinal++;
            const label = (node.literal || (depth === 0 && !numbered))
                ? ""
                : PARAGRAPH_LABELS[Math.min(depth, MAX_SUBDIVISION_DEPTH)].format(index);

            // A literal row keeps its spacing and gets explicit tab stops, so
            // the columns of a fig 2-18 approval or coordination line land
            // where they were written rather than where a space happens to be.
            const source = node.approvalLine
                ? DECISION_APPROVAL.options.map((o) => `${o}  ${DECISION_APPROVAL.wetMark}`).join("\t")
                : (node.text ?? "");
            const text = node.literal ? String(source) : normalizePunctuationSpacing(source);
            const children = [];
            let tabStops;

            if (node.literal && node.tabsIn?.length) {
                tabStops = node.tabsIn.map((inches) => ({type: TabStopType.LEFT, position: IN(inches)}));
            }

            if (label) {
                const textStartIn = tabStopAfter(indentIn + measureTextIn(label, TYPE.fontSizePt));
                tabStops = [{type: TabStopType.LEFT, position: IN(textStartIn)}];
                children.push(run(label), tabRun());
            }
            if (node.approvalLine && memo.digitalSignature !== false) {
                // "Preparing a digital decision memorandum" - fig 2-19 - shows
                // a checkbox the approver clicks rather than an X to strike.
                DECISION_APPROVAL.options.forEach((option, i) => {
                    if (i > 0) children.push(tabRun());
                    children.push(run(`${option}  `));
                    children.push(new CheckBox({checked: false}));
                });
            } else if (node.literal && node.tabsIn?.length) {
                text.split("\t").forEach((cell, i) => {
                    if (i > 0) children.push(tabRun());
                    children.push(...emphasize(cell));
                });
            } else {
                children.push(...emphasize(text));
            }

            const lines = lineCounts.get(text) ?? 1;

            out.push(new Paragraph({
                spacing: SINGLE,
                indent: label
                    ? {left: 0, firstLine: IN(indentIn)}
                    : (node.literal && indentIn ? {left: IN(indentIn)} : undefined),
                tabStops,
                keepLines: lines <= 3,   // para 2-5c(1)
                widowControl: true,      // para 2-5c(2)
                children,
            }));
            out.push(...blankParagraph(SPACING.betweenParagraphs.linesBelow - 1));

            if (node.children?.length) walk(node.children, depth + 1);
        });
    };

    walk(paragraphs, 0);
    if (out.length) out.pop(); // no trailing blank before the closing gap
    return out;
}

/**
 * Underline a leading heading word such as "PURPOSE." in a decision
 * memorandum (fig 2-18). "Use boldface or italic type to emphasize a specific
 * or important fact. Do not overuse this method" - para 1-32 - so this only
 * fires on the `_underline_` marker a template puts there deliberately.
 */
function emphasize(text) {
    const parts = String(text).split(/(_[^_]+_)/g).filter((s) => s !== "");
    return parts.map((part) => {
        const m = /^_([^_]+)_$/.exec(part);
        return m ? run(m[1], {underline: {type: UnderlineType.SINGLE}}) : run(part);
    });
}

// ---------------------------------------------------------------------------
// Closing
// ---------------------------------------------------------------------------

function closingParagraphs(memo) {
    const out = [];
    const sigIn = LAYOUT.signatureBlockIndentIn;
    const sigTab = [{type: TabStopType.LEFT, position: IN(sigIn)}];

    if (memo.authorityLine) {
        out.push(...gapParagraphs(SPACING.textToAuthorityLine));
        out.push(new Paragraph({
            spacing: SINGLE,
            children: [run(String(memo.authorityLine).toUpperCase())],
        }));
    }

    const total = memo.authorityLine
        ? SPACING.authorityLineToSignature.linesBelow
        : SPACING.textToSignature.linesBelow;

    if (memo.digitalSignature !== false) {
        out.push(...blankParagraph(SPACING.authorityLineToDigitalSignature.linesBelow - 1));
        out.push(new Paragraph({
            spacing: SINGLE,
            tabStops: sigTab,
            children: [tabRun(), run(memo.digitalSignaturePlaceholder ?? "[place digital signature block here]")],
        }));
        out.push(...blankParagraph(total - SPACING.authorityLineToDigitalSignature.linesBelow - 1));
    } else {
        out.push(...blankParagraph(total - 1));
    }

    // Two columns on the same lines: enclosure listing left, signature block
    // beginning at the centre of the page. - paras 2-4c(2)(a) and 2-4c(3)
    const sig = memo.signature ?? {};
    const right = signatureBlockLines(sig);
    const left = enclosureListingLines(memo.enclosures ?? []);

    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const children = [];
        if (left[i]) children.push(run(left[i].text));
        children.push(tabRun());
        if (right[i]) children.push(right[i].slot ? slot(null, right[i].slot) : run(right[i].text));
        out.push(new Paragraph({
            spacing: SINGLE,
            tabStops: sigTab,
            indent: left[i]?.hanging
                ? {left: IN(LAYOUT.multiAddressWrapIndentIn), hanging: IN(LAYOUT.multiAddressWrapIndentIn)}
                : undefined,
            children,
        }));
    }

    if (memo.distribution?.length) {
        out.push(...gapParagraphs(SPACING.lastBlockToDistribution));
        out.push(new Paragraph({spacing: SINGLE, children: [run("DISTRIBUTION:")]}));
        // "(see next page)" directly under DISTRIBUTION: when the listing goes
        // on a page of its own. - fig 2-9
        if (memo.distributionOnSeparatePage) {
            out.push(new Paragraph({spacing: SINGLE, children: [run(LISTING.separatePageMarker)]}));
        } else {
            for (const entry of memo.distribution) out.push(listingParagraph(entry));
        }
    }

    if (memo.copiesFurnished?.length) {
        out.push(...gapParagraphs(SPACING.lastBlockToCopiesFurnished));
        const marker = memo.copiesWithoutEnclosures
            ? `${COPY_MARKERS.memorandum} (w/o encls)`
            : COPY_MARKERS.memorandum;
        out.push(new Paragraph({spacing: SINGLE, children: [run(marker)]}));
        for (const entry of memo.copiesFurnished) out.push(listingParagraph(entry));
    }

    return out;
}

/**
 * "Type the signature block of military officials on three lines [...] name,
 *  military rank and branch, and title. If the title requires more than one
 *  line, continue it on the fourth line, indenting 1/4 inch. Type the
 *  signature block of civilian officials on two lines." - para 6-4c
 */
function signatureBlockLines(sig) {
    const resolved = resolveSignature(sig);

    // Nothing supplied: the block is three click-to-type slots on the three
    // lines para 6-4c gives it, so the space it occupies is already right.
    if (!resolved.name && !resolved.gradeAndBranch && resolved.titleSegments.length === 0) {
        return [{slot: "SIGNER NAME"}, {slot: "GRADE, BRANCH"}, {slot: "DUTY TITLE"}];
    }

    const lines = [{text: resolved.name}];
    if (resolved.gradeAndBranch) lines.push({text: resolved.gradeAndBranch});

    // A title continuation starts indented 1/4 inch (para 6-4c, fig D-13);
    // "Commanding" and the organization are elements of their own and start
    // flush (figs D-1 and D-9).
    const columnIn = TEXT_WIDTH_IN - LAYOUT.signatureBlockIndentIn;
    for (const segment of resolved.titleSegments) {
        for (const part of wrapSignatureTitle(segment.text, columnIn, segment.continuation)) {
            lines.push({text: indentText(part)});
        }
    }
    return lines;
}

/**
 * The enclosure listing, in whichever of the four chapter 4 forms applies.
 * See buildEnclosureListing() - the shape depends on whether each enclosure
 * was already identified in the body (para 4-2).
 */
function enclosureListingLines(encls) {
    const listing = buildEnclosureListing(encls);
    if (!listing.label) return [];
    return [
        {text: listing.label},
        ...listing.entries.map((e) => ({text: e.text, hanging: true})),
    ];
}

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------

/**
 * Build the .docx and return it as a Buffer.
 *
 * `options.seal` is a Buffer holding the official DoD seal image, or a path to
 * it. `options.sealPath` is checked when neither is given.
 */
export async function renderDocx(memo, options = {}) {
    const doc = layoutMemo(memo, options);
    const hasLetterhead = usesLetterhead(memo);

    let sealImage = null;
    if (hasLetterhead) sealImage = await loadSeal(memo, options);

    const isAgreement = memo.type === "mou" || memo.type === "moa";
    const children = [
        ...(isAgreement ? agreementHeadingParagraphs(memo) : buildHeadingParagraphs(memo)),
        ...bodyParagraphs(memo, doc),
        ...(isAgreement ? agreementClosingParagraphs(memo) : closingParagraphs(memo)),
    ];

    // The complete listing on a page of its own. - fig 2-9
    if (memo.distributionOnSeparatePage && memo.distribution?.length) {
        children.push(new Paragraph({children: [new PageBreak()]}));
        children.push(new Paragraph({spacing: SINGLE, children: [run("DISTRIBUTION:")]}));
        for (const entry of memo.distribution) children.push(listingParagraph(entry));
    }

    const multiPage = doc.pages.length > 1;

    /*
     * Page 1 never carries the continuation heading. Para 2-5b puts the office
     * symbol and subject at the top of *continuation* pages; on page 1 they are
     * already in the heading, and repeating them there is not a cosmetic
     * duplicate - the running head overflows the 1-inch top margin and pushes
     * the text down with it, so a plain-paper memorandum started 0.92 inch low
     * against the 1 inch para 2-5a gives it.
     *
     * That needs `titlePage` on whether or not there is a letterhead: it is
     * what separates the first-page header from the rest. Without a letterhead
     * page 1's header is empty, which is the point.
     *
     * The continuation header is set even when this document measures one page,
     * because Word does its own line breaking and may not agree; a second page
     * that appears in Word still has to carry its heading.
     */
    const headers = {
        first: hasLetterhead
            ? letterheadHeader(memo, sealImage)
            : new Header({children: [new Paragraph({spacing: SINGLE})]}),
        default: continuationHeader(memo),
    };

    const section = {
        properties: {
            page: {
                size: {width: IN(LAYOUT.pageWidthIn), height: IN(LAYOUT.pageHeightIn)},
                margin: {
                    // "1-inch from the left, right, and bottom edges." - 2-3c
                    left: IN(LAYOUT.marginLeftIn),
                    right: IN(LAYOUT.marginRightIn),
                    bottom: IN(LAYOUT.marginBottomIn),
                    // Page 1 begins where the office symbol belongs: "the
                    // second line below the seal" (para 2-4a(1)). A
                    // plain-paper memorandum starts at the 1-inch top margin
                    // instead (para 2-5a).
                    top: IN(hasLetterhead
                        ? (options.letterheadHeightIn ?? LETTERHEAD.officeSymbolTopIn)
                        : 1.0),
                    header: IN(LETTERHEAD.letterheadTopIn),
                    footer: IN(LAYOUT.marginBottomIn - LINE_HEIGHT_IN),
                },
            },
            titlePage: true,
        },
        headers,
        children,
    };

    // "Center the page number approximately 1-inch from the bottom of the
    //  page." - para 2-5d. Single-page memorandums are not numbered.
    if (multiPage) {
        section.footers = {
            default: new Footer({
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: SINGLE,
                    children: [new TextRun({
                        children: [PageNumber.CURRENT],
                        font: TYPE.fontFamily,
                        size: TYPE.fontSizePt * 2,
                    })],
                })],
            }),
        };
        if (hasLetterhead && options.numberFirstPage === false) {
            section.footers.first = new Footer({children: [new Paragraph({spacing: SINGLE})]});
        }
    }

    const document = new Document({
        creator: "AR 25-50 memorandum agent",
        title: memo.subject ?? "Memorandum",
        description: `Prepared under AR 25-50, ${memo.date ?? ""}`.trim(),
        styles: {
            default: {
                document: {
                    run: {font: TYPE.fontFamily, size: TYPE.fontSizePt * 2, color: "000000"},
                    paragraph: {spacing: SINGLE},
                },
                // docx-js ships Title at 28 pt and Heading 1/2 at 16/13 pt in
                // every document. Nothing here applies them, but a latent
                // style is still type above the ceiling sitting in the file,
                // one click away in Word's style gallery. Para 1-19a caps body
                // type at 12 pt, so they are overridden rather than left.
                title: {run: {font: TYPE.fontFamily, size: TYPE.maxSizePt * 2}},
                heading1: {run: {font: TYPE.fontFamily, size: TYPE.maxSizePt * 2}},
                heading2: {run: {font: TYPE.fontFamily, size: TYPE.maxSizePt * 2}},
                heading3: {run: {font: TYPE.fontFamily, size: TYPE.maxSizePt * 2}},
                heading4: {run: {font: TYPE.fontFamily, size: TYPE.maxSizePt * 2}},
                heading5: {run: {font: TYPE.fontFamily, size: TYPE.maxSizePt * 2}},
                heading6: {run: {font: TYPE.fontFamily, size: TYPE.maxSizePt * 2}},
                // Word's footnote and endnote styles default to 10 pt. No
                // memorandum here uses them, but leaving them behind means the
                // file still contains a size other than 12, so they are
                // levelled too. One size, everywhere.
                footnoteText: {run: {font: TYPE.fontFamily, size: TYPE.fontSizePt * 2}},
                footnoteTextChar: {run: {font: TYPE.fontFamily, size: TYPE.fontSizePt * 2}},
                endnoteText: {run: {font: TYPE.fontFamily, size: TYPE.fontSizePt * 2}},
                endnoteTextChar: {run: {font: TYPE.fontFamily, size: TYPE.fontSizePt * 2}},
                listParagraph: {run: {font: TYPE.fontFamily, size: TYPE.fontSizePt * 2}},
                strong: {run: {font: TYPE.fontFamily, size: TYPE.fontSizePt * 2}},
                hyperlink: {run: {font: TYPE.fontFamily, size: TYPE.fontSizePt * 2}},
            },
        },
        sections: [section],
    });

    const buffer = await Packer.toBuffer(document);
    return options.lockFormatting === false ? buffer : lockFormatting(buffer);
}

/**
 * Turn on Word's "limit formatting to a selection of styles" protection.
 *
 * The text stays fully editable - that is the whole point of shipping a .docx
 * rather than a PDF - but the font, size, spacing, indents, and margins cannot
 * be changed from inside Word. AR 25-50 fixes those (paras 1-19, 2-3c, 2-4),
 * and a reviewer "tidying up" the spacing is the most common way a compliant
 * memorandum stops being one.
 *
 * `w:formatting="1"` with `w:enforcement="1"` and no `w:edit` restricts
 * formatting only; adding `w:edit="readOnly"` would lock the text too.
 *
 * This is a deterrent, not a security control - Word protection without a
 * password is removable from the Review tab, which is the right level for a
 * document a staff officer has to be able to finish.
 */
async function lockFormatting(buffer) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);

    const settingsPath = "word/settings.xml";
    const file = zip.file(settingsPath);
    if (!file) return buffer;

    let xml = await file.async("string");
    if (xml.includes("w:documentProtection")) return buffer;

    const protection = '<w:documentProtection w:formatting="1" w:enforcement="1"/>';
    xml = insertSetting(xml, "documentProtection", protection);

    /*
     * Every tab this generator emits carries its own stop, so Word's default
     * grid never places one. It does place the tabs a *writer* types, and
     * Word's default when the element is absent is half an inch - off the
     * quarter-inch grid para 1-39b(10) sets. Naming it puts an edited
     * memorandum on the same grid as a generated one.
     */
    xml = insertSetting(xml, "defaultTabStop",
        `<w:defaultTabStop w:val="${IN(LAYOUT.labelGapIn)}"/>`);

    zip.file(settingsPath, xml);
    return zip.generateAsync({type: "nodebuffer", compression: "DEFLATE"});
}

/**
 * The children of `w:settings` that follow `w:documentProtection`.
 *
 * `w:settings` is an xsd:sequence (ECMA-376 Part 1, para 17.15.1.78): each
 * child has one legal position. `w:documentProtection` sits after
 * `w:doNotTrackFormatting` and before `w:autoFormatOverride` - which puts it
 * *after* the `w:displayBackgroundShape` the generator already writes, so
 * splicing it in behind the opening tag produced an out-of-order part. Word
 * reports that as unreadable content; LibreOffice does not care, which is why
 * this went unnoticed through a rendered page.
 *
 * Listed from `w:documentProtection` onward, in schema order.
 */
const SETTINGS_AFTER_PROTECTION = [
    "autoFormatOverride", "styleLockTheme", "styleLockQFSet", "defaultTabStop",
    "autoHyphenation", "consecutiveHyphenLimit", "hyphenationZone",
    "doNotHyphenateCaps", "showEnvelope", "summaryLength", "clickAndTypeStyle",
    "defaultTableStyle", "evenAndOddHeaders", "bookFoldRevPrinting",
    "bookFoldPrinting", "bookFoldPrintingSheets", "drawingGridHorizontalSpacing",
    "drawingGridVerticalSpacing", "displayHorizontalDrawingGridEvery",
    "displayVerticalDrawingGridEvery", "doNotUseMarginsForDrawingGridOrigin",
    "drawingGridHorizontalOrigin", "drawingGridVerticalOrigin",
    "doNotShadeFormData", "noPunctuationKerning", "characterSpacingControl",
    "printTwoOnOne", "strictFirstAndLastChars", "noLineBreaksAfter",
    "noLineBreaksBefore", "savePreviewPicture", "doNotValidateAgainstSchema",
    "saveInvalidXml", "ignoreMixedContent", "alwaysShowPlaceholderText",
    "doNotDemarcateInvalidXml", "saveXmlDataOnly", "useXSLTWhenSaving",
    "saveThroughXslt", "showXMLTags", "alwaysMergeEmptyNamespace",
    "updateFields", "hdrShapeDefaults", "footnotePr", "endnotePr", "compat",
    "docVars", "rsids", "mathPr", "themeFontLang", "clrSchemeMapping",
    "doNotIncludeSubdocsInStats", "doNotAutoCompressPictures", "forceUpgrade",
    "captions", "readModeInkLockDown", "smartTagType", "schemaLibrary",
    "shapeDefaults", "doNotEmbedSmartTags", "decimalSymbol", "listSeparator",
];

/**
 * Splice an element into `word/settings.xml` at its schema position.
 *
 * It goes before the earliest element that outranks it, or at the end of the
 * part when none is present. Elements that precede it are left alone, so this
 * holds as the generator's own settings change - including as this function's
 * own earlier insertions accumulate.
 */
function insertSetting(xml, name, element) {
    const rank = SETTINGS_AFTER_PROTECTION.indexOf(name);
    const outranked = name === "documentProtection"
        ? SETTINGS_AFTER_PROTECTION
        : (rank === -1 ? null : SETTINGS_AFTER_PROTECTION.slice(rank + 1));
    if (!outranked) throw new Error(`no schema order for w:${name}`);

    let at = xml.indexOf("</w:settings>");
    for (const after of outranked) {
        const found = xml.search(new RegExp(`<w:${after}[ />]`));
        if (found !== -1 && found < at) at = found;
    }
    return at === -1 ? xml : xml.slice(0, at) + element + xml.slice(at);
}

/**
 * The seal is a fixed asset - it does not change - so it is supplied once and
 * reused for every memorandum. Resolution order: an explicit Buffer, an
 * explicit path, `letterhead.seal` on the memo, then the repository default.
 *
 * Returns null when none is present. Para 1-16b(2) forbids substituting any
 * other device, so a missing seal produces a letterhead without one rather
 * than a drawn stand-in; the validator reports it.
 */
async function loadSeal(memo, options) {
    if (Buffer.isBuffer(options.seal)) return options.seal;

    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        options.seal,
        options.sealPath,
        memo.letterhead?.seal,
        // The department seal ships with the example and is the default for
        // every memorandum. It does not change, so there is nothing to
        // configure - para 1-16b(1) is satisfied out of the box.
        path.join(here, "assets", LETTERHEAD.sealFile),
    ].filter((c) => typeof c === "string" && c.length > 0);

    for (const candidate of candidates) {
        try {
            return await fs.readFile(candidate);
        } catch {
            // try the next candidate
        }
    }
    return null;
}

/** Write the .docx to `outPath` and return the path. */
export async function writeDocx(memo, outPath, options = {}) {
    const buffer = await renderDocx(memo, options);
    await fs.writeFile(outPath, buffer);
    return outPath;
}
