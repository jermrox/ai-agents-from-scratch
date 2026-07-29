/**
 * AR 25-50 (Preparing and Managing Correspondence) - codified layout rules.
 *
 * Every constant here carries the paragraph or figure it comes from. The
 * regulation expresses vertical placement as "the Nth line below X" and
 * horizontal placement in inches, so both units are kept verbatim and
 * converted at render time instead of being baked into magic numbers.
 *
 * Source: AR 25-50, 10 October 2020 (administrative revision 4 October 2024).
 */

/**
 * Vertical spacing, expressed the way the regulation expresses it.
 *
 * "Second line below X" means one blank line between X and the target, so the
 * renderer emits (linesBelow - 1) blank lines. Figures 2-1 through 2-5 print
 * these counts in their left margin, which is where they were read from.
 */
export const SPACING = {
    // "Type the office symbol on the second line below the seal." - 2-4a(1)
    letterheadToOfficeSymbol: {linesBelow: 2, cite: "AR 25-50, para 2-4a(1)"},

    // "Place the suspense date flush with the right margin two lines above the
    //  memorandum date, in bold." - 2-4a(4)
    suspenseAboveDate: {linesAbove: 2, cite: "AR 25-50, para 2-4a(4)"},

    // "Type 'MEMORANDUM FOR' on the third line below the office symbol." - 2-4a(5)
    officeSymbolToMemorandumFor: {linesBelow: 3, cite: "AR 25-50, para 2-4a(5)"},

    // Multiple-address memorandums stack the addresses under a bare
    // "MEMORANDUM FOR" line, beginning on the second line below it. - fig 2-5
    memorandumForToFirstAddress: {linesBelow: 2, cite: "AR 25-50, fig 2-5"},

    // "Type the subject line on the second line below the last line of the
    //  address." - 2-4a(6)
    addressToSubject: {linesBelow: 2, cite: "AR 25-50, para 2-4a(6)"},

    // "Begin the text on the third line below the last line of the subject." - 2-4b(1)
    subjectToBody: {linesBelow: 3, cite: "AR 25-50, para 2-4b(1)"},

    // "Single space the text with double spacing between paragraphs and
    //  subparagraphs." - 2-4b(2)
    betweenParagraphs: {linesBelow: 2, cite: "AR 25-50, para 2-4b(2)"},

    // "Type the authority line at the left margin in uppercase letters on the
    //  second line below the last line of the text." - 2-4c(1)
    textToAuthorityLine: {linesBelow: 2, cite: "AR 25-50, para 2-4c(1)"},

    // "Begin the signature block in the center of the page on the fifth line
    //  below the authority line. If you are not using an authority line, begin
    //  the signature block on the fifth line below the last line of text." - 2-4c(2)(a)
    authorityLineToSignature: {linesBelow: 5, cite: "AR 25-50, para 2-4c(2)(a)"},
    textToSignature: {linesBelow: 5, cite: "AR 25-50, para 2-4c(2)(a)"},

    // The digital signature block sits on the third of those five lines. - figs 2-1 to 2-5
    authorityLineToDigitalSignature: {linesBelow: 3, cite: "AR 25-50, figs 2-1 through 2-5"},

    // "Type 'CF:' on the second line below the last line of the signature
    //  block, enclosure listing, or distribution listing, whichever is
    //  lower." - 2-4c(5)
    lastBlockToCopiesFurnished: {linesBelow: 2, cite: "AR 25-50, para 2-4c(5)"},

    // "On the second line below the last line of the signature block or
    //  enclosure listing, whichever is lower, type 'DISTRIBUTION:'" - 2-4a(5)(c)
    lastBlockToDistribution: {linesBelow: 2, cite: "AR 25-50, para 2-4a(5)(c)"},

    // Continuation pages: office symbol 1 inch from the top, subject on the
    // line below it, text on the third line below the subject. - 2-5a, 2-5b, 2-5c
    continuationSubjectBelowOfficeSymbol: {linesBelow: 1, cite: "AR 25-50, para 2-5b"},
    continuationSubjectToText: {linesBelow: 3, cite: "AR 25-50, para 2-5c"},
};

/**
 * Horizontal geometry in inches. AR 25-50 states margins and indents in
 * inches, never in characters or tab counts.
 */
export const LAYOUT = {
    // "Use standard margins: 1-inch from the left, right, and bottom edges.
    //  Do not justify right margins." - 2-3c
    marginLeftIn: 1.0,
    marginRightIn: 1.0,
    marginBottomIn: 1.0,
    justifyRight: false,
    marginsCite: "AR 25-50, para 2-3c",

    // "Paper used for Army correspondence will be the standard size
    //  (8 1/2 by 11 inches)." - 1-18 / 2-3a
    pageWidthIn: 8.5,
    pageHeightIn: 11.0,
    paperCite: "AR 25-50, paras 1-18 and 2-3a",

    // Subparagraph indents, read from figure 2-1:
    //   "a." / "b."      -> indent 1/4 inch
    //   "(1)" / "(2)"    -> indent 1/2 inch
    //   "(a)" / "(b)"    -> "Do not indent any further than the second subdivision."
    indentByLevelIn: [0, 0.25, 0.5, 0.5],
    indentCite: "AR 25-50, fig 2-1",

    // "Space 1/4 inch to the right of the parenthesis when numbering
    //  subparagraphs." - 1-39b(10)
    labelGapIn: 0.25,
    labelGapCite: "AR 25-50, para 1-39b(10)",

    // Continuation lines of every paragraph return to the left margin - the
    // first line carries the indent, the wrap does not. Visible throughout
    // figures 2-1 through 2-5, and stated for the subject line in 2-4a(6)
    // ("begin the second line flush with the left margin").
    wrapToLeftMargin: true,
    wrapCite: "AR 25-50, para 2-4a(6) and figs 2-1 through 2-5",

    // Multiple-address memorandums are the one exception: "If the address
    // extends more than one line, indent the second line 1/4 inch." - 2-4a(5)(b)
    multiAddressWrapIndentIn: 0.25,
    multiAddressWrapCite: "AR 25-50, para 2-4a(5)(b)",

    // "Begin the signature block in the center of the page" - 2-4c(2)(a).
    // Center of the 6.5-inch text area.
    signatureBlockIndentIn: 3.25,
    signatureBlockCite: "AR 25-50, para 2-4c(2)(a)",
};

/** Usable text width between the left and right margins. */
export const TEXT_WIDTH_IN =
    LAYOUT.pageWidthIn - LAYOUT.marginLeftIn - LAYOUT.marginRightIn;

/**
 * Type. AR 25-50 delegates the choice to senior leaders and only recommends a
 * size, so these are defaults, not mandates.
 *
 *   "Army senior leaders will determine the font size and type his or her
 *    organization will use [...] a. A font with a point size of 12 is
 *    recommended. b. Unusual type styles, such as Script, will not be used in
 *    official correspondence." - 1-19
 */
export const TYPE = {
    fontFamily: "Arial",
    fontSizePt: 12,
    recommendedSizePt: 12,
    forbiddenStyles: ["script", "cursive", "decorative"],
    cite: "AR 25-50, para 1-19",
};

/**
 * Letterhead. AR 25-50 requires the DoD seal and the APD template but does not
 * publish the template's point sizes, so the geometry below is the APD
 * computer-generated letterhead layout, flagged as a default rather than a
 * quotation.
 *
 *   "Computer-generated letterhead is used for all official correspondence.
 *    Use the letterhead template provided on APD's website [...] All official
 *    letterhead stationery will bear the DoD seal. [...] Do not print any
 *    seals, emblems, decorative devices, distinguishing insignia, slogans,
 *    office symbols, names, or mottos on letterhead stationery except those
 *    approved or directed by HQDA. Use black ink." - 1-16
 */
export const LETTERHEAD = {
    requiresDodSeal: true,
    sealCite: "AR 25-50, para 1-16b(1)",
    otherInsigniaProhibited: true,
    insigniaCite: "AR 25-50, para 1-16b(2)",
    inkColor: "black",
    inkCite: "AR 25-50, paras 1-16b(3) and 1-20",
    templateSource: "https://armypubs.army.mil/tools/pubsresources.aspx",
    templateCite: "AR 25-50, para 1-16b",

    // The seal artwork itself. AR 25-50 para 1-16b(1) calls it the DoD seal;
    // the department has since been renamed, and the current seal reads
    // "DEPARTMENT OF WAR / UNITED STATES OF AMERICA". The regulation's
    // requirement is unchanged - official letterhead bears the department
    // seal - so the citation stands and the artwork is the current one.
    sealFile: "dow-seal.png",

    // First page only; continuation pages are plain white paper. - 1-18 / 2-3a(1)
    firstPageOnly: true,
    continuationPaperCite: "AR 25-50, paras 1-18 and 2-3a(1)",

    // Seal geometry, measured from the regulation's own figures rather than
    // assumed. Each of figures 2-1, 2-3 through 2-7, and 2-11 through 2-14
    // draws the seal on a full 8.5 x 11 page; scaling the seal's pixel bounding
    // box against the page gives, across ten figures:
    //
    //     diameter   0.953 in wide, 0.941 in tall   (sd 0.005 / 0.006)
    //     left edge  0.523 in from the page edge    (sd 0.005)
    //     top edge   0.524 in from the page edge    (sd 0.006)
    //
    // AR 25-50 does not state these numbers in prose; the figures are the only
    // evidence in the regulation, so they are the source.
    sealDiameterIn: 0.95,
    sealTopIn: 0.52,
    sealLeftIn: 0.52,
    sealGeometryCite: "measured from AR 25-50, figs 2-1, 2-3 through 2-7, and 2-11 through 2-14",

    // Where the body starts on page 1.
    //
    // "Type the office symbol on the second line below the seal." - para
    // 2-4a(1), and "Type the OFFICE SYMBOL at the left margin, two lines below
    // the seal" - fig 2-2. So this is stated, not a matter of taste.
    //
    // The same ten figures put the seal's lower edge at 1.450 in and the office
    // symbol at 1.792 in (sd 0.029) from the top of the page. Deriving it
    // instead - seal bottom plus two 13.8 pt lines - gives 1.853 in, which
    // overshoots because the seal's edge is not a line boundary and the
    // measurement reads the top of the glyphs rather than the line box. The
    // figures win.
    //
    // It also has to clear the continuation-page running head, which is the
    // office symbol 1 inch from the top (para 2-5a), the subject on the next
    // line (2-5b), and text on the third line below that (2-5c): 1.0 + 4 lines
    // = 1.767 in. The two agree to within four hundredths of an inch, because
    // the regulation means text to resume at the same height on every page.
    officeSymbolTopIn: 1.79,
    officeSymbolTopCite: "AR 25-50, para 2-4a(1) and fig 2-2; measured from figs 2-1, 2-3 through 2-7, and 2-11 through 2-14",

    // Point sizes remain APD template defaults - the figures are too coarse to
    // measure type size reliably, and the regulation does not publish them.
    titleSizePt: 10,
    addressSizePt: 8,
    lines: [
        "DEPARTMENT OF THE ARMY",
        "ORGANIZATIONAL NAME/TITLE",
        "STANDARDIZED STREET ADDRESS",
        "CITY STATE 12345-1234",
    ],
    linesCite: "AR 25-50, figs 2-1 through 2-5",
};

/**
 * Paragraph label formats by subdivision depth, read from figure 2-1.
 * Depth 0 is a numbered main paragraph; depth 3 is the deepest permitted.
 */
export const PARAGRAPH_LABELS = [
    {format: (i) => `${i + 1}.`, name: "main paragraph"},
    {format: (i) => `${String.fromCharCode(97 + i)}.`, name: "first subdivision"},
    {format: (i) => `(${i + 1})`, name: "second subdivision"},
    {format: (i) => `(${String.fromCharCode(97 + i)})`, name: "third subdivision"},
];

/** "Do not subdivide beyond the third subdivision." - fig 2-1 */
export const MAX_SUBDIVISION_DEPTH = 3;
export const MAX_DEPTH_CITE = "AR 25-50, fig 2-1";

/**
 * Punctuation spacing. The 4 October 2024 administrative revision reversed the
 * 2020 rule and restored two spaces after ending punctuation.
 *
 *   "Place two spaces between the punctuation and the text that immediately
 *    follows it for periods and question marks. For commas, colons, and
 *    semicolons, place one space between the punctuation and the text that
 *    immediately follows it." - 1-39b(9)
 */
export const PUNCTUATION_SPACING = {
    afterSentenceEnd: 2, // . ? and, by the same rule, !
    afterInternal: 1,    // , : ;
    cite: "AR 25-50, para 1-39b(9)",
};

/**
 * Abbreviations whose trailing period does not end a sentence. Without this
 * list, "Mr. Smith" and "U.S. Army" would be given two spaces.
 */
const NON_TERMINAL_ABBREVIATIONS = [
    "Mr", "Mrs", "Ms", "Dr", "Jr", "Sr", "St", "Prof", "Gen", "Col", "Maj",
    "Capt", "Lt", "Sgt", "Cpl", "Pvt", "Hon", "Rev", "Adm", "Cmdr", "Amb",
    "No", "Nos", "vs", "etc", "et al", "approx", "Inc", "Corp", "Ltd", "Dept",
];

/**
 * Apply para 1-39b(9): two spaces after a period, question mark, or
 * exclamation point that ends a sentence; one space after a comma, colon, or
 * semicolon. Runs of spaces are collapsed first so the result is idempotent.
 */
export function normalizePunctuationSpacing(text) {
    if (!text) return text;

    let out = String(text).replace(/[ \t]+/g, " ").trim();

    // Single-letter initials ("J. R. Smith") and listed abbreviations keep one
    // space. Protect them, normalize everything else, then restore.
    const guard = " ";
    const abbrev = new RegExp(`\\b(${NON_TERMINAL_ABBREVIATIONS.join("|")})\\.\\s+`, "g");
    out = out.replace(abbrev, (_, w) => `${w}.${guard}`);
    out = out.replace(/\b([A-Z])\.\s+(?=[A-Z]\.)/g, (_, c) => `${c}.${guard}`);

    out = out.replace(/([.?!])(["')\]]*)\s+/g, `$1$2${" ".repeat(PUNCTUATION_SPACING.afterSentenceEnd)}`);
    out = out.replace(/([,:;])\s+/g, `$1${" ".repeat(PUNCTUATION_SPACING.afterInternal)}`);

    return out.split(guard).join(" ");
}

/**
 * `_underscored_` marks a run to underline - figure 2-18 underlines the leading
 * heading word of each decision-memorandum paragraph. Only the Word renderer
 * acts on it; the text and HTML previews strip the markers, since the .docx is
 * the deliverable and emphasis is not a layout measurement.
 *
 * "Use boldface or italic type to emphasize a specific or important fact. Do
 *  not overuse this method for emphasis." - para 1-32
 */
export const EMPHASIS_MARKER = /_([^_\n]+)_/g;

export function stripEmphasis(text) {
    return String(text ?? "").replace(EMPHASIS_MARKER, "$1");
}

/** True when `text` already satisfies para 1-39b(9). */
export function hasCorrectPunctuationSpacing(text) {
    if (!text) return true;
    return normalizePunctuationSpacing(text) === String(text).trim();
}

/**
 * Army writing standards that the regulation states as targets rather than
 * hard limits. The validator reports these as advisories.
 */
export const WRITING_STANDARDS = {
    // "Use only one subject and write the subject in 10 words or less, if
    //  possible." - 2-4a(6)
    subjectMaxWords: 10,
    subjectCite: "AR 25-50, para 2-4a(6)",

    // "The average length of a sentence should be about 15 words." - 1-39b(2)
    averageSentenceWords: 15,
    sentenceCite: "AR 25-50, para 1-39b(2)",

    // "Write paragraphs that, with few exceptions, are no more than 10
    //  lines." - 1-39b(3)
    paragraphMaxLines: 10,
    paragraphCite: "AR 25-50, para 1-39b(3)",

    // "Write one-page letters and memorandums for most correspondence." - 1-39b(7)
    preferredPages: 1,
    pageCite: "AR 25-50, para 1-39b(7)",

    // "The decision memorandum [...] should not exceed two pages, excluding
    //  supporting documents." - 2-8a
    decisionMemoMaxPages: 2,
    decisionMemoCite: "AR 25-50, para 2-8a",

    // "Two essential requirements include putting the main point at the
    //  beginning of the correspondence (bottom line up front) and using the
    //  active voice." - 1-38b
    activeVoiceCite: "AR 25-50, paras 1-38b through 1-38d",
};

/**
 * Words the Army capitalizes against normal English usage.
 * "Capitalize the word 'Soldier' [...] 'Family' [...] 'Civilian'" - 1-14
 */
export const ARMY_CAPITALIZATION = {
    words: ["Soldier", "Soldiers", "Family", "Families", "Civilian", "Civilians"],
    cite: "AR 25-50, para 1-14",
};

/** "Multiple-address memorandums is up to five addresses." - 2-4a(5)(b)-(c) */
export const ADDRESS_LIMITS = {
    singleAddressMax: 1,
    multipleAddressMax: 5,
    seeDistributionAbove: 5,
    cite: "AR 25-50, paras 2-4a(5)(b) and 2-4a(5)(c)",
};

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/**
 * Memorandum date format: "13 March 2020". The abbreviated forms
 * "13 Mar 20" and "13 Mar 2020" are reserved for date stamps. - 1-25a, 2-4a(3)(c)
 */
export function formatMemoDate(date = new Date(), {stamp = false} = {}) {
    const d = date.getDate();
    const m = MONTHS[date.getMonth()];
    const y = date.getFullYear();
    return stamp ? `${d} ${m.slice(0, 3)} ${y}` : `${d} ${m} ${y}`;
}

export const DATE_FORMAT_CITE = "AR 25-50, paras 1-25a and 2-4a(3)(c)";

/** Typed (not stamped) memorandum date: "13 March 2020". */
export const MEMO_DATE_PATTERN = /^\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;

/** Date-stamp forms: "13 Mar 20" or "13 Mar 2020". */
export const MEMO_DATE_STAMP_PATTERN = /^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}|\d{4})$/;

/**
 * "Military time will be expressed in a group of four digits, from 0001 to
 *  2400 [...] The word 'hours' will not be used in conjunction with military
 *  time. [...] Military time is used for memorandums." - 1-26
 */
export const TIME = {
    pattern: /^([01]\d|2[0-3])[0-5]\d$|^2400$/,
    prohibitedSuffix: /\b(\d{4})\s*hours\b/i,
    cite: "AR 25-50, para 1-26",
};

/**
 * Enclosure listing: "For only one enclosure (Encl), do not precede 'Encl'
 * with the number 1; use only 'Encl.' For more than one enclosure, use
 * 'Encls.'" - 2-4c(3)
 */
export function enclosureLabel(count) {
    if (count <= 0) return null;
    return count === 1 ? "Encl" : `${count} Encls`;
}

export const ENCLOSURE_CITE = "AR 25-50, para 2-4c(3)";

/**
 * Distribution and copy-furnished listings are *blocked* flush with the left
 * margin, not hung like an address:
 *
 *   "type 'DISTRIBUTION:' and block the distribution formulas or addresses
 *    (flush with the left margin)" - para 2-4a(5)(c)
 *   "Begin listing 'CF:' addressees on the next line flush with the left
 *    margin." - fig 2-14
 *
 * Figure 2-8 indents subordinate entries under a heading entry, so a listing
 * entry may carry its own indent level.
 */
export const LISTING = {
    wrapIndentIn: 0,
    subEntryIndentIn: 0.25,
    continuedMarker: "(CONT)",
    cite: "AR 25-50, para 2-4a(5)(c) and figs 2-8 and 2-14",

    // "When necessary, a complete distribution listing can be prepared on a
    //  separate page. On the first page [...] type DISTRIBUTION: flush with
    //  the left margin and the words (see next page) in parentheses, directly
    //  under DISTRIBUTION: on the next line." - fig 2-9
    separatePageMarker: "(see next page)",
    separatePageCite: "AR 25-50, para 2-4a(5)(c) and fig 2-9",
};

/**
 * Addressing styles for a multiple-address memorandum. Figure 2-5 uses full
 * titles and addresses; figure 2-6 uses office symbols. "Do not mix the two
 * authorized types of addressing." - fig 2-6
 *
 * Office-symbol addresses are typed in uppercase, and an abbreviated city
 * takes no comma before the state: "Because WASH DC and ALEX VA are
 * abbreviations, do not use a comma between the city and the state." - fig 2-6
 */
export const ADDRESSING = {
    styles: ["full-title", "office-symbol"],
    officeSymbolUppercase: true,
    mixCite: "AR 25-50, fig 2-6",
    abbreviatedCities: ["WASH", "ALEX"],
    abbreviatedCityCite: "AR 25-50, fig 2-6",
};

/** Memorandums use "CF:"; letters use "cc:". - 1-21c, 1-21d */
export const COPY_MARKERS = {
    memorandum: "CF:",
    letter: "cc:",
    cite: "AR 25-50, paras 1-21c and 1-21d",
};

/** "Do not use postscripts in Army correspondence." - 1-29 */
export const POSTSCRIPTS = {
    allowed: false,
    pattern: /^\s*P\.?\s?S\.?[:\s]/im,
    cite: "AR 25-50, para 1-29",
};

/**
 * Memorandum variants this module knows how to lay out, with the paragraph
 * that governs each.
 */
export const MEMO_TYPES = {
    standard: {title: "Memorandum", cite: "AR 25-50, para 2-4"},
    thru: {title: "Memorandum THRU", cite: "AR 25-50, para 2-4a(5)(d)"},
    record: {title: "Memorandum for Record", cite: "AR 25-50, para 2-7"},
    decision: {title: "Decision Memorandum", cite: "AR 25-50, para 2-8"},
    mou: {title: "Memorandum of Understanding", cite: "AR 25-50, para 2-6a"},
    moa: {title: "Memorandum of Agreement", cite: "AR 25-50, para 2-6b"},
};

/**
 * Decision memorandum approval line.
 *
 * Figure 2-18 (wet signature) prints an "X" the approver marks by hand.
 * Figure 2-19 (digital) prints a checkbox the approver clicks. The choice
 * follows the signature method, not preference.
 */
export const DECISION_APPROVAL = {
    options: ["APPROVED", "DISAPPROVED", "SEE ME"],
    wetMark: "X",
    wetCite: "AR 25-50, fig 2-18",
    digitalCite: "AR 25-50, fig 2-19",
};

/**
 * MOU/MOA heading and signature rules, which differ from a standard
 * memorandum in every structural respect. - 2-6c
 */
export const AGREEMENT_FORMAT = {
    titleLinesBelowSeal: 2,
    betweenKeyword: "BETWEEN",
    joinKeyword: "AND",
    subjectLinesBelowAgencies: 2,
    textLinesBelowSubject: 3,
    signatureLinesBelowText: 5,
    overscoreSignatures: true,
    seniorOfficialOnRight: true,
    cite: "AR 25-50, para 2-6c",

    // "Prepare the MOU/MOA on plain white paper. If an MOU/MOA is between two
    //  Army activities, DA letterhead is appropriate." - para 2-6c(1).
    // Figures 2-15 and 2-16 both show plain paper, so that is the default.
    plainPaperByDefault: true,
    paperCite: "AR 25-50, para 2-6c(1) and figs 2-15 and 2-16",

    // Agreeing agencies are separated by semicolons with the joining word
    // before the last, as figures 2-15 and 2-16 set them:
    //   CHIEF INFORMATION OFFICER/G-6; DEPUTY CHIEF OF STAFF, G-2;
    //   AND
    //   THE DEFENSE CIVIL PREPAREDNESS AGENCY
    partySeparator: ";",
    partyCite: "AR 25-50, figs 2-15 and 2-16",

    // Each block is overscored, and carries its own shorter rule with
    // "(Date)" centred beneath it. - figs 2-15 and 2-16
    signatureRuleIn: 2.4,
    dateRuleIn: 1.5,
    dateCaption: "(Date)",
    signatureColumnIn: 3.25,
    ruleCite: "AR 25-50, para 2-6c(5)(b) and figs 2-15 and 2-16",

    // "If an MOU or MOA has three agreeing agencies, center the signature
    //  block of the highest ranking official at the bottom. Place the
    //  signature block of the next-highest ranking official above on the
    //  right. Place the signature block of the junior official above on the
    //  left." - para 2-6c(5)(d)
    thirdSignerCentredBelow: true,
    thirdSignerCite: "AR 25-50, para 2-6c(5)(d) and fig 2-15",
};

/**
 * Compose the agreeing-agency block for an MOU or MOA title.
 * Returns the lines to centre, excluding the title and BETWEEN.
 */
export function agreementParties(parties = []) {
    if (parties.length === 0) return [];
    if (parties.length === 1) return [parties[0]];

    // Two agencies are simply joined by the keyword - para 2-6c(1). Three or
    // more take semicolons, as figures 2-15 and 2-16 set them.
    const last = parties[parties.length - 1];
    if (parties.length === 2) {
        return [parties[0], AGREEMENT_FORMAT.joinKeyword, last];
    }
    const leading = parties.slice(0, -1).join(`${AGREEMENT_FORMAT.partySeparator} `)
        + AGREEMENT_FORMAT.partySeparator;
    return [leading, AGREEMENT_FORMAT.joinKeyword, last];
}

/**
 * Convert inches to whole characters for the monospace renderer.
 * The regulation's unit is the inch; characters are an approximation used only
 * by the plain-text backend.
 */
export function inchesToChars(inches, charsPerInch) {
    return Math.round(inches * charsPerInch);
}

/** Look up a citation string by dotted key, for error messages. */
export const CITATIONS = {
    margins: LAYOUT.marginsCite,
    indents: LAYOUT.indentCite,
    wrap: LAYOUT.wrapCite,
    seal: LETTERHEAD.sealCite,
    type: TYPE.cite,
    punctuation: PUNCTUATION_SPACING.cite,
    date: DATE_FORMAT_CITE,
    time: TIME.cite,
    enclosures: ENCLOSURE_CITE,
    postscripts: POSTSCRIPTS.cite,
    capitalization: ARMY_CAPITALIZATION.cite,
    maxDepth: MAX_DEPTH_CITE,
};
