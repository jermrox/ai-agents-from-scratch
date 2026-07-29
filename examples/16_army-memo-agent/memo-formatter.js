/**
 * Deterministic AR 25-50 memorandum renderer.
 *
 * The LLM never produces layout. It produces a memo *spec* - office symbol,
 * addressees, subject, paragraph tree, signature block - and this module turns
 * that spec into lines whose vertical placement is computed from the line
 * counts in ar25-50.js. Format compliance is therefore a property of the code,
 * not of the model's mood.
 *
 * Two backends share one line model:
 *   renderText() - monospace approximation, useful in a terminal and for
 *                  counting lines during validation
 *   renderHtml() - print-accurate: real inches, 8.5x11 page, 1-inch margins,
 *                  letterhead with the DoD seal slot
 */

import {
    SPACING,
    LAYOUT,
    TEXT_WIDTH_IN,
    TYPE,
    LETTERHEAD,
    PARAGRAPH_LABELS,
    MAX_SUBDIVISION_DEPTH,
    ADDRESS_LIMITS,
    enclosureLabel,
    COPY_MARKERS,
    formatMemoDate,
    inchesToChars,
    AGREEMENT_FORMAT,
    normalizePunctuationSpacing,
    stripEmphasis,
    LISTING,
    ADDRESSING,
    agreementParties,
    DECISION_APPROVAL,
} from "./ar25-50.js";

import {breakLines, measureTextIn} from "./text-metrics.js";

/**
 * Rendering options. `charsPerInch` only affects the plain-text backend; the
 * regulation's unit is the inch, and the HTML backend uses inches directly.
 *
 * Lines per page are derived from the 1-inch bottom margin (para 2-3c) and
 * Word's single-spaced line height for 12 pt Arial (13.8 pt = 0.1917 in).
 * The first page holds fewer lines because the letterhead occupies the top.
 */
export const DEFAULT_OPTIONS = {
    fontSizePt: TYPE.fontSizePt,
    charsPerInch: 12,       // plain-text preview grid only
    lineHeightPt: 13.8,     // Word single spacing for 12 pt Arial
    // Where the office symbol sits on page 1 - para 2-4a(1), measured from the
    // figures. See LETTERHEAD.officeSymbolTopIn.
    letterheadHeightIn: LETTERHEAD.officeSymbolTopIn,
    firstPageLines: null,   // computed when null
    continuationPageLines: null,
    digitalSignaturePlaceholder: "[place digital signature block here]",
    sealPlaceholder: "[DoD seal]",

    // Para 2-5d says to centre the page number about 1 inch from the bottom of
    // the page for multiple-page memorandums, and states no exception for the
    // first page. Set false for the common office practice of numbering
    // continuation pages only.
    numberFirstPage: true,
};

function resolveOptions(options = {}, {hasLetterhead = true} = {}) {
    const opts = {...DEFAULT_OPTIONS, ...options};
    const lineHeightIn = opts.lineHeightPt / 72;
    const bodyHeightIn = LAYOUT.pageHeightIn - LAYOUT.marginBottomIn;

    // Plain-paper memorandums (the MFR of fig 2-17) start at the 1-inch top
    // margin instead of below a letterhead, so page 1 holds more lines.
    opts.topOffsetIn = hasLetterhead ? opts.letterheadHeightIn : 1.0;

    if (opts.firstPageLines == null) {
        opts.firstPageLines = Math.floor(
            (bodyHeightIn - opts.topOffsetIn) / lineHeightIn
        );
    }
    if (opts.continuationPageLines == null) {
        // Continuation pages start with the office symbol 1 inch from the top
        // (para 2-5a) and reserve the bottom line for the page number (2-5d).
        opts.continuationPageLines = Math.floor(
            (bodyHeightIn - 1.0) / lineHeightIn
        ) - 1;
    }
    opts.columns = inchesToChars(TEXT_WIDTH_IN, opts.charsPerInch);
    return opts;
}

// ---------------------------------------------------------------------------
// Line model
// ---------------------------------------------------------------------------

/**
 * A physical line. `indentIn` applies to this line only; wrapped continuation
 * lines are emitted separately with their own indent, because AR 25-50 returns
 * wraps to the left margin rather than hanging them under the label.
 */
function line(text, {indentIn = 0, align = "left", right = null, bold = false, role = "body",
                     prefix = null, prefixWidthIn = 0} = {}) {
    return {kind: "text", text, indentIn, align, right, bold, role, prefix, prefixWidthIn};
}

function blank(count = 1) {
    return Array.from({length: count}, () => ({kind: "blank"}));
}

/**
 * "Second line below X" means one blank line between them. The regulation
 * counts the target line itself, so N lines below emits N-1 blanks.
 */
function gap(spacing) {
    return blank(Math.max(0, spacing.linesBelow - 1));
}

/** Next quarter-inch tab stop strictly past `positionIn`. - para 1-39b(10) */
function tabStopAfter(positionIn) {
    const stop = LAYOUT.labelGapIn;
    const epsilon = 1e-9;
    return (Math.floor((positionIn + epsilon) / stop) + 1) * stop;
}

/**
 * Wrap `text`, indenting the first line by `firstIndentIn` and every
 * continuation line by `wrapIndentIn`.
 *
 * Lines are broken in inches against real Arial advance widths, not in
 * characters - the regulation's measurements are inches and para 1-19
 * recommends a 12-point proportional face. Whitespace inside the text survives
 * the break, which is what preserves the two spaces after ending punctuation
 * required by para 1-39b(9).
 *
 * AR 25-50 wraps to the left margin (LAYOUT.wrapToLeftMargin); multiple-address
 * blocks are the documented exception at 1/4 inch (para 2-4a(5)(b)).
 */
function wrap(text, {firstIndentIn = 0, wrapIndentIn = 0, opts, role = "body", bold = false,
                     prefix = null}) {
    // "Space 1/4 inch to the right of the parenthesis when numbering
    //  subparagraphs" (para 1-39b(10)) describes a quarter-inch tab grid: the
    //  text advances to the next quarter-inch stop past the label, which is
    //  what puts "1." and "a." and "(1)" on the same rhythm in figure 2-1.
    //  Adding a flat quarter inch to the label width instead would open a
    //  visibly wider gap than the figures show.
    const prefixWidthIn = prefix
        ? tabStopAfter(firstIndentIn + measureTextIn(prefix, opts.fontSizePt)) - firstIndentIn
        : 0;

    const indentForLine = (i) => (i === 0 ? firstIndentIn : wrapIndentIn);
    const broken = breakLines(text, {
        sizePt: opts.fontSizePt,
        bold,
        indentForLine,
        widthForLine: (i) => TEXT_WIDTH_IN - indentForLine(i) - (i === 0 ? prefixWidthIn : 0),
    });

    return broken.map((b, i) => line(b.text, {
        indentIn: b.indentIn,
        role,
        bold,
        prefix: i === 0 ? prefix : null,
        prefixWidthIn: i === 0 ? prefixWidthIn : 0,
    }));
}

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

/**
 * Whether page 1 carries computer-generated letterhead.
 *
 * "Use computer-generated letterhead for the first page of all memorandums" -
 * para 2-3a(1) - with one stated exception: "Type the MFR on plain white
 * paper" (fig 2-17). An MOU/MOA is prepared on plain white paper too, though
 * "if an MOU/MOA is between two Army activities, DA letterhead is
 * appropriate" (para 2-6c(1)), so it follows whether letterhead was supplied.
 */
export function usesLetterhead(memo) {
    if (memo.type === "record") return false;
    if (memo.letterhead === null || memo.letterhead === undefined) return false;
    return true;
}

/**
 * The department seal that ships with the example. Callers may override it
 * per memorandum, but they never have to: it is the same seal on every piece
 * of official letterhead. - para 1-16b(1)
 */
export const DEFAULT_SEAL_PATH = new URL(`./assets/${LETTERHEAD.sealFile}`, import.meta.url).pathname;

function buildLetterhead(memo, opts) {
    const lh = memo.letterhead ?? {};
    const lines = [
        LETTERHEAD.lines[0],
        (lh.organization ?? LETTERHEAD.lines[1]).toUpperCase(),
        (lh.streetAddress ?? LETTERHEAD.lines[2]).toUpperCase(),
        (lh.cityStateZip ?? LETTERHEAD.lines[3]).toUpperCase(),
    ];
    return {
        kind: "letterhead",
        seal: lh.seal ?? DEFAULT_SEAL_PATH,
        lines: lines.map((t, i) =>
            line(t, {align: "center", bold: true, role: i === 0 ? "letterhead-title" : "letterhead"})
        ),
    };
}

/** "OFFICE SYMBOL (25-50a)" with the date flush right on the same line. */
function officeSymbolLine(memo) {
    const symbol = memo.officeSymbol ?? "OFFICE SYMBOL";
    // "Place the record number one space after the office symbol in
    //  parentheses." - para 2-4a(2)(b)
    const withRecord = memo.arimsRecordNumber
        ? `${symbol} (${memo.arimsRecordNumber})`
        : symbol;
    const date = memo.date ?? formatMemoDate();
    return line(withRecord, {right: date, role: "office-symbol"});
}

function buildHeading(memo, opts) {
    const out = [];

    // Suspense date: flush right, bold, two lines above the date line. - 2-4a(4)
    if (memo.suspenseDate) {
        out.push(line("", {right: `S: ${memo.suspenseDate}`, bold: true, role: "suspense"}));
        out.push(...blank(SPACING.suspenseAboveDate.linesAbove - 1));
    }

    out.push(officeSymbolLine(memo));
    out.push(...gap(SPACING.officeSymbolToMemorandumFor));
    out.push(...buildAddressBlock(memo, opts));
    out.push(...gap(SPACING.addressToSubject));
    out.push(...wrap(`SUBJECT: ${memo.subject ?? ""}`, {
        firstIndentIn: 0,
        wrapIndentIn: 0, // "begin the second line flush with the left margin" - 2-4a(6)
        opts,
        role: "subject",
    }));
    return out;
}

/**
 * MEMORANDUM FOR / MEMORANDUM THRU, in the four forms AR 25-50 defines:
 *   single address           - on the same line as MEMORANDUM FOR (2-4a(5)(a))
 *   two to five addresses    - stacked below a bare MEMORANDUM FOR (fig 2-5)
 *   more than five           - SEE DISTRIBUTION (2-4a(5)(c))
 *   THRU chain               - MEMORANDUM THRU ... FOR ... (2-4a(5)(d))
 */
function buildAddressBlock(memo, opts) {
    const out = [];
    const addressees = memo.addressees ?? [];
    const thru = memo.thru ?? [];

    const styleAddress = (a) =>
        memo.addressStyle === "uppercase" ? String(a).toUpperCase() : String(a);

    // A memorandum for record replaces the whole address block. - fig 2-17
    if (memo.type === "record") {
        out.push(line("MEMORANDUM FOR RECORD", {role: "memorandum-for"}));
        return out;
    }

    // Once a THRU chain is present the addressee line reads "FOR", not
    // "MEMORANDUM FOR" - figures 2-11 and 2-12 both show it that way.
    const keyword = thru.length ? "FOR" : "MEMORANDUM FOR";

    if (thru.length === 1) {
        // Single-address THRU: on the same line as the keyword, wrapping flush
        // with the left margin. - fig 2-11
        out.push(...wrap(`MEMORANDUM THRU ${styleAddress(thru[0])}`, {
            firstIndentIn: 0,
            wrapIndentIn: 0,
            opts,
            role: "thru",
        }));
        out.push(...gap(SPACING.betweenParagraphs));
    } else if (thru.length > 1) {
        // "Do not address memorandums to more than two THRU addressees unless
        //  it is absolutely necessary." - fig 2-12
        out.push(line("MEMORANDUM THRU", {role: "thru"}));
        out.push(...gap(SPACING.memorandumForToFirstAddress));
        thru.forEach((stop, i) => {
            out.push(...wrap(styleAddress(stop), {
                firstIndentIn: 0,
                wrapIndentIn: LAYOUT.multiAddressWrapIndentIn,
                opts,
                role: "thru",
            }));
            if (i < thru.length - 1) out.push(...gap(SPACING.betweenParagraphs));
        });
        out.push(...gap(SPACING.betweenParagraphs));
    }

    if (memo.seeDistribution || addressees.length > ADDRESS_LIMITS.seeDistributionAbove) {
        out.push(line(`${keyword} SEE DISTRIBUTION`, {role: "memorandum-for"}));
        return out;
    }

    if (addressees.length <= 1) {
        const target = styleAddress(addressees[0] ?? "");
        out.push(...wrap(`${keyword} ${target}`.trim(), {
            firstIndentIn: 0,
            wrapIndentIn: 0, // "begin the second line flush with the left margin" - 2-4a(5)
            opts,
            role: "memorandum-for",
        }));
        return out;
    }

    out.push(line(keyword, {role: "memorandum-for"}));
    out.push(...gap(SPACING.memorandumForToFirstAddress));
    for (const a of addressees) {
        out.push(...wrap(styleAddress(a), {
            firstIndentIn: 0,
            wrapIndentIn: LAYOUT.multiAddressWrapIndentIn, // - 2-4a(5)(b)
            opts,
            role: "address",
        }));
    }
    return out;
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

/**
 * Render the paragraph tree.
 *
 * "Do not number a one-paragraph memorandum." - 2-4b(4)(a)
 * Labels and indents come from figure 2-1; the gap between a label and its
 * text is 1/4 inch per para 1-39b(10).
 */
function buildBody(memo, opts) {
    const paragraphs = memo.paragraphs ?? [];
    const numbered = paragraphs.length > 1;
    const blocks = [];

    const walk = (nodes, depth) => {
        let ordinal = 0;   // literal rows are unlabelled and do not take a letter
        nodes.forEach((node) => {
            const indentIn = LAYOUT.indentByLevelIn[Math.min(depth, LAYOUT.indentByLevelIn.length - 1)];
            const index = node.literal ? ordinal : ordinal++;
            const label = (depth === 0 && !numbered)
                ? ""
                : PARAGRAPH_LABELS[Math.min(depth, MAX_SUBDIVISION_DEPTH)].format(index);

            // A literal row is a tabular line such as the approval line or a
            // coordination row of a decision memorandum (fig 2-18). It takes no
            // label and its spacing is preserved as written, because the
            // columns are the content.
            // The approval line of a decision memorandum. The preview always
            // shows the "X" form; the Word renderer substitutes real
            // checkboxes when the memorandum is digitally signed (fig 2-19).
            const source = node.approvalLine
                ? approvalLineText(memo)
                : (node.text ?? "");

            const text = node.literal
                ? stripEmphasis(source)
                : stripEmphasis(normalizePunctuationSpacing(source));

            blocks.push({
                kind: "paragraph",
                depth,
                label: node.literal ? "" : label,
                text,
                literal: !!node.literal,
                lines: node.literal
                    ? [line(text, {indentIn, role: "paragraph"})]
                    : wrap(text, {
                        firstIndentIn: indentIn,
                        // Continuation lines return to the left margin, not
                        // under the label - visible throughout figs 2-1 to 2-5.
                        wrapIndentIn: LAYOUT.wrapToLeftMargin ? 0 : indentIn,
                        opts,
                        role: "paragraph",
                        prefix: label || null,
                    }),
            });

            if (node.children?.length) walk(node.children, depth + 1);
        });
    };

    walk(paragraphs, 0);
    return blocks;
}

// ---------------------------------------------------------------------------
// Closing
// ---------------------------------------------------------------------------

/**
 * Authority line, signature block, and enclosure listing.
 *
 * The signature block begins in the center of the page on the fifth line below
 * the authority line, or below the last line of text when no authority line is
 * used (2-4c(2)(a)). The enclosure listing sits at the left margin on the same
 * line as the signature block (2-4c(3)).
 */
function buildClosing(memo, opts) {
    const out = [];
    const sigIndent = LAYOUT.signatureBlockIndentIn;

    // The closing carries its own leading gap so the two cases in para
    // 2-4c(2)(a) both come out right: with an authority line the five lines are
    // counted from it, without one they are counted from the last line of text.
    // Adding a fixed gap outside this function pushes the no-authority-line
    // case to the sixth line.
    if (memo.authorityLine) {
        out.push(...gap(SPACING.textToAuthorityLine));
        out.push(line(String(memo.authorityLine).toUpperCase(), {role: "authority-line"}));
    }

    const spacing = memo.authorityLine
        ? SPACING.authorityLineToSignature
        : SPACING.textToSignature;

    if (memo.digitalSignature !== false) {
        // The digital signature block occupies the third of the five lines.
        const before = SPACING.authorityLineToDigitalSignature.linesBelow - 1;
        out.push(...blank(before));
        out.push(line(opts.digitalSignaturePlaceholder, {
            indentIn: sigIndent,
            role: "digital-signature",
        }));
        out.push(...blank(spacing.linesBelow - SPACING.authorityLineToDigitalSignature.linesBelow - 1));
    } else {
        out.push(...blank(spacing.linesBelow - 1));
    }

    // The closing runs as two columns on the same lines: the enclosure listing
    // at the left margin, the signature block beginning at the centre of the
    // page, both starting on the same line.
    //   "Begin the enclosure listing at the left margin on the same line as the
    //    signature block." - 2-4c(3)
    // "Type the signature block of military officials on three lines [...] If
    //  the title requires more than one line, continue it on the fourth line,
    //  indenting 1/4 inch." - para 6-4c
    const sig = memo.signature ?? {};
    const columnIn = TEXT_WIDTH_IN - sigIndent;
    const rightColumn = [
        {text: String(sig.name ?? "NAME").toUpperCase(), indentIn: 0},
        ...(sig.gradeAndBranch ? [{text: sig.gradeAndBranch, indentIn: 0}] : []),
        ...(sig.title ? wrapToColumn(sig.title, columnIn, opts) : []),
    ].map((r) => line(r.text, {indentIn: sigIndent + r.indentIn, role: "signature"}));

    const encls = memo.enclosures ?? [];
    const leftColumn = [];
    if (encls.length) {
        leftColumn.push(line(enclosureLabel(encls.length), {role: "enclosure-label"}));
        // A single enclosure is not itemized - the label is the whole listing.
        // "For only one enclosure (Encl), do not precede 'Encl' with the number
        //  1; use only 'Encl.'" - 2-4c(3)
        if (encls.length > 1) {
            encls.forEach((e, i) => {
                leftColumn.push(...wrap(`${i + 1}. ${e}`, {
                    firstIndentIn: 0,
                    wrapIndentIn: LAYOUT.multiAddressWrapIndentIn,
                    opts,
                    role: "enclosure",
                }));
            });
        }
    }

    for (let i = 0; i < Math.max(leftColumn.length, rightColumn.length); i++) {
        const left = leftColumn[i];
        const right = rightColumn[i];
        if (left && right) left.sameLine = right;
        out.push(left ?? right);
    }

    if (memo.distribution?.length) {
        out.push(...gap(SPACING.lastBlockToDistribution));
        out.push(line("DISTRIBUTION:", {role: "distribution"}));

        // "(see next page)" goes directly under DISTRIBUTION: when the listing
        // is prepared on a page of its own. - fig 2-9
        if (memo.distributionOnSeparatePage) {
            out.push(line(LISTING.separatePageMarker, {role: "distribution"}));
            return finishClosing(out, memo, opts);
        }

        for (const entry of memo.distribution) {
            const {text, indentIn} = listingEntry(entry);
            out.push(...wrap(text, {
                firstIndentIn: indentIn,
                wrapIndentIn: indentIn,   // blocked flush, not hung - 2-4a(5)(c)
                opts,
                role: "distribution",
            }));
        }
    }

    return finishClosing(out, memo, opts);
}

/** The copy-furnished block, which follows whichever listing came last. */
function finishClosing(out, memo, opts) {
    if (memo.copiesFurnished?.length) {
        out.push(...gap(SPACING.lastBlockToCopiesFurnished));
        const marker = memo.copiesWithoutEnclosures
            ? `${COPY_MARKERS.memorandum} (w/o encls)`
            : COPY_MARKERS.memorandum;
        out.push(line(marker, {role: "copies-furnished"}));
        for (const entry of memo.copiesFurnished) {
            const {text, indentIn} = listingEntry(entry);
            out.push(...wrap(text, {
                firstIndentIn: indentIn,
                wrapIndentIn: indentIn,   // flush with the left margin - fig 2-14
                opts,
                role: "copies-furnished",
            }));
        }
    }
    return out;
}

/**
 * "APPROVED  X    DISAPPROVED  X    SEE ME  X" - fig 2-18. Columns are
 * tab-separated; the caller supplies the stops.
 */
function approvalLineText(memo) {
    return DECISION_APPROVAL.options
        .map((o) => `${o}  ${DECISION_APPROVAL.wetMark}`)
        .join("\t");
}

/**
 * Wrap a signature-block line inside its column. A title that needs a second
 * line continues indented 1/4 inch. - para 6-4c
 * Returns [{text, indentIn}] relative to the column's own left edge.
 */
function wrapToColumn(text, columnIn, opts) {
    const indentForLine = (i) => (i === 0 ? 0 : LAYOUT.multiAddressWrapIndentIn);
    return breakLines(text, {
        sizePt: opts.fontSizePt,
        indentForLine,
        widthForLine: (i) => columnIn - indentForLine(i),
    }).map((b) => ({text: b.text, indentIn: b.indentIn}));
}

/**
 * A distribution or copy-furnished entry. A plain string sits at the left
 * margin; `{text, indent: 1}` is a subordinate entry under the one above it,
 * as figure 2-8 lists the Army commands under "Commander".
 */
function listingEntry(entry) {
    if (typeof entry === "string") return {text: entry, indentIn: 0};
    const level = Number.isFinite(entry.indent) ? entry.indent : 0;
    return {text: entry.text ?? "", indentIn: level * LISTING.subEntryIndentIn};
}

// ---------------------------------------------------------------------------
// MOU / MOA heading (para 2-6c)
// ---------------------------------------------------------------------------

function buildAgreementHeading(memo, opts) {
    const out = [];
    const title = memo.type === "moa"
        ? "MEMORANDUM OF AGREEMENT"
        : "MEMORANDUM OF UNDERSTANDING";

    out.push(line(title, {align: "center", role: "agreement-title"}));
    out.push(line(AGREEMENT_FORMAT.betweenKeyword, {align: "center", role: "agreement-title"}));

    for (const partyLine of agreementParties(memo.parties ?? [])) {
        const isKeyword = partyLine === AGREEMENT_FORMAT.joinKeyword;
        out.push(line(partyLine, {
            align: "center",
            role: isKeyword ? "agreement-title" : "agreement-party",
        }));
    }

    out.push(...blank(AGREEMENT_FORMAT.subjectLinesBelowAgencies - 1));
    out.push(...wrap(`SUBJECT: ${memo.subject ?? ""}`, {
        firstIndentIn: 0, wrapIndentIn: 0, opts, role: "subject",
    }));
    return out;
}

/**
 * MOU/MOA signature blocks - para 2-6c(5) and figures 2-15 and 2-16.
 *
 * Each block is a rule, the name in capitals, the grade and title, then a
 * shorter rule with "(Date)" centred beneath it. Two agencies sit side by
 * side with the senior official on the right (para 2-6c(5)(d)); a third is
 * centred five lines below, the highest ranking of the three.
 */
function buildAgreementClosing(memo, opts) {
    const out = [];
    out.push(...blank(AGREEMENT_FORMAT.signatureLinesBelowText - 1));

    const signers = memo.signers ?? [];
    const colIn = AGREEMENT_FORMAT.signatureColumnIn;

    const rule = (widthIn) => {
        const one = measureTextIn("_", opts.fontSizePt);
        return "_".repeat(Math.max(1, Math.round(widthIn / one)));
    };
    const nameRule = rule(AGREEMENT_FORMAT.signatureRuleIn);
    const dateRule = rule(AGREEMENT_FORMAT.dateRuleIn);

    // The date caption is centred under its own rule.
    const captionIndent = (base) => {
        const w = measureTextIn(AGREEMENT_FORMAT.dateCaption, opts.fontSizePt);
        return base + (AGREEMENT_FORMAT.dateRuleIn - w) / 2;
    };

    // "If the title requires more than one line, continue it on the fourth
    //  line, indenting 1/4 inch." - para 6-4c
    const blockLines = (signer) => {
        const head = [
            signer.name ? String(signer.name).toUpperCase() : "",
            signer.gradeAndBranch ?? signer.grade ?? "",
        ].filter((t) => t !== "");
        const title = signer.titleAndAgency ?? signer.title ?? "";
        if (!title) return head;
        return [...head, ...wrapToColumn(title, AGREEMENT_FORMAT.signatureRuleIn, opts)];
    };

    /** One column of a signature row: rule, block, date rule, caption. */
    const column = (signer, baseIn) => [
        {text: nameRule, indentIn: baseIn},
        ...blockLines(signer).map((t) => ({
            text: t.text ?? t,
            indentIn: baseIn + (t.indentIn ?? 0),
        })),
        {text: dateRule, indentIn: baseIn},
        {text: AGREEMENT_FORMAT.dateCaption, indentIn: captionIndent(baseIn)},
    ];

    const left = signers[0] ? column(signers[0], 0) : [];
    const right = signers[1] ? column(signers[1], colIn) : [];

    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const l = left[i];
        const r = right[i];
        const primary = l
            ? line(l.text, {indentIn: l.indentIn, role: i === 0 ? "overscore" : "signature"})
            : line("", {role: "signature"});
        if (r) {
            primary.sameLine = line(r.text, {
                indentIn: r.indentIn,
                role: i === 0 ? "overscore" : "signature",
            });
        }
        out.push(primary);
    }

    // "If an MOU or MOA has three agreeing agencies, center the signature
    //  block of the highest ranking official at the bottom." - 2-6c(5)(d)
    if (signers[2]) {
        out.push(...blank(AGREEMENT_FORMAT.signatureLinesBelowText - 1));
        const centreIn = (TEXT_WIDTH_IN - AGREEMENT_FORMAT.signatureRuleIn) / 2;
        for (const [i, row] of column(signers[2], centreIn).entries()) {
            out.push(line(row.text, {
                indentIn: row.indentIn,
                role: i === 0 ? "overscore" : "signature",
            }));
        }
    }

    // The enclosure listing sits at the left margin below the blocks
    // (fig 2-15), labelled by the general rule in para 2-4c(3).
    if (memo.enclosures?.length) {
        out.push(...blank(1));
        out.push(line(enclosureLabel(memo.enclosures.length), {role: "enclosure-label"}));
    }

    return out;
}

function pair(leftLine, rightLine) {
    leftLine.sameLine = rightLine;
    return leftLine;
}

// ---------------------------------------------------------------------------
// Pagination (para 2-5)
// ---------------------------------------------------------------------------

/**
 * Split the line stream into pages, honouring the continuation rules in
 * para 2-5c:
 *   - do not divide a paragraph of three lines or fewer
 *   - at least two lines of a divided paragraph on each page
 *   - do not strand the authority line and signature block on a continuation
 *     page without at least two lines of the last paragraph
 */
function paginate(headingLines, bodyBlocks, closingLines, memo, opts) {
    const pages = [];
    let current = [];
    let capacity = opts.firstPageLines;

    const flush = () => {
        pages.push(current);
        current = [];
        capacity = opts.continuationPageLines;
    };

    const push = (lines) => {
        for (const l of lines) {
            if (current.length >= capacity) flush();
            current.push(l);
        }
    };

    push(headingLines);
    push(blank(SPACING.subjectToBody.linesBelow - 1));

    bodyBlocks.forEach((block, i) => {
        const remaining = capacity - current.length;
        const len = block.lines.length;

        // A paragraph of three lines or fewer is never divided; a longer one
        // needs at least two lines on each side of the break.
        const indivisible = len <= 3;
        const needsWholeBlock = indivisible || remaining < 2 || len - remaining < 2;

        if (len > remaining && needsWholeBlock) flush();
        push(block.lines);

        if (i < bodyBlocks.length - 1) {
            push(blank(SPACING.betweenParagraphs.linesBelow - 1));
        }
    });

    // The closing may not start a page unless at least two lines of the last
    // paragraph precede it, unless that paragraph is a single line. - 2-5c(4)
    const lastBlock = bodyBlocks[bodyBlocks.length - 1];
    const lastBlockLines = lastBlock?.lines.length ?? 0;
    const linesOfLastParagraphOnThisPage = countTrailing(current, lastBlock);

    // The closing already carries its own leading gap (see buildClosing).
    const closingWithGap = closingLines;

    const fits = current.length + closingWithGap.length <= capacity;
    const stranded = !fits && lastBlockLines > 1 && linesOfLastParagraphOnThisPage < 2;

    if (!fits) {
        if (stranded || lastBlockLines === 1) {
            // Move the whole last paragraph forward with the closing.
            const moved = current.splice(current.length - linesOfLastParagraphOnThisPage);
            flush();
            push(moved);
        } else {
            flush();
        }
    }
    push(closingWithGap);
    flush();

    return pages.filter((p) => p.length > 0);
}

function countTrailing(lines, block) {
    if (!block) return 0;
    let n = 0;
    for (let i = lines.length - 1; i >= 0 && n < block.lines.length; i--) {
        if (block.lines.includes(lines[i])) n++;
        else break;
    }
    return n;
}

/** Continuation-page heading: office symbol, subject, then text. - paras 2-5a to 2-5c */
function continuationHeading(memo, opts) {
    // An MOU or MOA has no office symbol, so its continuation pages repeat the
    // subject alone. - figs 2-15 and 2-16
    if (memo.type === "mou" || memo.type === "moa") {
        return [
            ...wrap(`SUBJECT: ${memo.subject ?? ""}`, {firstIndentIn: 0, wrapIndentIn: 0, opts, role: "subject"}),
            ...blank(SPACING.continuationSubjectToText.linesBelow - 1),
        ];
    }
    const symbol = memo.arimsRecordNumber
        ? `${memo.officeSymbol} (${memo.arimsRecordNumber})`
        : memo.officeSymbol;
    return [
        line(symbol, {role: "office-symbol"}),
        ...wrap(`SUBJECT: ${memo.subject ?? ""}`, {firstIndentIn: 0, wrapIndentIn: 0, opts, role: "subject"}),
        ...blank(SPACING.continuationSubjectToText.linesBelow - 1),
    ];
}

// ---------------------------------------------------------------------------
// Public layout entry point
// ---------------------------------------------------------------------------

/**
 * Turn a memo spec into pages of positioned lines. Both renderers and the
 * validator consume this, so they can never disagree about the layout.
 */
export function layoutMemo(memo, options = {}) {
    const hasLetterhead = usesLetterhead(memo);
    const opts = resolveOptions(options, {hasLetterhead});
    const isAgreement = memo.type === "mou" || memo.type === "moa";

    const letterhead = hasLetterhead ? buildLetterhead(memo, opts) : null;
    const heading = isAgreement
        ? buildAgreementHeading(memo, opts)
        : buildHeading(memo, opts);
    const bodyBlocks = buildBody(memo, opts);
    const closing = isAgreement
        ? buildAgreementClosing(memo, opts)
        : buildClosing(memo, opts);

    const pages = paginate(heading, bodyBlocks, closing, memo, opts);

    // The regulation's "Nth line below" counts describe the document's flow,
    // not a particular page, so they are asserted against this array rather
    // than against pages - a page break must not be able to invalidate them.
    const flow = [
        ...heading,
        ...blank(SPACING.subjectToBody.linesBelow - 1),
        ...bodyBlocks.flatMap((b, i) =>
            i < bodyBlocks.length - 1
                ? [...b.lines, ...blank(SPACING.betweenParagraphs.linesBelow - 1)]
                : b.lines),
        ...closing,
    ];

    // "a complete distribution listing can be prepared on a separate page" -
    // fig 2-9. It carries the continuation heading, then DISTRIBUTION: on the
    // third line below the subject, then the listing.
    if (memo.distributionOnSeparatePage && memo.distribution?.length) {
        const listing = [line("DISTRIBUTION:", {role: "distribution"})];
        for (const entry of memo.distribution) {
            const {text, indentIn} = listingEntry(entry);
            listing.push(...wrap(text, {
                firstIndentIn: indentIn, wrapIndentIn: indentIn, opts, role: "distribution",
            }));
        }
        pages.push(listing);
    }

    return {
        opts,
        hasLetterhead,
        letterhead,
        bodyBlocks,
        flow,
        pages: pages.map((lines, i) => ({
            number: i + 1,
            isFirst: i === 0,
            heading: i === 0 ? null : continuationHeading(memo, opts),
            lines,
        })),
    };
}

/** Page numbers appear only on multiple-page memorandums. - para 2-5d */
function showPageNumber(doc, page, opts) {
    if (doc.pages.length <= 1) return false;
    return page.isFirst ? opts.numberFirstPage : true;
}

// ---------------------------------------------------------------------------
// Plain-text backend
// ---------------------------------------------------------------------------

function renderLineToText(l, opts) {
    if (l.kind === "blank") return "";

    const pad = (n) => " ".repeat(Math.max(0, n));
    const indent = inchesToChars(l.indentIn ?? 0, opts.charsPerInch);

    // Horizontal positions are computed from real type widths and then scaled
    // onto the character grid, so the preview shows where things land on the
    // printed page. A proportional face fits more lowercase than uppercase in
    // 6.5 inches, so preview lines vary in character count - that is the type,
    // not a ragged margin.
    const colAt = (inches) => Math.round(inches * opts.charsPerInch);
    const widthOf = (s, bold) => measureTextIn(s ?? "", opts.fontSizePt, {bold});

    let left;
    if (l.align === "center") {
        const text = l.text ?? "";
        const startIn = (TEXT_WIDTH_IN - widthOf(text, l.bold)) / 2;
        left = pad(Math.max(0, colAt(startIn))) + text;
    } else if (l.prefix) {
        // The label sits at the indent; the text starts prefixWidthIn further
        // right, which is 1/4 inch past the label (para 1-39b(10)).
        const textCol = indent + inchesToChars(l.prefixWidthIn, opts.charsPerInch);
        const head = pad(indent) + l.prefix;
        left = head + pad(Math.max(1, textCol - head.length)) + (l.text ?? "");
    } else {
        left = pad(indent) + (l.text ?? "");
    }

    // A second line object sharing this physical line (signature block beside
    // the enclosure listing, MOU signature blocks side by side).
    if (l.sameLine) {
        const rightIndent = inchesToChars(l.sameLine.indentIn ?? 0, opts.charsPerInch);
        const filler = Math.max(1, rightIndent - left.length);
        left = left + pad(filler) + (l.sameLine.text ?? "");
    }

    // Flush right: the date beside the office symbol, the suspense date above
    // it. Placed at the right margin by width, not by character count.
    if (l.right) {
        const startCol = colAt(TEXT_WIDTH_IN - widthOf(l.right, l.bold));
        left = left + pad(Math.max(1, startCol - left.length)) + l.right;
    }

    return left.replace(/\s+$/, "");
}

/** Render the memo as plain text. Line placement is exact; widths approximate. */
export function renderText(memo, options = {}) {
    const doc = layoutMemo(memo, options);
    const opts = doc.opts;
    const out = [];

    doc.pages.forEach((page, i) => {
        if (i > 0) out.push("\f");

        if (page.isFirst && doc.hasLetterhead) {
            out.push(`${opts.sealPlaceholder}`);
            for (const l of doc.letterhead.lines) out.push(renderLineToText(l, opts));
            out.push(...Array(SPACING.letterheadToOfficeSymbol.linesBelow - 1).fill(""));
        } else if (!page.isFirst) {
            for (const l of page.heading) out.push(renderLineToText(l, opts));
        }

        for (const l of page.lines) out.push(renderLineToText(l, opts));

        // "Center the page number approximately 1-inch from the bottom of the
        //  page." - 2-5d. Only multiple-page memorandums are numbered.
        if (showPageNumber(doc, page, opts)) {
            out.push("");
            out.push(renderLineToText(line(String(page.number), {align: "center"}), opts));
        }
    });

    return out.join("\n");
}

// ---------------------------------------------------------------------------
// HTML / print backend
// ---------------------------------------------------------------------------

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderLineToHtml(l, opts) {
    if (l.kind === "blank") return `<div class="ln">&nbsp;</div>`;

    const cls = ["ln", `r-${l.role ?? "body"}`];
    if (l.bold) cls.push("b");
    if (l.align === "center") cls.push("center");

    const style = l.indentIn ? ` style="padding-left:${l.indentIn}in"` : "";
    const text = escapeHtml(l.text ?? "") || "&nbsp;";

    let inner = l.prefix
        ? `<span class="lbl" style="width:${l.prefixWidthIn.toFixed(4)}in">${escapeHtml(l.prefix)}</span><span class="t">${text}</span>`
        : `<span class="t">${text}</span>`;
    if (l.sameLine) {
        const s = l.sameLine;
        inner += `<span class="col2" style="left:${s.indentIn ?? 0}in">${escapeHtml(s.text ?? "")}</span>`;
    }
    if (l.right) {
        inner += `<span class="right">${escapeHtml(l.right)}</span>`;
    }
    return `<div class="${cls.join(" ")}"${style}>${inner}</div>`;
}

/**
 * Print-accurate HTML. Real inches, real 8.5x11 pages, 1-inch margins, one
 * <div class="ln"> per regulation line so the "Nth line below" counts survive
 * into print.
 *
 * The DoD seal is a slot, not an asset. AR 25-50 para 1-16b requires the
 * official APD letterhead template and para 1-16b(2) forbids substituting any
 * other device, so pass `letterhead.seal` as a path or data URI to the seal
 * from that template. Without it the page renders a labelled placeholder and
 * the validator raises a finding.
 */
export function renderHtml(memo, options = {}) {
    const doc = layoutMemo(memo, options);
    const opts = doc.opts;
    const seal = doc.letterhead?.seal ?? null;

    const sealHtml = seal
        ? `<img class="seal" src="${escapeHtml(seal)}" alt="Department of Defense seal">`
        : `<div class="seal placeholder" role="img" aria-label="Department of Defense seal placeholder">DoD<br>SEAL</div>`;

    const pagesHtml = doc.pages.map((page) => {
        const head = !page.isFirst
            ? page.heading.map((l) => renderLineToHtml(l, opts)).join("\n    ")
            : !doc.hasLetterhead
            ? ""
            : `<header class="letterhead">
      ${sealHtml}
      <div class="lh-text">
        ${doc.letterhead.lines.map((l, i) =>
            `<div class="lh-line ${i === 0 ? "lh-title" : ""}">${escapeHtml(l.text)}</div>`
        ).join("\n        ")}
      </div>
    </header>
    ${Array(SPACING.letterheadToOfficeSymbol.linesBelow - 1).fill(`<div class="ln">&nbsp;</div>`).join("")}`;

        const body = page.lines.map((l) => renderLineToHtml(l, opts)).join("\n    ");
        const number = showPageNumber(doc, page, opts)
            ? `<div class="page-number">${page.number}</div>`
            : "";

        return `  <section class="page">
    ${head}
    ${body}
${number}
  </section>`;
    }).join("\n");

    return `<article class="ar25-50-memo">
<style>
  .ar25-50-memo { --font: ${TYPE.fontFamily}, Helvetica, sans-serif; --size: ${TYPE.fontSizePt}pt; --line: ${opts.lineHeightPt}pt; }
  .ar25-50-memo .page {
    box-sizing: border-box;
    width: ${LAYOUT.pageWidthIn}in;
    min-height: ${LAYOUT.pageHeightIn}in;
    /* 1-inch left, right, and bottom margins - AR 25-50, para 2-3c */
    padding: ${LETTERHEAD.sealTopIn}in ${LAYOUT.marginRightIn}in ${LAYOUT.marginBottomIn}in ${LAYOUT.marginLeftIn}in;
    margin: 0 auto 0.5in;
    background: #fff;
    color: #000;                       /* black ink - para 1-20 */
    font-family: var(--font);
    font-size: var(--size);
    line-height: var(--line);
    position: relative;
    box-shadow: 0 1px 6px rgba(0,0,0,.25);
  }
  .ar25-50-memo .ln { position: relative; min-height: var(--line); white-space: pre-wrap; }
  .ar25-50-memo .lbl { display: inline-block; }
  .ar25-50-memo .ln.b { font-weight: 700; }
  .ar25-50-memo .ln.center { text-align: center; }
  .ar25-50-memo .right { position: absolute; right: 0; top: 0; }
  .ar25-50-memo .col2 { position: absolute; top: 0; }
  /* The seal sits at the left; the header text centres on the page, not on
     the space beside the seal. - AR 25-50, figs 2-1 through 2-5 */
  .ar25-50-memo .letterhead { position: relative; min-height: ${LETTERHEAD.sealDiameterIn}in; }
  .ar25-50-memo .seal {
    position: absolute; left: 0; top: 0;
    width: ${LETTERHEAD.sealDiameterIn}in; height: ${LETTERHEAD.sealDiameterIn}in;
  }
  .ar25-50-memo .seal.placeholder {
    border: 1.5px dashed #666; border-radius: 50%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; font-size: 6pt; line-height: 1.1;
    text-align: center; color: #666; letter-spacing: .02em;
  }
  .ar25-50-memo .lh-text { text-align: center; padding-top: .08in; }
  .ar25-50-memo .lh-line { font-weight: 700; font-size: ${LETTERHEAD.addressSizePt}pt; line-height: 1.25; }
  .ar25-50-memo .lh-title { font-size: ${LETTERHEAD.titleSizePt}pt; }
  .ar25-50-memo .page-number {
    position: absolute; left: 0; right: 0; bottom: ${LAYOUT.marginBottomIn}in;
    text-align: center;                /* centered ~1 inch from the bottom - para 2-5d */
  }
  @media print {
    .ar25-50-memo .page { box-shadow: none; margin: 0; page-break-after: always; }
  }
</style>
${pagesHtml}
</article>`;
}

/** Standalone HTML document wrapper, for writing to a file. */
export function renderHtmlDocument(memo, options = {}) {
    const title = memo.subject ? `Memorandum - ${memo.subject}` : "Memorandum";
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: .5in 0; background: #6b6b6b; }
  @page { size: letter; margin: 0; }
  @media print { body { background: #fff; padding: 0; } }
</style>
</head>
<body>
${renderHtml(memo, options)}
</body>
</html>`;
}
