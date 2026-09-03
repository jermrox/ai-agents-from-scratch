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

    /*
     * Where a digital signature box goes: the third of those five lines,
     * figured from where the figures print their own "[place digital
     * signature block here]" annotation - one blank line above the name.
     *
     * The renderer prints neither the annotation nor a box; para 1-17 sends
     * that work to Adobe Acrobat, not to Word ("See appendix F for
     * instruction on creating Adobe .pdf files and placing the digital
     * signature box"). What stays true either way is that the five reserved
     * lines above a signature block leave this exact position open, so this
     * constant is the fact rather than a stray leftover from the annotation
     * that used to sit there. See verify.js.
     */
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

    // The quarter-inch grid the *indents* sit on: "a." a quarter inch in,
    // "(1)" a half - fig 2-1 states both outright. It is also the tab grid a
    // writer types on. - para 1-39b(10)
    labelGapIn: 0.25,
    labelGapCite: "AR 25-50, para 1-39b(10)",

    /*
     * The gap between a paragraph's number and its text: one space.
     *
     * Para 1-39b(10) reads "Space 1/4 inch to the right of the parenthesis when
     * numbering subparagraphs", and taking that as the gap puts the text on the
     * quarter-inch grid - which is where the figures measure it: across figures
     * 2-3, 2-4, 2-7, 2-10, 2-11, 2-12 and 2-14, 37 numbered paragraphs, the
     * text starts a median 0.251 in from the margin.
     *
     * It is set to one space on instruction, which is a deliberate departure
     * from that measurement and is recorded as one. The reading is not
     * unreasonable: 1-39b(10) is about where a *subparagraph* begins, and
     * fig 2-17 note 3 uses "one space after the colon" for the subject, so one
     * space after a number is the same convention. Set labelSpaces to null to
     * go back to the quarter-inch grid.
     */
    labelSpaces: 1,
    labelSpacesCite: "set on instruction; cf. AR 25-50, para 1-39b(10) and fig 2-17 note 3",

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

    // Twelve point everywhere, and never higher. Para 1-19a recommends 12 and
    // nothing in AR 25-50 sets anything larger, so 12 pt is simultaneously the
    // size and the ceiling - letterhead included, by default.
    //
    // This is enforced, not advised: the Word renderer overrides every latent
    // heading style so the document cannot produce type above 12 pt by any
    // route, and verify.js scans every part of the .docx for a violation.
    maxSizePt: 12,
    maxSizeCite: "AR 25-50, para 1-19a; measured against a field memorandum whose largest run is 12 pt",

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

    // Where the letterhead block itself begins, and where the body starts on
    // page 1.
    //
    // "Type the office symbol on the second line below the seal." - para
    // 2-4a(1), and "Type the OFFICE SYMBOL at the left margin, two lines below
    // the seal" - fig 2-2.
    //
    // Both numbers are measured off the figures, not derived from a line count,
    // and there is a history behind that. Deriving them assumed the letterhead
    // was set in the body's 12 pt, so its four lines were taken to be four 13.8
    // pt lines. They are not: the letterhead is 10 pt and 8 pt (see
    // titleSizePt below), so the derived office symbol landed half a line high
    // - 1.670 in against the 1.775 in figure 2-1 actually shows. Rendering the
    // page could not catch it either, because the same wrong line height was
    // used to check it.
    //
    // Rasterising figure 2-1 at 150 px/in and calibrating on the seal - which
    // is a known 0.95 in square 0.52 in from the top and left edges, so it is a
    // ruler printed on every letterhead figure - gives, as line-box tops:
    //
    //     letterhead title     0.554 in    (ink top 0.580)
    //     office symbol        1.775 in    (ink top 1.809)
    //     left margin          1.005 in    - a known value, so the calibration
    //                                        checks out against the regulation
    //
    // These are that measurement, rounded to a hundredth.
    letterheadTopIn: 0.55,
    officeSymbolTopIn: 1.78,
    /*
     * A generated .docx is opened in far more engines than the one figure
     * 2-1 was measured against, and at least one real-world preview has been
     * reported putting the office symbol under the seal despite this file's
     * own numbers - measured against the figure and cross-checked against
     * the regulation's stated 1-inch left margin - showing 0.31 in of clear
     * air between them.
     *
     * officeSymbolTopIn stays exactly what figure 2-1 measures, because it
     * is shared: it is both page 1's top margin AND (through
     * continuationBodyFrom below) the floor a continuation page's body
     * cannot start before para 2-5c's own math. Padding it pushes both, and
     * a first attempt at that did: continuation pages landed on the 4th
     * line below the subject instead of the 3d (2-5c), and the worked
     * example spilled onto a second page it does not need.
     *
     * This buffer is added to page 1 alone, as extra blank space inside its
     * own first-page-only header (see letterheadHeader() in memo-docx.js) -
     * the same "header taller than the margin pushes the body down" OOXML
     * mechanism continuationBodyFrom already relies on for continuation
     * pages, aimed at page 1 instead of continuation pages. pgMar/top and
     * continuation-page math never see it.
     */
    officeSymbolClearanceBufferIn: 0.22,
    letterheadLines: 4,
    lineHeightPt: 13.8,          // Word single spacing for 12 pt Arial
    officeSymbolTopCite: "measured from AR 25-50, fig 2-1; para 2-4a(1) and fig 2-2",

    /*
     * Where a continuation page's text begins: the office symbol 1 inch from
     * the top (para 2-5a), the subject on the line below (2-5b), and text on
     * the third line below the subject (2-5c).
     *
     * This is half a line lower than page 1's body start, and a .docx section
     * has one top margin. OOXML expresses the difference through the header:
     * a header taller than the top margin pushes the body down by the excess,
     * which is exactly the half line wanted. So the continuation header
     * carries the 2-5c gap as trailing blank lines and the margin stays at
     * page 1's position - see continuationBodyFrom() for the arithmetic, and
     * memo-docx.js for why nothing cleverer works.
     */
    continuationBodyCite: "AR 25-50, paras 2-5a through 2-5c",

    /**
     * Where the body starts on a continuation page, computed the way Word
     * computes it: the top margin, or the bottom of the header when the header
     * is taller. `headerLines` counts the running head's own lines.
     */
    continuationBodyFrom(headerLines) {
        const line = this.lineHeightPt / 72;
        return Math.max(this.officeSymbolTopIn, 1.0 + headerLines * line);
    },

    // Letterhead point size.
    //
    // AR 25-50 does not publish one. Para 1-19 delegates the choice: "Army
    // senior leaders will determine the font size and type his or her
    // organization will use." So this is the organization's call, not the
    // regulation's, and the default is a single uniform 12 pt throughout -
    // letterhead included.
    //
    // Two older sources set the letterhead smaller, and are recorded here
    // rather than discarded, because an office still working from the APD
    // template will want them:
    //
    //   - The 2009 field template's embedded font data gives 10 pt for
    //     "DEPARTMENT OF THE ARMY" and 8 pt for the organization block.
    //   - The figures show the letterhead visibly smaller than the body,
    //     though at roughly 70 pixels per inch they cannot pin a point size
    //     closer than about 1.5 pt either way.
    //
    // Neither is a rule. Set `titleSizePt`/`addressSizePt` from
    // UNIFORM_LETTERHEAD_SIZES to set the letterhead in the body's 12 pt.
    //
    // Resolved by measurement. The note above was written from a 70 px/in
    // render, at which the figures genuinely cannot pin a point size. At 150
    // px/in they can: rasterising figure 2-1 and measuring cap heights against
    // the seal gives 0.106 in for the title and 0.080 in for the three address
    // lines, and Arial's cap height is 0.716 em, so
    //
    //     title    0.106 / 0.716 = 0.148 in = 10.7 pt
    //     address  0.080 / 0.716 = 0.112 in =  8.1 pt
    //
    // and the line pitches agree: 0.153 in between the title and the first
    // address line (an 11.5 pt line, so 10 pt type), 0.129 in between the
    // address lines (a 9.2 pt line, so 8 pt). That lands on the 2009 template's
    // 10 and 8 exactly, from two independent measurements, so the two sources
    // are not in conflict after all.
    //
    // This is not the body type and para 1-19 does not govern it: the
    // letterhead is printed stationery, and every line of the memorandum a
    // writer actually types stays at 12 pt. Setting it to 12 makes the
    // letterhead block 0.22 in taller than the regulation's - about one and a
    // sixth lines - which pushes the whole block down and closes up the gap
    // above the office symbol.
    titleSizePt: 10,
    addressSizePt: 8,
    letterheadSizeCite: "measured from AR 25-50, fig 2-1; para 1-19 leaves body type to the organization",

    // The 2009 template also carries "REPLY TO / ATTENTION OF" at 6 pt. Para
    // 1-16b(1) says that block is not required, so it is not rendered.
    replyToBlockSizePt: 6,
    replyToNotRequiredCite: "AR 25-50, para 1-16b(1)",
    lines: [
        "DEPARTMENT OF THE ARMY",
        "ORGANIZATIONAL NAME/TITLE",
        "STANDARDIZED STREET ADDRESS",
        "CITY STATE 12345-1234",
    ],
    linesCite: "AR 25-50, figs 2-1 through 2-5",
};

/**
 * A letterhead set in the body's 12 pt throughout, for an office that wants it
 * that way. Not what the figures show - see LETTERHEAD.titleSizePt - and it
 * makes the letterhead block 0.22 in taller, which moves everything above the
 * office symbol down with it.
 *
 *   renderDocx(memo, {letterhead: UNIFORM_LETTERHEAD_SIZES})
 */
export const UNIFORM_LETTERHEAD_SIZES = {
    titleSizePt: 12,
    addressSizePt: 12,
    cite: "AR 25-50, para 1-19 - the organization sets the size",
};

/**
 * USPS two-letter State and territory abbreviations - table 5-3, complete and
 * in the order printed. Fifty-four entries; American Samoa, the Northern
 * Mariana Islands, and the Freely Associated States are not listed, so they
 * are not invented here.
 */
export const STATE_ABBREVIATIONS = {
    Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
    Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
    Florida: "FL", Georgia: "GA", Guam: "GU", Hawaii: "HI", Idaho: "ID",
    Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY",
    Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA",
    Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
    Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH",
    "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
    Oregon: "OR", Pennsylvania: "PA", "Puerto Rico": "PR", "Rhode Island": "RI",
    "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX",
    Utah: "UT", Vermont: "VT", Virginia: "VA", "Virgin Islands": "VI",
    Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

export const STATE_TABLE_CITE = "AR 25-50, table 5-3";

/**
 * Overseas "State" codes, which are not in table 5-3 but are valid in the same
 * position:
 *   AE  Armed Forces in Europe, the Middle East, Africa, and Canada
 *   AP  Armed Forces in the Pacific
 *   AA  Armed Forces in the Americas, excluding Canada
 * - para 5-10a
 *
 * "Mail addressed to an Army Post Office (APO)/Fleet Post Office (FPO) is not
 *  considered international mail and will not have the city or country name
 *  placed in the address. Identifying classified overseas units could lead to
 *  a breach of security." - para 5-10
 */
export const OVERSEAS_CODES = {AE: "Europe, Middle East, Africa, and Canada",
    AP: "Pacific", AA: "Americas, excluding Canada"};
export const OVERSEAS_CITE = "AR 25-50, para 5-10a";

export const VALID_STATE_CODES = new Set([
    ...Object.values(STATE_ABBREVIATIONS), ...Object.keys(OVERSEAS_CODES),
]);

/**
 * "The ZIP code is a nine-digit number [...] A complete address must include
 *  the proper ZIP code. Type the ZIP code two spaces after the last letter of
 *  the State." - para 5-10b
 */
export const ZIP = {
    spacesAfterState: 2,
    pattern: /\b\d{5}-\d{4}\b/,
    fiveDigitOnly: /\b\d{5}(?!-\d{4})\b/,
    cite: "AR 25-50, para 5-10b",
};

/**
 * Put the ZIP code two spaces after the State, per para 5-10b. This is a
 * format rule, so the renderer applies it rather than trusting the author -
 * the same treatment sentence spacing gets under para 1-39b(9).
 */
export function normalizeZipSpacing(address) {
    if (!address) return address;
    return String(address).replace(
        /\b([A-Z]{2}) +(\d{5}(?:-\d{4})?)\b/g,
        (_, code, zip) => (VALID_STATE_CODES.has(code)
            ? `${code}${" ".repeat(ZIP.spacesAfterState)}${zip}`
            : `${code} ${zip}`),
    );
}

/**
 * "When addressing military correspondence to an individual by name, show the
 *  military grade or civilian prefix, first name, middle initial (if known),
 *  and last name in that order. For military personnel, use the following
 *  Service designation abbreviations after the addressee's name: USA for U.S.
 *  Army, USN for U.S. Navy, USAF for U.S. Air Force, USMC for U.S. Marine
 *  Corps, and USCG for U.S. Coast Guard." - para 5-9b
 *
 * This is the form required wherever a memorandum is addressed to a person
 * rather than an office - "Exclusive For", appreciation, and commendation
 * (para 2-4a(5)).
 */
export const SERVICE_DESIGNATIONS = {
    "U.S. Army": "USA", "U.S. Navy": "USN", "U.S. Air Force": "USAF",
    "U.S. Marine Corps": "USMC", "U.S. Coast Guard": "USCG",
};
export const ADDRESSEE_NAME_CITE = "AR 25-50, para 5-9b";

/** Format an individual addressee in the para 5-9b order. */
export function formatAddresseeName({grade, prefix, first, middleInitial, last, service}) {
    const mi = middleInitial ? `${String(middleInitial).replace(/\.$/, "")}.` : null;
    const name = [grade ?? prefix, first, mi, last].filter(Boolean).join(" ");
    return service ? `${name}, ${service}` : name;
}

/**
 * Protocol sequence for multiple-addressee correspondence to HQDA principal
 * officials - figure B-2, in the order printed. "The term 'HQDA principal
 * officials' [...] includes all the positions listed in figure B-2." - para B-2
 */
export const PROTOCOL_HQDA = [
    "Secretary of the Army",
    "Chief of Staff of the Army",
    "Under Secretary of the Army",
    "Vice Chief of Staff of the Army",
    "Assistant Secretary of the Army (Acquisition, Logistics and Technology)",
    "Assistant Secretary of the Army (Civil Works)",
    "Assistant Secretary of the Army (Financial Management and Comptroller)",
    "Assistant Secretary of the Army (Installations, Energy and Environment)",
    "Assistant Secretary of the Army (Manpower and Reserve Affairs)",
    "General Counsel",
    "Deputy Under Secretary of the Army",
    "Administrative Assistant to the Secretary of the Army",
    "The Inspector General",
    "The Army Auditor General",
    "Executive Director, Office of Army Cemeteries",
    "Chief Information Officer",
    "Chief of Legislative Liaison",
    "Director of Small Business Programs",
    "Director, U.S. Army Criminal Investigation Division",
    "Chief of Public Affairs",
    "Director of the Army Staff",
    "Sergeant Major of the Army",
    "Deputy Chief of Staff, G-1",
    "Deputy Chief of Staff, G-2",
    "Deputy Chief of Staff, G-3/5/7",
    "Deputy Chief of Staff, G-4",
    "Deputy Chief of Staff, G-6",
    "Deputy Chief of Staff, G-8",
    "Deputy Chief of Staff, G-9",
    "Director, Army National Guard",
    "Chief of Army Reserve",
    "Chief of Engineers",
    "The Surgeon General",
    "The Judge Advocate General",
    "Chief of Chaplains",
    "Provost Marshal General",
];

/**
 * The one place AR 25-50 hands its own format off to another publication.
 *
 * Para 1-6 asserts primacy - "The formats for correspondence outlined in this
 * regulation take precedence over format instructions outlined in other
 * regulations or directives" - and then carves out a single exception, by
 * *signature authority* rather than by document type:
 *
 *   "When preparing correspondence for signature by the Secretary of Defense;
 *    Secretary of the Army; Chief of Staff of the Army; Under Secretary of the
 *    Army; Vice Chief of Staff of the Army; Assistant Secretaries of the Army;
 *    AASA; and other HQDA principal officials, follow the guidance in
 *    Department of Defense (DoD) 5110.04, Volume 1 and HQDA Writing and
 *    Product SOP." - para 1-6, Note
 *
 * Para 2-2 adds origination as a second trigger: "Refer to HQDA Writing and
 * Product SOP for correspondence originating within Army Secretariat or Army
 * Staff organizations."
 *
 * Neither publication is implemented here, and neither is public. So this is
 * detected and reported, never silently formatted to AR 25-50 anyway.
 */
export const SUPERSEDING_AUTHORITY = {
    signers: [
        "Secretary of Defense",
        "Secretary of the Army",
        "Chief of Staff of the Army",
        "Under Secretary of the Army",
        "Vice Chief of Staff of the Army",
        "Assistant Secretary of the Army",
        "Administrative Assistant to the Secretary of the Army",
    ],
    publications: ["DoDM 5110.04, Volume 1", "HQDA Writing and Product SOP"],
    cite: "AR 25-50, para 1-6 (Note) and para 2-2 (Note)",
    sopUrl: "https://csa.army.pentagon.mil/ecc/SitePages/Correspondence Formats And Letterheads.aspx",
};

/**
 * Whether AR 25-50's formats are superseded for this memorandum, by signature
 * authority (para 1-6 Note) or by originating organization (para 2-2 Note).
 * `PROTOCOL_HQDA` is the definition of "HQDA principal officials" - para B-2
 * says the term "includes all the positions listed in figure B-2".
 */
export function supersedingAuthority({signerTitle = "", originatingOrganization = ""} = {}) {
    const title = String(signerTitle);
    const named = SUPERSEDING_AUTHORITY.signers.find((s) =>
        title.toUpperCase().includes(s.toUpperCase()));
    if (named) return {superseded: true, reason: `signature by the ${named}`};

    const principal = PROTOCOL_HQDA.find((p) => title.toUpperCase().includes(p.toUpperCase()));
    if (principal) return {superseded: true, reason: `signature by an HQDA principal official (${principal})`};

    const org = String(originatingOrganization);
    if (/\b(Army Secretariat|Army Staff|HQDA)\b/i.test(org)) {
        return {superseded: true, reason: `origination within ${org}`};
    }
    return {superseded: false};
}

/**
 * "This appendix prescribes special requirements for mass mailings, which are
 *  defined as similar correspondence [...] sent to 20 or more recipients."
 *  - para E-1
 *
 * Appendix E adds no format element. It attaches governance obligations to the
 * organization: named release authority, error-free review, written procedures
 * (para E-2a), a prohibition on splitting a mailing to duck the threshold
 * (E-2b), and a flat prohibition on using mass mailings to communicate with
 * the Families of deceased Soldiers (E-2c).
 */
export const MASS_MAILING = {
    threshold: 20,
    cite: "AR 25-50, paras E-1 and E-2",
    prohibitions: [
        "Do not split a mass mailing into smaller communications to avoid the threshold.",
        "Mass mailings will not be used to communicate with the Families (next of kin) of deceased Soldiers.",
    ],
};

/** Protocol sequence for the Office of the Secretary of Defense - figure B-1. */
export const PROTOCOL_OSD = [
    "Secretary of Defense",
    "Deputy Secretary of Defense",
    "Secretaries of the Military Departments",
    "Chairman of the Joint Chiefs of Staff",
    "Under Secretaries of Defense",
    "Chief of the National Guard Bureau",
    "General Counsel of the Department of Defense",
    "Director of Cost Assessment and Program Evaluation",
    "Inspector General of the Department of Defense",
    "Director of Operational Test and Evaluation",
    "Chief Information Officer of the Department of Defense",
    "Assistant Secretary of Defense for Legislative Affairs",
    "Assistant to the Secretary of Defense for Public Affairs",
    "Director of Net Assessment",
    "Directors of Defense Agencies",
    "Directors of DoD Field Activities",
];

/**
 * Figure B-2's one footnote: the five Assistant Secretaries of the Army are a
 * single line each in the figure, and take their own alphabetical order when
 * some but not all of them are named separately.
 */
export const PROTOCOL_HQDA_DETAIL = {
    cite: "AR 25-50, fig B-2, note",
    assistantSecretariesOfArmy: {
        order: ["ASA (Acquisition, Logistics and Technology)", "ASA (Civil Works)",
                "ASA (Financial Management and Comptroller)", "ASA (Installations, Energy and Environment)",
                "ASA (Manpower and Reserve Affairs)"],
        alphabetical: true, cite: "AR 25-50, fig B-2, note",
    },
};

export const PROTOCOL_CITE = "AR 25-50, appendix B, figs B-1 and B-2";

/**
 * Figure B-1's eight footnotes. Four of them break a single line of the
 * figure into its own protocol sequence for when a memorandum names some but
 * not all of that category - "Secretaries of the Military Departments" is one
 * line in the figure and three positions with a stated order underneath it.
 * The other three name their categories' members in the alphabetical order
 * the footnote itself specifies, and the eighth is a fallback with no list to
 * transcribe: "refer to the most recent DoD Order of Precedence memorandum."
 *
 * `insertAfter`/`insertBefore` record where a sub-list sits in the parent
 * sequence when it is not already a single named line there - footnotes 3 and
 * 4 both say so explicitly ("will be listed after ... and before ...").
 */
export const PROTOCOL_OSD_DETAIL = {
    cite: "AR 25-50, fig B-1, notes 1-8",
    secretariesOfMilitaryDepartments: {
        order: ["Secretary of the Army", "Secretary of the Navy", "Secretary of the Air Force"],
        cite: "AR 25-50, fig B-1, note 1",
    },
    underSecretariesOfDefense: {
        order: [
            "Under Secretary of Defense for Research and Engineering",
            "Under Secretary of Defense for Acquisition and Sustainment",
            "Under Secretary of Defense for Policy",
            "Under Secretary of Defense (Comptroller)/Chief Financial Officer of the Department of Defense",
            "Under Secretary of Defense for Personnel and Readiness",
            "Under Secretary of Defense for Intelligence",
        ],
        cite: "AR 25-50, fig B-1, note 2",
    },
    chiefsOfMilitaryServices: {
        order: ["Chief of Staff of the Army", "Commandant of the Marine Corps",
                "Chief of Naval Operations", "Chief of Staff of the Air Force"],
        insertAfter: "Under Secretaries of Defense", insertBefore: "Chief of the National Guard Bureau",
        cite: "AR 25-50, fig B-1, note 3",
    },
    combatantCommands: {
        order: [],   // alphabetical order of whichever commands are addressed - none are named
        alphabetical: true,
        insertAfter: "Chief of the National Guard Bureau",
        insertBefore: "General Counsel of the Department of Defense",
        cite: "AR 25-50, fig B-1, note 4",
    },
    assistantSecretariesOfDefense: {
        order: ["Acquisition", "Asian and Pacific Security Affairs", "Energy, Installation and Environment",
                "Health Affairs", "Homeland Defense and Global Security", "International Security Affairs",
                "Logistics and Materiel Readiness", "Manpower and Reserve Affairs",
                "Nuclear, Chemical, and Biological Defense Programs", "Readiness", "Research and Engineering",
                "Special Operations and Low Intensity Conflict", "Strategy, Plans, and Capabilities"],
        alphabetical: true, insertAfter: "Assistant Secretary of Defense for Legislative Affairs",
        cite: "AR 25-50, fig B-1, note 5",
    },
    directorsOfDefenseAgencies: {
        order: ["Defense Advanced Research Projects Agency", "Defense Commissary Agency",
                "Defense Contract Audit Agency", "Defense Contract Management Agency",
                "Defense Finance and Accounting Service", "Defense Health Agency",
                "Defense Information Systems Agency", "Defense Intelligence Agency",
                "Defense Legal Services Agency", "Defense Logistics Agency",
                "Defense Prisoner of War/Missing in Action Accounting Agency",
                "Defense Security Cooperation Agency", "Defense Security Service",
                "Defense Threat Reduction Agency", "Missile Defense Agency",
                "National Geospatial-Intelligence Agency", "National Reconnaissance Office",
                "National Security Agency/Central Security Service", "Pentagon Force Protection Agency"],
        alphabetical: true, cite: "AR 25-50, fig B-1, note 6",
    },
    directorsOfDodFieldActivities: {
        order: ["Defense Media Activity", "Defense Technical Information Center",
                "Defense Technology Security Administration", "DoD Education Activity",
                "DoD Human Resources Activity", "DoD Test Resource Management Center",
                "Office of Economic Adjustment", "Washington Headquarters Services"],
        alphabetical: true, cite: "AR 25-50, fig B-1, note 7",
    },
    // "When addressing memorandums that also include other DoD officials,
    //  refer to the most recent DoD Order of Precedence memorandum to
    //  determine appropriate placement order." - fig B-1, note 8. No list
    //  in AR 25-50 to transcribe; this is the fact that none exists here.
    otherOfficials: {referTo: "the most recent DoD Order of Precedence memorandum", cite: "AR 25-50, fig B-1, note 8"},
};

/**
 * Whether a set of same-category addressees (the footnote 1/2/3 style, a
 * fixed stated order) or an alphabetical-order category (5/6/7) is in the
 * order its footnote requires. Names that are not in the category's own list
 * are ignored, the same tolerance `checkProtocolOrder` uses.
 */
export function checkProtocolDetailOrder(addressees, detail) {
    const want = detail.alphabetical
        ? [...detail.order].sort((a, b) => a.localeCompare(b))
        : detail.order;
    const present = want.filter((title) =>
        addressees.some((a) => String(a).toUpperCase().includes(title.toUpperCase())));
    const seen = addressees
        .map((a) => want.find((title) => String(a).toUpperCase().includes(title.toUpperCase())))
        .filter(Boolean);
    return seen.length === present.length && seen.every((title, i) => title === present[i]);
}

/**
 * Where an addressee sits in a protocol sequence, or -1 if it is not one of
 * the listed positions. Matching is loose because a memorandum writes the
 * title alongside an office symbol and address.
 */
export function protocolRank(addressee, sequence = PROTOCOL_HQDA) {
    const text = String(addressee).toUpperCase();
    let best = -1;
    let bestLength = 0;
    sequence.forEach((title, i) => {
        const t = title.toUpperCase();
        if (text.includes(t) && t.length > bestLength) {
            best = i;
            bestLength = t.length;
        }
    });
    return best;
}

/**
 * Whether a list of addressees is in protocol order. Addressees that are not
 * listed positions are ignored - AR 25-50 states no protocol rule for
 * arbitrary offices, only for the OSD and HQDA populations in appendix B.
 */
export function checkProtocolOrder(addressees = [], sequence = PROTOCOL_HQDA) {
    const ranked = addressees
        .map((a, index) => ({index, rank: protocolRank(a, sequence), addressee: a}))
        .filter((r) => r.rank >= 0);

    for (let i = 1; i < ranked.length; i++) {
        if (ranked[i].rank < ranked[i - 1].rank) {
            return {inOrder: false, offender: ranked[i], previous: ranked[i - 1]};
        }
    }
    return {inOrder: true, matched: ranked.length};
}

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
    const guard = "\u0000";
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
 * Build the enclosure listing - AR 25-50, chapter 4.
 *
 * The governing sentence is the lead-in to para 4-2, and it turns on a fact
 * about the *body*, not about the enclosures:
 *
 *   "Enclosures should be listed only when they have not been identified in
 *    the body of the correspondence."
 *
 * That produces four different listings, and only one of them is the familiar
 * numbered list:
 *
 *   4-2c(4), tbl 4-4  all identified in the body -> the bare word alone,
 *                     "Encl" or "Encls", with no count and no descriptions
 *   4-2c(3), tbl 4-3  one, not identified        -> "Encl" with no number,
 *                     the description on the line below
 *   4-2c(2), tbl 4-2  two or more, not identified-> "N Encls" and a numbered
 *                     description of each
 *   4-2c(6), tbl 4-6  mixed                      -> "N Encls" where N counts
 *                     them all, with each run of identified enclosures
 *                     collapsed to "1-3. as"
 *
 * `enclosures` accepts plain strings (treated as not identified in the body)
 * or objects {title, identifiedInBody}.
 *
 * Returns {label, entries: [{text}], cite}.
 */
export function buildEnclosureListing(enclosures = []) {
    const items = enclosures.map((e) => (typeof e === "string"
        ? {title: e, identifiedInBody: false}
        : {title: e.title ?? "", identifiedInBody: !!e.identifiedInBody}));

    if (items.length === 0) return {label: null, entries: [], cite: null};

    const total = items.length;
    const identified = items.filter((i) => i.identifiedInBody).length;

    // "Account for enclosures identified in the body of the correspondence
    //  without a number preceding 'Encl/Encls.' The enclosure listing will
    //  simply state 'Encl/Encls'." - para 4-2c(4)
    if (identified === total) {
        return {
            label: total === 1 ? "Encl" : "Encls",
            entries: [],
            cite: "AR 25-50, para 4-2c(4)",
        };
    }

    // "Account for one enclosure not identified in the body of the
    //  correspondence without a number." - para 4-2c(3). Table 4-3 still
    //  prints the description, on the line below.
    if (identified === 0 && total === 1) {
        return {
            label: "Encl",
            entries: [{text: capitalizeFirstWord(items[0].title)}],
            cite: "AR 25-50, para 4-2c(3)",
        };
    }

    // "indicating the total number. List each enclosure by number when you
    //  have two or more and describe each briefly." - para 4-2c(2)
    if (identified === 0) {
        return {
            label: `${total} Encls`,
            entries: items.map((it, i) => ({text: `${i + 1}. ${capitalizeFirstWord(it.title)}`})),
            cite: "AR 25-50, para 4-2c(2)",
        };
    }

    // "Use 'as' (as stated) when identifying some enclosures but not others."
    // - para 4-2c(6). Table 4-6 collapses the identified run: "1-3. as".
    const entries = [];
    let i = 0;
    while (i < total) {
        if (items[i].identifiedInBody) {
            let j = i;
            while (j + 1 < total && items[j + 1].identifiedInBody) j++;
            entries.push({text: i === j ? `${i + 1}. as` : `${i + 1}\u2013${j + 1}. as`});
            i = j + 1;
        } else {
            entries.push({text: `${i + 1}. ${capitalizeFirstWord(items[i].title)}`});
            i++;
        }
    }
    return {label: `${total} Encls`, entries, cite: "AR 25-50, para 4-2c(6)"};
}

/**
 * "For memorandums, capitalize the first letter in the first word of a listed
 *  enclosure." - para 4-2c(1)
 */
export function capitalizeFirstWord(text) {
    const t = String(text ?? "").trim();
    return t ? t[0].toUpperCase() + t.slice(1) : t;
}

export const ENCLOSURE_LISTING_CITE = "AR 25-50, paras 4-2b and 4-2c";

/**
 * "For memorandums, begin listing enclosures at the left margin on the same
 *  line as the signature block. For letters, type 'Enclosure' two lines below
 *  the signature block flush with the left margin." - para 4-2b
 *
 * "Abbreviate the word 'Enclosure' with 'Encl' in memorandums. Enclosures will
 *  be spelled out in letters." - para 4-2c(5), and "Do not list enclosures on
 *  letters." - para 4-2c(1)
 */
export const ENCLOSURE_PLACEMENT = {
    memorandum: {abbreviate: true, sameLineAsSignature: true, itemized: true},
    letter: {abbreviate: false, linesBelowSignature: 2, itemized: false},
    cite: "AR 25-50, paras 4-2b, 4-2c(1), and 4-2c(5)",
};

/**
 * "If the correspondence has three or more enclosures, tab each one." - para
 * 4-3. Physical assembly, but the threshold is worth surfacing to the author.
 */
export const TABBING = {
    tabWhenEnclosuresAtLeast: 3,
    firstTabFromTopIn: [0.25, 0.5],
    subsequentTabSpacingIn: 0.25,
    cite: "AR 25-50, para 4-3 and fig 4-1",

    // "To tab a correspondence package forwarded for signature or approval,
    //  identify the tabs in the document. (Tabs may be any letter or number as
    //  long as they are consecutive and fully identified in the text.)" - 4-4a
    packageOrder: [
        "correspondence to be signed or material to be approved",
        "document that started the action",
        "backup information and staff coordination comments",
    ],
    packageCite: "AR 25-50, para 4-4a",

    // "If an enclosure has its own enclosures that need tabbing, use a
    //  different color or type of tab to identify these secondary documents."
    //  - para 4-3. Figure 4-1 names them relative to their parent, "ENCL 1 TO
    //  TAB B", and interleaves them in reading order.
    secondaryLabel: (parent, n) => `ENCL ${n} TO TAB ${parent}`,

    // "Write or type 'Encl' and the number at the lower right corner of the
    //  first page of each enclosure before scanning or making any required
    //  copies." - para 4-2d(1). This module emits the memorandum only, so it
    //  is an instruction to whoever assembles the package.
    stampEachEnclosure: (n) => `Encl ${n}`,
    stampCite: "AR 25-50, para 4-2d(1)",
};

/**
 * "When sending an enclosure separately from the correspondence, write it in
 *  the body of the correspondence and add a short note to the enclosure when
 *  forwarded." - para 4-2d(2)
 *
 * Two obligations. The first is checkable against the memorandum: the body has
 * to say so. The second travels with the enclosure, so it can only be
 * reported.
 */
export const SEPARATE_COVER = {
    cite: "AR 25-50, para 4-2d(2)",
    note: "Attach a short note to the enclosure saying it belongs to this memorandum when it is forwarded.",
};

/**
 * Whether the body mentions an enclosure well enough to satisfy para 4-2d(2).
 * Matched on the title's distinctive words rather than the whole string, since
 * the body will paraphrase - "the maintenance schedule at enclosure 1" refers
 * to "Range 14 Maintenance Schedule" without repeating it.
 */
export function bodyMentionsEnclosure(title, bodyText) {
    const stop = new Set(["the", "a", "an", "of", "and", "for", "to", "in", "on", "at", "by", "with"]);
    const words = String(title).toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
    const distinctive = words.filter((w) => !stop.has(w));
    if (distinctive.length === 0) return false;

    const text = String(bodyText).toLowerCase();
    const hits = distinctive.filter((w) => text.includes(w)).length;
    // Most of the distinctive words, so a passing use of one common noun is
    // not mistaken for identifying the enclosure.
    return hits / distinctive.length >= 0.5;
}

/**
 * Whether a set of tab labels satisfies para 4-4a: "Tabs may be any letter or
 * number as long as they are consecutive and fully identified in the text."
 *
 * Two conditions, and both are checkable: the labels run without a gap, and
 * every one of them is named somewhere in the body.
 */
export function checkTabSequence(tabs = [], bodyText = "") {
    const labels = tabs.map((t) => String(typeof t === "string" ? t : (t?.label ?? "")).trim())
        .filter(Boolean);
    if (labels.length === 0) return {ok: true, labels, consecutive: true, unmentioned: []};

    const allLetters = labels.every((l) => /^[A-Za-z]$/.test(l));
    const allNumbers = labels.every((l) => /^\d+$/.test(l));

    let consecutive = false;
    if (allLetters) {
        const codes = labels.map((l) => l.toUpperCase().charCodeAt(0));
        consecutive = codes.every((c, i) => i === 0 || c === codes[i - 1] + 1);
    } else if (allNumbers) {
        const nums = labels.map(Number);
        consecutive = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    }

    // "fully identified in the text" - the label has to be named, not merely
    // implied by the count.
    const text = String(bodyText);
    const unmentioned = labels.filter((l) =>
        !new RegExp(`\\btab\\s+${l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));

    return {
        ok: consecutive && unmentioned.length === 0,
        labels,
        consecutive,
        mixedKinds: !allLetters && !allNumbers,
        unmentioned,
    };
}

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

/**
 * "Certain official correspondence cannot be addressed directly to the
 *  individual because it requires the attention of his or her commanding
 *  officer. Address such correspondence to the commander of the individual;
 *  indicate the individual's military grade, full name, and last known unit
 *  address of assignment." - para 5-11
 *
 * Table 5-4's own example: "COMMANDER OF PFC [Name]" over the individual's
 * unit address, unchanged.
 */
export function commanderOfAddressForm(grade, name, unitAddressLines = []) {
    return [`COMMANDER OF ${grade} ${name}`, ...unitAddressLines];
}
export const COMMANDER_OF_CITE = "AR 25-50, para 5-11";

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
 * "List references in the first paragraph of the correspondence... List and
 *  number references in the order they are mentioned in the correspondence.
 *  However, when references are not included in the body of the
 *  correspondence, number, and list them in order of precedence and
 *  ascending date order in the first paragraph." - para 1-30
 *
 * Five of the paragraph's subparagraphs are sentence templates, filled in
 * exactly as the regulation's own examples fill them - tested against those
 * literal strings, the same oracle the layout figures serve elsewhere.
 */
export const REFERENCES = {
    cite: "AR 25-50, para 1-30",

    // "AR 25-50 (Preparing and Managing Correspondence)" - para 1-30a
    publication: (number, title) => `${number} (${title})`,
    publicationCite: "AR 25-50, para 1-30a",

    // "HQ USARC, AFRC-ZA memorandum (Training for Army Materiel Command
    //  Personnel), 20 February 2020." - para 1-30b(1)
    correspondence: ({organization, officeSymbol, type, subject, date}) =>
        `${organization}, ${officeSymbol} ${type} (${subject}), ${date}.`,
    correspondenceCite: "AR 25-50, para 1-30b",

    // "HQ TRADOC, ATPL-TDD-OR, [full name] email (Correspondence
    //  Memorandum), 3 January 2020." - para 1-30c(1)
    emailOrFax: ({organization, officeSymbol, fullName, medium, subject, date}) =>
        `${organization}, ${officeSymbol}, ${fullName} ${medium} (${subject}), ${date}.`,
    emailOrFaxCite: "AR 25-50, para 1-30c",

    // "National Environmental Policy Act of 1969, Public Law No. 91-190,
    //  Section 103, 83 Statute 852, 853 (1970)." - para 1-30d(1)
    publicLaw: ({name, publicLawNumber, section, statute, year}) =>
        `${name}, Public Law No. ${publicLawNumber}, Section ${section}, ${statute} (${year}).`,
    publicLawCite: "AR 25-50, para 1-30d",

    // "Reference telephone conversation between [full name], TRADOC, and
    //  [full name], CIO (Records Management), 23 January 2020." - para 1-30g(1)
    telephoneOrMeeting: ({kind, participants, subject, date}) =>
        `Reference ${kind} between ${participants.join(", and ")} (${subject}), ${date}.`,
    telephoneOrMeetingCite: "AR 25-50, para 1-30g",

    // "In memorandums, you may use the term 'subject as above' or the
    //  acronym 'SAB' in lieu of repeating the subject. You cannot do so in
    //  letters." - para 1-30h
    sameSubjectShorthand: ["subject as above", "SAB"],
    sameSubjectMemorandumOnlyCite: "AR 25-50, para 1-30h",
};

/** Whether `text` uses the para 1-30h "SAB" / "subject as above" shorthand. */
export function usesSameSubjectShorthand(text = "") {
    return /\bsubject as above\b/i.test(String(text)) || /\bSAB\b/.test(String(text));
}

/**
 * "Attachments to enclosures are referred to as enclosures to enclosures
 *  (for example, enclosure 3 to enclosure 2), if necessary." - para 1-34
 *
 * Distinct from `TABBING.secondaryLabel` (para 4-3), which names a *tab* in a
 * package forwarded for signature. This names an attachment in running text -
 * lowercase, numeric on both sides, no tab letter involved.
 */
export function enclosureToEnclosureLabel(child, parent) {
    return `enclosure ${child} to enclosure ${parent}`;
}
export const ENCLOSURE_TO_ENCLOSURE_CITE = "AR 25-50, para 1-34";

/**
 * "In accordance with AR 25-400-2, delegations of signature authority must be
 *  created and maintained using the record number 25-50a." - para 1-37
 *
 * A recordkeeping obligation with nothing to render on the page - the same
 * shape as the appendix F signature boxes and the appendix E mass-mailing
 * review: reported to the drafter, not silently left undone. It fires only
 * when the memorandum itself says what it is for, since nothing else in a
 * spec distinguishes a memorandum that delegates signature authority from
 * any other memorandum an authority line happens to appear on.
 */
export const DELEGATION_SIGNATURE_AUTHORITY_RECORDKEEPING = {
    recordNumber: "25-50a",
    note: "This delegates signature authority, so it is filed under record number 25-50a, per AR 25-400-2.",
    cite: "AR 25-50, para 1-37",
};

/**
 * "Written delegation should address or contain the following:" - para
 * 6-1b(1). Surfaced as a reminder alongside the recordkeeping note above,
 * not detected in the body text - unlike a fixed phrase such as an
 * authority line, there is no one wording of these two statements to match
 * free-form legal boilerplate against.
 */
export const DELEGATION_REQUIRED_STATEMENTS = {
    statements: [
        "A statement that the commander or head of the agency or office retains the authority to cancel or withdraw the delegated authority at any time.",
        "A statement that upon change of command or change of the agency head or office, all delegations are subject to review by the new commander, who may cancel or change some delegations.",
    ],
    cite: "AR 25-50, para 6-1b(1)",
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
    exclusiveFor: {title: "Exclusive For Memorandum", cite: "AR 25-50, para 1-12"},
    appreciation: {title: "Memorandum of Appreciation", cite: "AR 25-50, paras 2-2 and 2-4a(5)"},
    commendation: {title: "Memorandum of Commendation", cite: "AR 25-50, paras 2-2 and 2-4a(5)"},

    // The other correspondence vehicle, not a memorandum at all. - chapter 3
    letter: {title: "Letter", cite: "AR 25-50, chapter 3"},
};

/**
 * "Exclusive For" correspondence - para 1-12.
 *
 *   "Use 'Exclusive For' correspondence for matters of a sensitive or
 *    privileged nature directed to a specific party or parties. Minimize its
 *    use to avoid delay of action if the named addressee is absent or
 *    unavailable [...] Address 'Exclusive For' correspondence to the name and
 *    title of the addressee." - paras 1-12a and 1-12b
 *
 * The memorandum form is not the usual uppercase "MEMORANDUM FOR". Para
 * 1-12b(1) prints it as:
 *
 *   Memorandum Exclusive For [Full Name], [Title], [Mailing Address]
 *   Memorandum Exclusive For Commander of [Name], [Title], [Mailing Address]
 */
export const EXCLUSIVE_FOR = {
    keyword: "Memorandum Exclusive For",
    commanderKeyword: "Memorandum Exclusive For Commander of",
    letterKeyword: "Exclusive For",
    cite: "AR 25-50, para 1-12b(1)",

    // "When preparing 'Exclusive For' correspondence, place it in a sealed
    //  envelope. Print and underline the words 'Exclusive For' on the
    //  envelope." - para 1-12c. This is a handling instruction, not a
    //  rendering one, so it is surfaced as a note rather than drawn.
    envelopeNote: "Place in a sealed envelope. Print and underline \"Exclusive For\" on the envelope.",
    envelopeCite: "AR 25-50, para 1-12c",
};

/**
 * Memorandum forms addressed to a person rather than to an office.
 *
 *   "Exception: When used for 'Exclusive For' correspondence, appreciation,
 *    and commendation, address the memorandum to the name and title of the
 *    addressee." - para 2-4a(5)
 *
 * Para 2-2 lists the same two among the uses of a memorandum: "for showing
 * appreciation or commendation to DA Civilians and Soldiers".
 */
export const PERSONAL_ADDRESS_TYPES = ["exclusiveFor", "appreciation", "commendation"];

/**
 * Appendix C - Forms of Address, Salutation, and Complimentary Close.
 *
 *   "The proper form for addresses in letters, on envelopes, and for
 *    salutations and complimentary closes in letters is provided in tables
 *    C-1 through C-11." - para C-2a
 *
 * This is what para 3-2 means when it names the letter's audience - the
 * President, Members of Congress, Justices, State Governors, mayors, foreign
 * officials, the public - and what para 3-5e means by "See appendix C for
 * proper addressing of letters." A letter that gets the layout right and the
 * salutation wrong is still wrong, and nothing before this checked the
 * salutation at all.
 *
 * Every table below is transcribed from the tables themselves, not summarized:
 * each entry is address lines, a salutation, and a complimentary close, in the
 * regulation's own placeholder wording ("(full name)", "(surname)"). Table C-4
 * (Military Personnel) is the one exception, and it is explained where it
 * starts.
 */
export const APPENDIX_C = {
    cite: "AR 25-50, appendix C",
    generalCite: "AR 25-50, para C-1",

    /** Table C-1 - The Executive Branch. */
    executiveBranch: {
        cite: "AR 25-50, table C-1",
        entries: [
            {addressee: "The President",
             address: ["The President", "The White House", "1600 Pennsylvania Avenue NW", "Washington 20500-0003"],
             salutation: "Dear Mr./Madam President:", close: "Respectfully, or Respectfully yours,"},
            {addressee: "Spouse of the President",
             address: ["Preferred title (full name) or Mr./Mrs. (full name)"],
             salutation: "Dear (Preferred title)/Mr./Ms. (surname):", close: "Respectfully, or Respectfully yours,"},
            {addressee: "Assistant to the President",
             address: ["Honorable (full name) or Mr./Mrs. (full name)", "The White House",
                        "1600 Pennsylvania Avenue NW", "Washington, DC 20500-0003"],
             salutation: "Dear (Preferred title)/Mr./Ms. (surname):", close: "Respectfully, or Respectfully yours,"},
            {addressee: "Secretary to the President",
             address: ["Honorable (full name)", "Secretary to the President", "The White House",
                        "1600 Pennsylvania Avenue NW", "Washington, DC 20500-0003"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Secretary to the President (with military grade)",
             address: ["(Full grade) (full name)", "Secretary to the President", "The White House",
                        "1600 Pennsylvania Avenue NW", "Washington, DC 20500-0003"],
             salutation: "Dear (grade) (surname):", close: "Sincerely,"},
            {addressee: "The President Elect",
             address: ["The Honorable (full name)", "The President elect", "(Street)", "City, State (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Respectfully, or Respectfully yours,"},
            {addressee: "The Vice President",
             address: ["The Vice President", "The United States Senate", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Madam Vice President:", close: "Sincerely,",
             note: "Addressed as \"President of the Senate\" in submitting proposed legislation and certain reports required by law."},
            {addressee: "The President of the Senate",
             address: ["Honorable (full name)", "President of the Senate", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Madam President:", close: "Sincerely,"},
            {addressee: "Members of the Cabinet addressed as \"Secretary\"",
             address: ["Honorable (full name)", "Secretary of (Department)", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Madam Secretary:", close: "Sincerely,"},
            {addressee: "Postmaster General (head of the USPS)",
             address: ["Honorable (full name)", "Postmaster General", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Madam Postmaster General:", close: "Sincerely,"},
            {addressee: "The Attorney General (head of the U.S. Department of Justice)",
             address: ["The Honorable (full name)", "Attorney General", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Madam Attorney General:", close: "Sincerely,"},
            {addressee: "Under Secretary",
             address: ["Honorable (full name)", "Under Secretary of (Department)", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Assistant Secretary of a Department",
             address: ["Honorable (full name)", "Assistant Secretary of (Department)", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "The Secretary of an Armed Service",
             address: ["The Honorable (full name)", "Secretary of the (Department)", "The Pentagon, (Room Number)",
                        "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Madam Secretary:", close: "Sincerely,"},
            {addressee: "Under Secretary of a Military Department",
             address: ["The Honorable (full name)", "Under Secretary of the (Department)", "The Pentagon, (Room Number)",
                        "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Assistant Secretary of a Military Department",
             address: ["The Honorable (full name)", "Assistant Secretary of the (Department)", "(Street)",
                        "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "General Counsel of a Department",
             address: ["(Mr./Mrs./Ms./Miss) (full name)", "General Counsel (Department)", "(Street)",
                        "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Mrs./Ms./Miss (surname):", close: "Sincerely,"},
            {addressee: "Administrative Assistant to the Secretary",
             address: ["(Mr./Mrs./Ms./Miss) (full name)", "Administrative Assistant to the Secretary of the (Department)",
                        "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Mrs./Ms./Miss (surname):", close: "Sincerely,"},
            {addressee: "Director of Office of Management and Budget",
             address: ["The Honorable (full name)", "Director of Office of Management and Budget", "(Street)",
                        "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Head of a Federal Agency",
             address: ["The Honorable (full name)", "(Title, name of agency)", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Head of a major organization within an agency (if appointed by the President)",
             address: ["Honorable (full name)", "(Title, name of organization) (Name of Agency)", "(Street)",
                        "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "President of the Board",
             address: ["Honorable (full name), President, (name of board)", "(Street)", "Washington, DC (ZIP)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "President of a Commission",
             address: ["Honorable (full name)", "(name of commission)", "(Street)", "Washington, DC (ZIP)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Chairman of Board",
             address: ["Honorable (full name)", "Chairman, (name of board)", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Chairman of a Commission",
             address: ["Honorable (full name)", "Chairman, (name of commission)", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "American Ambassador",
             address: ["The Honorable (full name)", "American Ambassador", "(City)", "(Country)"],
             salutation: "Formal: Sir/Madam. Informal: Dear Madam Ambassador", close: "Very truly yours,"},
            {addressee: "American Ambassador (with military grade)",
             address: ["(Full grade) (full name)", "American Ambassador", "(City)", "(Country)"],
             salutation: "Formal: Sir/Madam. Informal: Dear Mr./Madam Ambassador/Dear (grade, surname):",
             close: "Very truly yours, or Sincerely,"},
            {addressee: "American Minister (with military grade)",
             address: ["(Full grade) (full name)", "American Minister", "(City)", "(Country)"],
             salutation: "Formal: Sir/Madam: Dear Madam Minister:. Informal: Dear (Mr.) Minister:/Dear Mr./Ms. (surname):",
             close: "Very truly yours, or Sincerely,"},
        ],
    },

    /** Table C-2 - The Congress and legislative agencies. */
    congress: {
        cite: "AR 25-50, table C-2",
        note: "Address Members of Congress in the capacity in which they sign their communication - as chairperson, "
            + "as majority or minority leader, or as Senator or Representative, whichever they sign as.",
        entries: [
            {addressee: "President Pro Tempore of the United States Senate",
             address: ["The Honorable (full name)", "President pro Tempore of the Senate", "United States Senate",
                        "(Room Number)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Senator (surname):", close: "Sincerely,"},
            {addressee: "Committee Chairman, United States Senate",
             address: ["The Honorable (full name)", "Chairman, Committee on (name)", "United States Senate",
                        "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr. Chairman/Madam Chairwoman:", close: "Sincerely,"},
            {addressee: "Chairman of a Joint Committee",
             address: ["The Honorable (full name)", "Chairman, Joint Committee on (name)",
                        "Congress of the United States (Room Number)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr. Chairman/Madam Chairman:", close: "Sincerely,"},
            {addressee: "Subcommittee Chairman, United States Senate",
             address: ["The Honorable (full name)", "Chairman, Subcommittee on (name)", "United States Senate",
                        "Washington, DC (ZIP+4)"],
             salutation: "Dear Senator (surname):", close: "Sincerely,"},
            {addressee: "United States Senator (Washington, DC, office)",
             address: ["The Honorable (full name)", "United States Senate", "(Room Number)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Senator (surname):", close: "Sincerely,"},
            {addressee: "Deceased Representative",
             address: ["(Secretary's full name, if known)", "Secretary to the late Honorable (full name)",
                        "United States House of Representatives", "(Room Number)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Resident Commissioner of Puerto Rico",
             address: ["The Honorable (full name)", "United States House of Representatives", "(Room Number)",
                        "Washington, DC (ZIP+4)"],
             salutation: "Dear Representative (surname):", close: "Sincerely,"},
            {addressee: "Librarian of Congress",
             address: ["The Honorable (full name)", "Librarian of Congress", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Comptroller General (head of the Government Accountability Office)",
             address: ["The Honorable (full name)", "Comptroller General of the United States", "(Street)",
                        "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Public Printer (head of the U.S. Government Printing Office)",
             address: ["The Honorable (full name)", "Public Printer", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
        ],
    },

    /** Table C-3 - The Judiciary. */
    judiciary: {
        cite: "AR 25-50, table C-3",
        entries: [
            {addressee: "The Chief Justice of the United States",
             address: ["Chief Justice of the United States", "The Supreme Court", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Madam Chief Justice:", close: "Sincerely,"},
            {addressee: "Associate Justice",
             address: ["Mr./Madam Justice (surname)", "The Supreme Court", "(Street)", "Washington, DC (ZIP+4)"],
             salutation: "Dear Mr./Madam Justice:", close: "Sincerely,"},
            {addressee: "Retired Justice",
             address: ["The Honorable (full name)", "(Local address)"],
             salutation: "Dear Mr./Madam Justice:", close: "Sincerely,"},
            {addressee: "Presiding Justice",
             address: ["The Honorable (full name)", "Presiding Justice:", "(Name of Court)", "(Local address)"],
             salutation: "Dear Mr./Madam Justice:", close: "Sincerely,"},
            {addressee: "Judge of a Court",
             address: ["The Honorable (full name)",
                        "Justice of the (Name of court, if a U.S. District Court, give district)", "(Local address)"],
             salutation: "Dear Mr./Madam Justice:", close: "Sincerely,"},
            {addressee: "Clerk of a Court",
             address: ["Mr./Madam (full name)",
                        "Clerk of the (name of court; if a U.S. District Court, give district)", "(Local address)"],
             salutation: "Dear Mr./Madam (surname):", close: "Sincerely,"},
        ],
    },

    /**
     * Table C-4 - Military Personnel.
     *
     * Every row follows the same address form and close - "(full rank) (full
     * name), (Service abbreviation)" over "(Address)", then "Sincerely," -
     * and differs only in the salutation title, which collapses several grades
     * to one word ("General" covers GEN through BG; "Sergeant" covers MSG
     * through SGT). Storing fifty near-identical rows would not add
     * information a reader could not get from the one row and a lookup; this
     * stores the lookup, keyed by the same grade abbreviations table 6-1
     * already uses for the Army column, so the two chapters cannot drift
     * apart without a check catching it (see verify.js).
     *
     * Warrant officers take a courtesy title and the surname, not a rank word
     * - "Dear Mr./Miss/Ms./Mrs. (last name):" - because appendix C gives them
     * none.
     */
    militaryPersonnel: {
        cite: "AR 25-50, table C-4",
        addressForm: "(full rank) (full name), (Service abbreviation)",
        close: "Sincerely,",
        warrantOfficerSalutation: "Dear Mr./Miss/Ms./Mrs. (last name):",
        bySer: {
            army: {
                GEN: "General", LTG: "General", MG: "General", BG: "General",
                COL: "Colonel", LTC: "Colonel", MAJ: "Major", CPT: "Captain",
                "1LT": "Lieutenant", "2LT": "Lieutenant",
                CW5: null, CW4: null, CW3: null, CW2: null, WO1: null,   // courtesy title
                SMA: "Sergeant Major", CSM: "Sergeant Major", SGM: "Sergeant Major",
                "1SG": "First Sergeant", MSG: "Sergeant", SFC: "Sergeant", SSG: "Sergeant",
                SGT: "Sergeant", CPL: "Corporal", SPC: "Specialist",
                PFC: "Private", PV2: "Private", PV1: "Private",
            },
            marineCorps: {
                Gen: "General", LtGen: "General", MajGen: "General", BGen: "General",
                Col: "Colonel", LtCol: "Colonel", Maj: "Major", Capt: "Captain",
                "1stLt": "Lieutenant", "2ndLt": "Lieutenant",
                CWO: null, WO: null,
                SgtMajMC: "Sergeant Major", SgtMaj: "Sergeant Major",
                MGySgt: "Master Gunnery Sergeant", "1stSgt": "First Sergeant",
                MSgt: "Master Sergeant", GySgt: "Gunnery Sergeant", SSgt: "Staff Sergeant",
                Sgt: "Sergeant", Cpl: "Corporal", LCpl: "Corporal",
                PFC: "Private First Class", Pvt: "Private",
            },
            navy: {
                ADM: "Admiral", VADM: "Admiral", RADM: "Admiral",
                CAPT: "Captain", CDR: "Commander", LCDR: "Commander",
                LT: "Lieutenant", LTJG: "Lieutenant", ENS: "Ensign",
                CWO: null, WO: null,
                MCPON: "Master Chief", MCPO: "Master Chief", SCPO: "Senior Chief", CPO: "Chief",
                PO1: "Petty Officer", PO2: "Petty Officer", PO3: "Petty Officer",
                // These four are the rating's own title, not a rank word - fig C-4.
                Airman: "Airman", Constructionman: "Constructionman", Dentalman: "Dentalman",
                Fireman: "Fireman", HospitalCorpsman: "Hospital Corpsman", Seaman: "Seaman",
            },
            airForce: {
                Gen: "General", LtGen: "General", MajGen: "General", BrigGen: "General",
                Col: "Colonel", LtCol: "Colonel", Maj: "Major", Capt: "Captain",
                "1stLt": "Lieutenant", "2ndLt": "Lieutenant",
                CWO: null, WO: null,
                CMSAF: "Chief", CMSgt: "Chief", SMSgt: "Sergeant", MSgt: "Sergeant",
                TSgt: "Sergeant", SSgt: "Sergeant",
                SrA: "Airman", A1C: "Airman", Amn: "Airman", AB: "Airman",
            },
        },
        additional: [
            {addressee: "All retired military personnel",
             address: ["(rank) (full name), (Service abbreviation) (Ret)", "(Address)"],
             salutation: "Dear (rank) (last name):", close: "Sincerely,"},
            {addressee: "Cadet", address: ["Cadet (full name)", "(Address)"],
             salutation: "Dear Cadet (last name):", close: "Sincerely,"},
            {addressee: "Midshipman", address: ["Midshipman (full name)", "(Address)"],
             salutation: "Dear Midshipman (last name):", close: "Sincerely,"},
            {addressee: "Air Cadet", address: ["Air Cadet (full name)", "(Address)"],
             salutation: "Dear Air Cadet (last name):", close: "Sincerely,"},
        ],
    },

    /** Table C-5 - State and Government Officials. */
    stateAndGovernment: {
        cite: "AR 25-50, table C-5",
        note: "In most States the lower legislative branch is the House of Representatives; in some (California, New York) "
            + "the Assembly; in others (Maryland, Virginia, West Virginia) the House of Delegates.",
        entries: [
            {addressee: "Governor of a State",
             address: ["The Honorable (full name) Governor of (State)", "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Governor (surname):", close: "Sincerely,"},
            {addressee: "Acting Governor of State",
             address: ["The Honorable (full name) Acting Governor of (State)", "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Lieutenant Governor of State",
             address: ["The Honorable (full name) Lieutenant Governor of (State)", "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Secretary of State of a State",
             address: ["The Honorable (full name) Secretary of State of (State)", "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Mr./Madam Secretary:", close: "Sincerely,"},
            {addressee: "Chief Justice of the Supreme Court of a State",
             address: ["The Honorable (full name)", "Chief Justice Supreme Court of the State of (State)",
                        "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Mr./Madam Chief Justice:", close: "Sincerely,"},
            {addressee: "Attorney General of a State",
             address: ["The Honorable (full name) Attorney General", "State of (State)", "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Mr./Madam Attorney General:", close: "Sincerely,"},
            {addressee: "Judge",
             address: ["The Honorable (full name) (Local)", "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Judge (surname):", close: "Sincerely,"},
            {addressee: "Treasurer, Auditor, or Comptroller of a State",
             address: ["The Honorable (full name) State Treasurer (Auditor) (Comptroller)", "State of (State)",
                        "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "President of the Senate of a State",
             address: ["The Honorable (full name)", "President of the Senate of the State of (State)",
                        "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Speaker of the Assembly/House of Delegates/House of Representatives of a State",
             address: ["The Honorable (full name)", "Speaker of the House of Representatives of the State of (name)",
                        "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "State Senator",
             address: ["The Honorable (full name) (Name of State) Senate", "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Senator (surname):", close: "Sincerely,"},
            {addressee: "State Representative, Assemblyman, or Delegate",
             address: ["The Honorable (full name) (Name of State) House of Representatives", "(Street)",
                        "(City, State ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Mayor",
             address: ["The Honorable (full name) Mayor of (city)", "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Mayor (surname):", close: "Sincerely,"},
            {addressee: "President of a Board of Commissioners",
             address: ["The Honorable (full name)", "President, Board of Commissioners of (city)",
                        "(Street)", "(City, State ZIP+4)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
        ],
    },

    /** Table C-6 - Ecclesiastical officials. */
    ecclesiastical: {
        cite: "AR 25-50, table C-6",
        entries: [
            {addressee: "Protestant Minister, Pastor, or Rector (without scholastic degree)",
             address: ["The Reverend (full name)", "(Title, name of church)", "(Local address)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Rabbi (with scholastic degree)",
             address: ["Rabbi (full name, initials of degree)", "(Local address)"],
             salutation: "Dear Dr. (surname): or Dear Rabbi (surname):", close: "Sincerely,"},
            {addressee: "Rabbi (without scholastic degree)",
             address: ["Rabbi (full name)", "(Local address)"],
             salutation: "Dear Rabbi (surname):", close: "Sincerely,"},
            {addressee: "The Pope", address: ["His Holiness The Pope", "(Address)"],
             salutation: "Most Holy Father or Your Holiness", close: "Sincerely,"},
            {addressee: "Catholic Cardinal",
             address: ["His Eminence (Christian name)", "Cardinal (surname) Archbishop of (Diocese)", "(Local address)"],
             salutation: "Your Eminence:", close: "Sincerely,"},
            {addressee: "Catholic Archbishop",
             address: ["The Most Reverend (full name)", "Bishop of (diocese)", "(Local address)"],
             salutation: "Your Excellency:", close: "Sincerely,"},
            {addressee: "Catholic Bishop",
             address: ["The Most Reverend (full name)", "Bishop of (city)", "(Local address)"],
             salutation: "Your Excellency:", close: "Sincerely,"},
            {addressee: "Catholic Monsignor",
             address: ["The Very Reverend Monsignor (full name)", "(Local address)"],
             salutation: "Formal: Very Reverend Monsignor:. Informal: Dear Monsignor (surname):", close: "Sincerely,"},
            {addressee: "Catholic Priest",
             address: ["The Reverend (full name) (add designated letters)", "(Local address)"],
             salutation: "Formal: Reverend:. Informal: Dear Father (surname):", close: "Sincerely,"},
            {addressee: "Mother Superior of an Institution",
             address: ["Mother (name, initials, or order, if used) Superior", "(name of institution)", "(Local address)"],
             salutation: "Dear Mother (name):", close: "Sincerely,"},
            {addressee: "Bishop, Church of Jesus Christ of Latter Day Saints",
             address: ["Bishop (full name)", "Church of Jesus Christ of Latter Day Saints", "(Local address)"],
             salutation: "Formal: Sir:. Informal: Dear Mr. (surname):", close: "Sincerely,"},
            {addressee: "Orthodox Metropolitan",
             address: ["The Most Blessed (Christian name)", "Archbishop of (city)", "Metropolitan of (province)",
                        "(Local address)"],
             salutation: "Formal: Your Beatitude:/Dear Metropolitan:. Informal: (Christian name):", close: "Sincerely,"},
            {addressee: "Orthodox Archbishop",
             address: ["The Most Reverend (Christian name)", "Archbishop of (city or province)", "(Local address)"],
             salutation: "Formal: Your Eminence:/Dear Archbishop:. Informal: (Christian name):", close: "Sincerely,"},
            {addressee: "Orthodox Bishop",
             address: ["The Right Reverend (Christian name)", "Bishop of (city)", "(Local address)"],
             salutation: "Formal: Your Grace:/Dear Bishop:. Informal: (Christian name):", close: "Sincerely,"},
            {addressee: "Orthodox Protopresbyter",
             address: ["The Right Reverend (name)", "(Local address)"],
             salutation: "Formal: Right Reverend Father:. Informal: Dear Father (Christian name):", close: "Sincerely,"},
            {addressee: "Orthodox Archpriest",
             address: ["The Very Reverend (name)", "(Local address)"],
             salutation: "Formal: Very Reverend Father:. Informal: Dear Father (Christian name):", close: "Sincerely,"},
            {addressee: "Orthodox Priest",
             address: ["The Reverend (name)", "(Local address)"],
             salutation: "Formal: Reverend Father:. Informal: Dear Father (Christian name):", close: "Sincerely,"},
            {addressee: "Orthodox Deacon",
             address: ["Father Deacon (name)", "(Local address)"],
             salutation: "Formal: Father Deacon:/Dear Father Deacon:. Informal: (Christian name):", close: "Sincerely,"},
            {addressee: "Orthodox Nun", address: ["Sister (Christian name)", "(Name of monastery)", "(Local address)"],
             salutation: "Dear Sister (Christian name):", close: "Sincerely,"},
            {addressee: "Orthodox Monk", address: ["Brother (Christian name)", "(Name of monastery)", "(Local address)"],
             salutation: "Dear Brother (Christian name):", close: "Sincerely,"},
            {addressee: "Protestant Episcopal Bishop",
             address: ["The Right Reverend (full name)", "Bishop of (name)", "(Local address)"],
             salutation: "Formal: Dear Reverend Sir:. Informal: Dear Bishop (surname):", close: "Sincerely,"},
            {addressee: "Protestant Episcopal Dean",
             address: ["The Very Reverend (full name)", "Dean of (church)", "(Local address)"],
             salutation: "Formal: Very Reverend Sir:. Informal: Dear Dean (surname):", close: "Sincerely,"},
            {addressee: "Methodist Bishop",
             address: ["The Reverend (full name)", "Methodist Bishop", "(Local address)"],
             salutation: "Formal: Reverend Sir:. Informal: My Dear Bishop (surname):", close: "Sincerely,"},
            {addressee: "Chaplain",
             address: ["Chaplain (grade) (full name)", "(Post office address of organization and station)"],
             salutation: "Dear Chaplain (surname):", close: "Sincerely,"},
        ],
    },

    /** Table C-7 - Private citizens. */
    privateCitizens: {
        cite: "AR 25-50, table C-7",
        entries: [
            {addressee: "President of a university or college (with scholastic degree)",
             address: ["(Full name, initials of degree)", "President, (name of institution)", "(Local address)"],
             salutation: "Dear Dr. (surname):", close: "Sincerely,"},
            {addressee: "President of a university or college (without scholastic degree)",
             address: ["Mr./Ms. (full name)", "President, (name of institution)", "(Local address)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "Dean of a school (with scholastic degree)",
             address: ["(Full name, initials of degree)", "Dean, School of (name)", "(Name of institution)",
                        "(Local address)"],
             salutation: "Dear Dr. (surname):", close: "Sincerely,"},
            {addressee: "Dean of a school (without scholastic degree)",
             address: ["Dean (full name)", "School of (name)", "(Name of institution)", "(Local address)"],
             salutation: "Dear Dean (surname):", close: "Sincerely,"},
            {addressee: "Professor (with scholastic degree)",
             address: ["(Full name, initials of degree)", "Department of (name)", "(Name of institution)",
                        "(Local address)"],
             salutation: "Dear Professor (surname): or Dear Dr. (surname):", close: "Sincerely,"},
            {addressee: "Professor (without scholastic degree)",
             address: ["Professor (full name)", "Department of (name) (Name of institution)", "(Local address)"],
             salutation: "Dear Professor (surname):", close: "Sincerely,"},
            {addressee: "Physician",
             address: ["(Full name), M.D.", "(Local address)"],
             salutation: "Dear Dr. (surname):", close: "Sincerely,"},
            {addressee: "Lawyer",
             address: ["Mr./Ms. (full name)", "Attorney at Law", "(Local address)"],
             salutation: "Dear Mr./Ms. (full name):", close: "Sincerely,"},
            {addressee: "Private individuals",
             address: ["Mr./Ms. (full name)", "(Local address)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
        ],
    },

    /** Table C-8 - Corporations, companies, and federations. */
    corporationsAndFederations: {
        cite: "AR 25-50, table C-8",
        entries: [
            {addressee: "To a company or corporation",
             address: ["(Name of company or corporation)", "(Local address)"],
             salutation: "Gentlemen: (Ladies and Gentlemen)", close: "Sincerely,"},
            {addressee: "To a federation",
             address: ["(Name of official)", "(Title, name of federation)", "(Local address)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "President of a company or corporation (or other official)",
             address: ["Mr./Ms. (full name)", "President (or other title)", "Company", "(Local address)"],
             salutation: "Dear Mr./Ms. (surname):", close: "Sincerely,"},
            {addressee: "To an individual, company, corporation, or federation when the name is not known",
             address: ["(Title of individual) (Name of organization)", "(Local address)"],
             salutation: "Dear Sir/Madam:", close: "Sincerely,"},
        ],
    },

    /** Table C-9 - Foreign government officials. */
    foreignGovernmentOfficials: {
        cite: "AR 25-50, table C-9",
        note: "Address foreign officials by title if the name of the official is not given in the correspondence "
            + "or is not readily available.",
        entries: [
            {addressee: "Foreign Ambassador in the United States",
             address: ["His/Her Excellency (full name)", "Ambassador of (country)", "(local address)"],
             salutation: "Formal: Excellency:. Informal: Dear Mr./Madam Ambassador:",
             close: "Very truly yours, or Sincerely,"},
            {addressee: "Foreign Minister in the United States",
             address: ["Honorable (full name)", "Minister of (country)", "(local address)"],
             salutation: "Formal: Sir/Madam:. Informal: Dear Mr./Madam Minister:",
             close: "Very truly yours, or Sincerely,"},
        ],
    },

    /** Table C-10 - International organizations. */
    internationalOrganizations: {
        cite: "AR 25-50, table C-10",
        entries: [
            {addressee: "Secretary General of the United Nations",
             address: ["His/Her Excellency (full name)", "Secretary General of the United Nations", "(Street)",
                        "New York, NY (ZIP)"],
             salutation: "Formal: Excellency:. Informal: Dear Mr./Madam Secretary General:/Dear Mr./Ms. (surname):",
             close: "Very truly yours, or Sincerely,"},
            {addressee: "Chairman, United States Delegation to the United Nations Military Staff Committee",
             address: ["The Chairman", "United States Delegation", "United Nations Military Staff Committee",
                        "United States Mission to the United Nations", "(Street)", "New York, NY (ZIP)"],
             salutation: "Formal: Sir/Madam:. Informal: Dear Mr./Ms. (surname):", close: "Very truly yours, or Sincerely,"},
            {addressee: "Senior Military Advisor to the United States Delegation to the UN General Assembly",
             address: ["(Grade) (full name)", "Senior Military Adviser",
                        "United States Delegation to the United Nations General Assembly", "(Street)",
                        "New York, NY (ZIP)"],
             salutation: "Informal: Dear (grade) (surname):", close: "Sincerely,"},
            {addressee: "United States Representative on the Economic and Social Council",
             address: ["The Honorable (full name)", "United States Representative on the Economic and Social Council",
                        "(Street)", "New York, NY (ZIP)"],
             salutation: "Formal: Sir/Madam:. Informal: Dear Mr./Ms. (surname):", close: "Very truly yours, or Sincerely,"},
            {addressee: "United States Representative on the Disarmament Commission",
             address: ["The Honorable (full name)", "United States Representative on the Disarmament Commission",
                        "(Street)", "New York, NY (ZIP)"],
             salutation: "Formal: Sir/Madam:. Informal: Dear Mr./Ms. (surname):", close: "Very truly yours, or Sincerely,"},
            {addressee: "United States Representative on the Trusteeship Council",
             address: ["The Honorable (full name)", "United States Representative on the Trusteeship Council",
                        "(Street)", "New York, NY (ZIP)"],
             salutation: "Formal: Sir/Madam:. Informal: Dear Mr./Ms. (surname):", close: "Very truly yours, or Sincerely,"},
            {addressee: "Senior Representative of the United States to the UN General Assembly",
             address: ["The Honorable (full name)",
                        "Senior Representative of the United States to the General Assembly of the United Nations",
                        "(Street)", "New York, NY (ZIP)"],
             salutation: "Formal: Sir/Madam:. Informal: Dear Mr./Ms. (surname):", close: "Very truly yours, or Sincerely,"},
            {addressee: "Secretary General of the Organization of American States",
             address: ["His/Her Excellency (full name)", "Secretary General of the Organization of American States",
                        "Pan American Union (Street)", "Washington, DC (ZIP)"],
             salutation: "Formal: Excellency:/Dear Mr./Madam Secretary General:. Informal: Dear Mr./Ms./Dr. (surname):",
             close: "Very truly yours, or Sincerely,"},
            {addressee: "Assistant Secretary General of the Organization of American States",
             address: ["The Honorable (full name)",
                        "Assistant Secretary General of the Organization of American States", "Pan American Union",
                        "(Street)", "Washington, DC (ZIP)"],
             salutation: "Formal: Sir/Madam:. Informal: Dear Mr./Ms./Dr. (surname):", close: "Very truly yours, or Sincerely,"},
            {addressee: "United States Representative on the Council of the Organization of American States",
             address: ["The Honorable (full name)",
                        "United States Representative on the Council of the Organization of American States",
                        "Department of State", "(Street)", "Washington, DC (ZIP)"],
             salutation: "Formal: Sir/Madam:. Informal: Dear Mr./Ms./Dr. (surname):", close: "Very truly yours, or Sincerely,"},
        ],
    },

    /**
     * Table C-11 - Additional former official.
     *
     *   "Address former presidents, vice presidents, justices of the Supreme
     *    Court, cabinet officers, Service secretaries, and governors as
     *    indicated in this table. Address other former Federal officials and
     *    former State, local, and foreign government officials who once held
     *    positions of distinction ... by the titles of their former positions
     *    when the former official indicates ... that he or she still uses the
     *    title ... Otherwise, treat the addressee as a private citizen."
     */
    formerOfficials: {
        cite: "AR 25-50, table C-11",
        entries: [
            {addressee: "Former President", address: ["The Honorable (full name)", "(Local address)"],
             salutation: "Dear Mr./Madam (surname):", close: "Respectfully,"},
            {addressee: "Former Vice President", address: ["The Honorable (full name)", "(Local address)"],
             salutation: "Dear Mr./Madam (surname):", close: "Sincerely,"},
            {addressee: "Former Member of the Cabinet addressed as \"Secretary\"",
             address: ["The Honorable (full name)", "(Local address)"],
             salutation: "Dear Mr./Madam Secretary:", close: "Sincerely,"},
            {addressee: "Former Postmaster General", address: ["The Honorable (full name)", "(Local address)"],
             salutation: "Dear Mr./Madam Postmaster General:", close: "Sincerely,"},
            {addressee: "Former Attorney General", address: ["The Honorable (full name)", "(Local address)"],
             salutation: "Dear Mr./Madam Attorney General:", close: "Sincerely,"},
            {addressee: "Former \"Secretary\" of military department",
             address: ["The Honorable (full name)", "(Local address)"],
             salutation: "Dear Mr./Madam (surname):", close: "Sincerely,"},
            {addressee: "Former Senator", address: ["The Honorable (full name)", "(Local address)"],
             salutation: "Dear Senator (surname):", close: "Sincerely,"},
            {addressee: "Former Representative", address: ["The Honorable (full name)", "(Local address)"],
             salutation: "Dear Mr./Madam (surname):", close: "Sincerely,"},
            {addressee: "Former Justice", address: ["The Honorable (full name)", "(Local address)"],
             salutation: "Dear Mr./Madam Justice:", close: "Sincerely,"},
            {addressee: "Former Judge", address: ["The Honorable (full name)", "(Local address)"],
             salutation: "Dear Judge (surname):", close: "Sincerely,"},
            {addressee: "Former Governor of State", address: ["The Honorable (full name)", "(Local address)"],
             salutation: "Dear Governor (surname):", close: "Sincerely,"},
        ],
        note: "Address other former officials by the title of their former position only when they still use it, "
            + "or the action official knows they once held a distinctive position; otherwise treat them as a "
            + "private citizen.",
    },
};

/**
 * Look up an addressee category across every table in appendix C, by its
 * printed heading. Returns the entry plus which table it came from, or null.
 * Case-insensitive and tolerant of the parenthetical qualifiers the tables use
 * ("(with scholastic degree)" and the like), because a caller names the role,
 * not the footnote.
 */
export function lookupAddressForm(addressee) {
    const needle = String(addressee ?? "").trim().toLowerCase();
    if (!needle) return null;

    for (const [table, section] of Object.entries(APPENDIX_C)) {
        if (!section?.entries) continue;
        const hit = section.entries.find((e) => e.addressee.toLowerCase() === needle)
            ?? section.entries.find((e) => e.addressee.toLowerCase().startsWith(needle));
        if (hit) return {table, cite: section.cite, ...hit};
    }
    for (const hit of APPENDIX_C.militaryPersonnel.additional) {
        if (hit.addressee.toLowerCase() === needle) {
            return {table: "militaryPersonnel", cite: APPENDIX_C.militaryPersonnel.cite, ...hit};
        }
    }
    return null;
}

/**
 * A military salutation title from table C-4: the service and the grade
 * abbreviation in, "Dear (title) (surname):" out - or the warrant officers'
 * courtesy-title form, which the table gives with no rank word at all.
 */
export function militarySalutation(service, grade) {
    const M = APPENDIX_C.militaryPersonnel;
    const title = M.bySer[service]?.[grade];
    if (title === undefined) return null;
    return title === null
        ? M.warrantOfficerSalutation
        : `Dear ${title} (surname):`;
}
export const PERSONAL_ADDRESS_CITE = "AR 25-50, paras 2-2 and 2-4a(5)";

/**
 * Two figure notes suppress the geographic address entirely, and both turn on
 * a fact about the sender that no addressee string reveals:
 *
 *   fig 2-5 note 4  "When preparing a memorandum from one Army staff agency to
 *                    another Army staff agency, omit the full geographic
 *                    location."
 *   fig 2-7 note 4  "Omit the geographical address when preparing internal
 *                    ACOM headquarters memorandums."
 *
 * Set `internalTo` on the memorandum to say which case applies. The default is
 * neither, because the opposite rule - fig 2-6 note 3 - requires "the complete
 * geographical location (including complete standard street address, city,
 * state, and ZIP+4 code)" for the office-symbol method.
 */
export const INTERNAL_CORRESPONDENCE = {
    armyStaff: {
        description: "one Army staff agency to another Army staff agency",
        cite: "AR 25-50, fig 2-5 note 4",
    },
    acomHeadquarters: {
        description: "internal ACOM headquarters memorandums",
        cite: "AR 25-50, fig 2-7 note 4",
    },
};

/** Whether an addressee string carries a geographic address. */
export function hasGeographicAddress(addressee) {
    const text = String(typeof addressee === "string" ? addressee : (addressee?.text ?? ""));
    // A street line or a state-and-ZIP pair. Either is the geographic location
    // the two figure notes suppress.
    return ZIP.pattern.test(text)
        || /\b\d{2,5}\s+[A-Za-z].*\b(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Pentagon|Loop|Circle|Way)\b/i.test(text);
}

/**
 * Figure 2-8's distribution listing opens with a single line -
 * "Principal Officials of Headquarters, Department of the Army" - rather than
 * naming them one by one, and para B-2 makes that a term of art: it "includes
 * all the positions listed in figure B-2", all 36 of them.
 *
 * This matters beyond tidiness. Listing them individually blows through the
 * five-address limit of para 2-4a(5)(c) and forces a SEE DISTRIBUTION format
 * that figure 2-8 shows is unnecessary.
 */
export const HQDA_PRINCIPALS_COLLECTIVE = {
    text: "Principal Officials of Headquarters, Department of the Army",
    cite: "AR 25-50, fig 2-8 and para B-2",
};

/** How many of the given addressees are HQDA principal officials. */
export function countHqdaPrincipals(addressees = []) {
    return addressees.filter((a) => {
        const text = String(typeof a === "string" ? a : (a?.text ?? "")).toUpperCase();
        return PROTOCOL_HQDA.some((p) => text.includes(p.toUpperCase()));
    }).length;
}

/**
 * Appendix F - the digital signature.
 *
 * Everything appendix F describes is an Acrobat form field, created in the PDF
 * *after* the Word file exists: "a. Create document in MS Word. b. Create a
 * Portable Document Format (PDF) version of the Word document", and every step
 * from F-2c on is Acrobat. AR 25-50 prescribes no Word-native artifact for a
 * digital signature at all.
 *
 * So a .docx cannot be signature-ready, and this module does not pretend
 * otherwise. What it can do is leave the page correct for the Acrobat step and
 * say what that step is. The two placement rules are quotable:
 *
 *   date box      "at the top of the document, across from the office symbol
 *                  on the same line [...] Align the right edge of the date text
 *                  box with the right margin", alignment "Right" - F-2e
 *   signature box "directly above and left-aligned with the signer's name"
 *                  - F-2f
 *
 * No dimension and no font are specified anywhere in the appendix - "place and
 * size the box to allow room for 'dd month yyyy' format", "in whatever font
 * that was selected". Any figure this module invented would be its own, so it
 * invents none.
 */
export const APPENDIX_F = {
    cite: "AR 25-50, appendix F",
    dateBox: {
        placement: "Top of the document, on the office symbol line, right edge aligned with the right margin.",
        alignment: "Right",
        sizing: "Sized only to allow room for \"dd month yyyy\". No dimension is specified.",
        cite: "AR 25-50, para F-2e",
    },
    signatureBox: {
        placement: "Directly above and left-aligned with the signer's name.",
        cite: "AR 25-50, para F-2f",
    },
    // "THRU memorandums require placement of a digital signature box at the end
    //  of each addressee line. Directly to the left of the digital signature
    //  box, place a text box for short comments by each THRU addressee." - F-2i
    thru: {
        perAddressee: "A digital signature box at the end of each THRU addressee line, with a comment text box directly to its left.",
        cite: "AR 25-50, paras F-2i and 2-4a(5)(d)",
    },
    // "For a memorandum with more than one signature, place digital signature
    //  boxes for all signers." - F-2h
    multipleSigners: {
        rule: "One signature box per signer. The date box carries the date of the last signature and stays blank until the final official signs.",
        cite: "AR 25-50, para F-2h",
    },
    readOnly: "Mark each signature box \"Mark as read-only\" for its date and comment boxes, or their text stays editable after signature. Otherwise print the document as an Adobe .pdf to lock it.",
    readOnlyCite: "AR 25-50, para F-2 (Note)",
};

/**
 * "Place the date on the same line as the office symbol flush with the right
 *  margin after the memorandum has been signed." - para 2-4a(3)(b)
 */
export const DATE_AFTER_SIGNATURE_CITE = "AR 25-50, para 2-4a(3)(b)";

/**
 * The abbreviated memorandum for record, from note 7 of figure 2-17:
 *
 *   "Use an abbreviated form when MFRs are placed on the bottom of a piece of
 *    existing correspondence. Begin typing two lines below the last line of the
 *    preceding correspondence and abbreviate MEMORANDUM FOR RECORD by typing
 *    the acronym MFR. Omit the office symbol and subject line. Begin typing the
 *    text two lines below MFR."
 *
 * It is the one memorandum in chapter 2 with no office symbol and no subject
 * line, and the only place the acronym MFR is authorized in the document
 * itself rather than in prose about it. Nothing above it belongs to this
 * memorandum - it is written on somebody else's page - so the renderer starts
 * at the top of its own block and the two-line gap is the drafter's to leave.
 */
export const MFR_ABBREVIATED = {
    keyword: "MFR",
    linesBelowPrecedingCorrespondence: 2,
    keywordToText: {linesBelow: 2, cite: "AR 25-50, fig 2-17 note 7"},
    omits: ["officeSymbol", "subject"],
    cite: "AR 25-50, fig 2-17 note 7",
};

/**
 * Chapter 3 defines a second vehicle - the letter - and para 3-2 assigns it a
 * fixed audience:
 *
 *   "The letter is used for correspondence addressed to the President or Vice
 *    President of the United States, members of the White House staff, Members
 *    of Congress, Justices of the Supreme Court, heads of departments and
 *    agencies, State Governors, mayors, foreign government officials, and the
 *    public."
 *
 * This module builds memorandums, not letters, and a letter is a different
 * document in every part: centered civilian date, inside address, salutation,
 * indented unnumbered paragraphs, complimentary close, no authority line, page
 * numbers at the top. Producing a memorandum for one of these addressees is
 * therefore not a formatting error to be corrected - it is the wrong vehicle,
 * and the only honest response is to say so rather than format it anyway.
 */
/**
 * The letter - chapter 3.
 *
 * The letter is not a memorandum with different words. It is the other
 * correspondence vehicle in the regulation and it differs in almost every
 * structural respect: the date is written in civilian style and centred, the
 * address sits in the body of the page rather than after a keyword, paragraphs
 * are indented and unnumbered, the closing is a complimentary close rather than
 * an authority line, and the signature block is mixed case with the component
 * rather than the branch. Para 3-2 fixes its audience (LETTER_AUDIENCES).
 *
 * Every measurement here is either stated in chapter 3 or measured off figure
 * 3-1, rasterised at 150 px/in and calibrated on the seal - the same 0.95 in
 * square 0.52 in from the corner that calibrates the memorandum figures. The
 * calibration puts figure 3-1's left margin at 1.00 in, which is a value the
 * regulation states, so it checks out.
 */
export const LETTER = {
    // "Use the standard paper size for a letter (8 1/2 by 11 inches)" and
    // "Allow left and right margins of 1 inch. Do not justify right margins."
    // - paras 3-5a and 3-5c. Same page and margins as a memorandum.
    paperCite: "AR 25-50, paras 3-5a and 3-5c",

    // "Use computer-generated letterhead for the first page and plain white
    //  paper for all continuing pages." - para 3-5b
    letterheadCite: "AR 25-50, para 3-5b",

    // "Record numbers are not used on letters." - para 3-5d
    noRecordNumber: true,
    noRecordNumberCite: "AR 25-50, para 3-5d",

    // "Express the date in civilian style (for example, January 3, 2020)
    //  centered two lines below the last line of the letterhead." - 3-6a(1).
    // Measured: figure 3-1's date centres at 4.29 in on an 8.5 in page, and
    // sits 1.96 lines below the last letterhead line.
    dateCentred: true,
    letterheadToDate: {linesBelow: 2, cite: "AR 25-50, para 3-6a(1)"},

    /*
     * Where a letter's body begins: the bottom of the letterhead block.
     *
     * A memorandum's body starts at LETTERHEAD.officeSymbolTopIn, which is a
     * measured position with a deliberate gap above it. A letter has no such
     * gap - its date is two lines below the letterhead and nothing else, so the
     * body starts where the letterhead stops and the one blank line of
     * `letterheadToDate` puts the date on the second line.
     *
     * Derived from the letterhead's own metrics rather than measured, because
     * unlike the office symbol this *is* a relationship: whatever height the
     * organization block turns out to be, the date follows it.
     */
    get bodyTopIn() {
        const line = (pt) => pt * 1.15 / 72;    // single spacing
        return LETTERHEAD.letterheadTopIn
            + line(LETTERHEAD.titleSizePt)
            + 3 * line(LETTERHEAD.addressSizePt);
    },
    bodyTopCite: "AR 25-50, para 3-6a(1) and fig 3-1",

    // "Type the subject (if used) on the fourth line below the seal." - 3-6a(2)
    subjectLinesBelowSeal: 4,
    subjectCite: "AR 25-50, para 3-6a(2) and fig 3-4",

    /*
     * "Evenly space the letter on the page. No set number of lines is required
     * between the seal and the address." - 3-6a(3)(b). Figure 3-1 gives the
     * working rule in its own words: "The general rule is five lines when the
     * letter is two or more pages", and measures at 4.99 lines below the date.
     * So this is a default to be centred on, not a fixed offset.
     */
    dateToAddress: {linesBelow: 5, cite: "AR 25-50, fig 3-1"},
    evenlySpaced: true,
    evenlySpacedCite: "AR 25-50, para 3-6a(3)(b)",

    // "Type the salutation on the second line below the last line of the
    //  address." - 3-6a(4). Measured at 2.02 lines.
    addressToSalutation: {linesBelow: 2, cite: "AR 25-50, para 3-6a(4)"},

    // "Type the first line of the body of the letter on the second line below
    //  the salutation." - 3-6b(1). Measured at 1.99 lines.
    salutationToText: {linesBelow: 2, cite: "AR 25-50, para 3-6b(1)"},

    /*
     * "Indent paragraphs 1/4 inch. Do not number or letter paragraphs." -
     * fig 3-1 and para 3-6b(5). This is the letter's largest departure from the
     * memorandum, which numbers every paragraph and indents none.
     *
     * Measured on figure 3-1: first lines at 0.243-0.249 in from the margin,
     * continuation lines at 0.995 - flush to the left margin, as in a
     * memorandum.
     */
    paragraphIndentIn: 0.25,
    numberParagraphs: false,
    indentCite: "AR 25-50, fig 3-1 and para 3-6b(5)",

    /*
     * "When more than one subparagraph is needed, use letters of the alphabet
     * (a, b, c, d)... Do not create more than four subparagraphs. If only one
     * subparagraph is needed, use a hyphen." - 3-6b(5)
     *
     * Measured: "a." and "b." at 0.245 in, the hyphen at 0.242 with its text at
     * 0.496 - so the mark sits at the paragraph indent and a lone hyphen's text
     * at a half inch.
     */
    subparagraphIndentIn: 0.25,
    subparagraphLabels: ["a.", "b.", "c.", "d."],
    maxSubparagraphs: 4,
    singleSubparagraphMark: "-",
    singleSubparagraphTextIn: 0.5,
    subparagraphCite: "AR 25-50, para 3-6b(5) and fig 3-1",

    // "Use single spacing even when a letter contains only one paragraph. For
    //  effective paragraphs, do not use more than 7 lines." - 3-6b(5)
    maxLinesPerParagraph: 7,
    paragraphLengthCite: "AR 25-50, para 3-6b(5)",

    /*
     * The closing. "Start the closing on the second line below the last line of
     * the letter. Begin at the center of the page." - 3-6c(1), and "Type the
     * signature block on the fifth line below the closing, beginning at the
     * center of the page." - 3-6c(2)(a). Measured at 4.32 in from the page
     * edge, the same column the memorandum's signature block uses.
     */
    textToClose: {linesBelow: 2, cite: "AR 25-50, para 3-6c(1)"},
    closeToSignature: {linesBelow: 5, cite: "AR 25-50, para 3-6c(2)(a)"},
    complimentaryClose: "Sincerely,",
    closeCite: "AR 25-50, para 3-6c(1) and fig 3-1",

    /*
     * "Type the signature block in uppercase and lowercase letters." - 3-6c(2)(c).
     * A memorandum's is in capitals (para 6-4c); a letter's is not.
     *
     * "Military personnel will use 'U.S. Army' following their grade. Branch
     * designations and 'General Staff' have no meaning to the general public."
     * - fig 3-1 continued. And para 3-4: "Military personnel will use their
     * full grades (for example, lieutenant general, major general, captain, and
     * sergeant first class)" - so the grade is spelled out, not abbreviated.
     */
    signatureCase: "mixed",
    signatureComponent: "U.S. Army",
    omitBranch: true,
    spellOutGrade: true,
    signatureCite: "AR 25-50, paras 3-4 and 3-6c(2)(c), and fig 3-1",

    // "Digital signatures will not be used on letters." - 3-6c(2)(b)
    noDigitalSignature: true,
    noDigitalSignatureCite: "AR 25-50, para 3-6c(2)(b)",

    /*
     * "Type 'Enclosure' at the left margin on the second line below the
     * signature block. Do not show the number of enclosures or list them...
     * For more than one enclosure, show the plural form 'Enclosures.'" -
     * 3-6c(3). A memorandum lists and numbers them (chapter 4); a letter does
     * neither.
     */
    enclosureKeyword: "Enclosure",
    enclosurePlural: "Enclosures",
    listEnclosures: false,
    signatureToEnclosure: {linesBelow: 2, cite: "AR 25-50, para 3-6c(3)"},
    enclosureCite: "AR 25-50, para 3-6c(3)",

    // "Type 'cc:' on the second line below the last line of the signature
    //  block or enclosure listing, whichever is lower." - 3-6c(4). Lowercase,
    //  where a memorandum uses "CF:" (para 2-4c(5)).
    copyKeyword: "cc:",
    toCopies: {linesBelow: 2, cite: "AR 25-50, para 3-6c(4)"},

    /*
     * Continuation pages. "Center the page number 1 inch from the top edge of
     * the paper, typing a hyphen on each side of the page number", "Start the
     * first line of text on the fifth line below the number of the page", and
     * "type a minimum of two lines on the continuation page". - 3-6b(3) and (4)
     */
    pageNumberFromTopIn: 1.0,
    pageNumberMark: "-",
    pageNumberToText: {linesBelow: 5, cite: "AR 25-50, para 3-6b(4)"},
    minLinesOnContinuation: 2,
    continuationCite: "AR 25-50, paras 3-6b(3) and 3-6b(4)",

    // "Do not use abbreviations in the address. Exceptions include..."
    // - 3-6a(3)(a)
    addressAbbreviationsAllowed: ["DC", "U.S.", "P.O. Box", "Mr.", "Mrs.", "Ms.",
        "Dr.", "Jr.", "Sr.", "2d.", "II", "III", "Ret.", "NE", "NW", "SE", "SW"],
    addressAbbreviationCite: "AR 25-50, para 3-6a(3)(a)",

    cite: "AR 25-50, chapter 3",
};

/** The page number of a letter's continuation page: "-2-". - para 3-6b(3) */
export function letterPageNumber(n) {
    return `${LETTER.pageNumberMark}${n}${LETTER.pageNumberMark}`;
}

/**
 * A letter's date, in civilian style: "January 3, 2020". - para 3-6a(1)
 *
 * The memorandum's own date is military style, "3 January 2020" (para
 * 2-4a(3)(a)), so the two vehicles never share a date format.
 */
export function formatLetterDate(date = new Date()) {
    const d = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(d?.getTime?.())) return String(date);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * "Do not use the memorandum format when corresponding with the Families of
 *  military personnel or private businesses." - para 1-8b
 *
 * A narrower rule than `LETTER_AUDIENCES`: para 3-2 does not name either of
 * these two as letter audiences either, so this is not "use a letter
 * instead" - it is "not a memorandum", full stop. The letter is the vehicle
 * AR 25-50 offers for both in practice (para 3-2's "official personal
 * correspondence... letters of welcome, appreciation, commendation, and
 * condolence" covers a Family; "the public" covers a business), which is why
 * the finding still points at chapter 3.
 */
export const MEMORANDUM_PROHIBITED_AUDIENCES = {
    cite: "AR 25-50, para 1-8b",
    tests: [
        {who: "the Family of a Servicemember",
         pattern: /\bfamily\s+of\b/i},
        // Deliberately narrow. "Company" and "Co" are also how a memorandum
        // names its own addressee - "Commander, Company C, 2d Battalion" -
        // and a pattern that fires on either would misreport every ordinary
        // unit address in the codebase's own examples. Only suffixes with no
        // military reading are matched.
        {who: "a private business",
         pattern: /\b(Inc|LLC|L\.L\.C|Corp(oration)?)\.?(?=[\s,]|$)/},
    ],
};

/** Addressees this memorandum names that para 1-8b bars a memorandum from reaching. */
export function memorandumProhibitedAudiences(addressees = []) {
    const hits = new Map();
    for (const raw of addressees) {
        const text = String(typeof raw === "string" ? raw : (raw?.text ?? raw?.name ?? ""));
        for (const t of MEMORANDUM_PROHIBITED_AUDIENCES.tests) {
            if (t.pattern.test(text) && !hits.has(t.who)) hits.set(t.who, text);
        }
    }
    return [...hits].map(([who, addressee]) => ({who, addressee}));
}

/**
 * "Do not use phrases such as 'The Secretary has requested that I reply,'
 *  'The Secretary desires that I reply,' or 'On behalf of the (name)' unless
 *  the SECARMY has specifically directed using such a phrase." - para 3-3
 *
 * A letter-only prohibition - the opposite shape from `MANDATORY_PHRASES`
 * (para 6-2b), whose presence in a memorandum *excuses* the authority line.
 * These are barred from a letter unless the SECARMY specifically ordered
 * them, so the finding only fires for a letter and only absent that flag.
 */
export const RESPONSE_PHRASES = {
    patterns: [
        /\bThe Secretary has requested that I reply\b/i,
        /\bThe Secretary desires that I reply\b/i,
        /\bOn behalf of the\b/i,
    ],
    cite: "AR 25-50, para 3-3",
};

export const LETTER_AUDIENCES = {
    cite: "AR 25-50, para 3-2",
    tests: [
        {who: "the President or Vice President of the United States",
         pattern: /\b(the\s+)?(president|vice[-\s]president)\b(?!.*\b(university|college|company|corporation|association|bank)\b)/i},
        {who: "members of the White House staff", pattern: /\bwhite house\b/i},
        {who: "Members of Congress",
         pattern: /\b(congress(man|woman|person)?|senator|representative\s+[A-Z]|u\.?s\.?\s+house of representatives|united states senate)\b/i},
        {who: "Justices of the Supreme Court", pattern: /\b(supreme court|chief justice|associate justice)\b/i},
        {who: "State Governors", pattern: /\bgovernor\b/i},
        {who: "mayors", pattern: /\bmayor\b/i},
        {who: "foreign government officials", pattern: /\b(ambassador|embassy|consul(ate|\s+general)?|ministry of|minister of)\b/i},
        {who: "the public", pattern: /\b(mr\.|mrs\.|ms\.|dr\.)\s+\S+/i},
    ],
    // Differences a caller has to honor if they switch to a letter. Chapter 3.
    deltas: [
        "Date is civilian style and centered two lines below the letterhead - para 3-6a(1).",
        "There is no office symbol, no ARIMS record number, and no suspense date - paras 1-24, 3-5d, 1-27b.",
        "An inside address and a salutation replace the MEMORANDUM FOR line - paras 3-6a(3) and 3-6a(4).",
        "Paragraphs are indented 1/4 inch and are never numbered or lettered - para 3-6b(5).",
        "A complimentary close precedes the signature block, and the authority line is omitted - paras 3-6c(1) and 6-2b.",
        "The signature block is uppercase and lowercase, with the grade spelled out and \"U.S. Army\" for the branch - paras 6-4a(1), 6-4f(1), 6-5c(3).",
        "Enclosures are spelled out, uncounted, and unlisted, two lines below the signature block - paras 3-6c(3) and 4-2c(1).",
        "Courtesy copies use \"cc:\", not \"CF:\" - para 3-6c(4).",
        "Page numbers are centered 1 inch from the top edge with a hyphen each side - para 3-6b(3).",
    ],
};

/** Which para 3-2 audiences an addressee list reaches, if any. */
export function letterAudiences(addressees = []) {
    const hits = new Map();
    for (const raw of addressees) {
        const text = String(typeof raw === "string" ? raw : (raw?.text ?? raw?.name ?? ""));
        for (const t of LETTER_AUDIENCES.tests) {
            if (t.pattern.test(text) && !hits.has(t.who)) hits.set(t.who, text);
        }
    }
    return [...hits].map(([who, addressee]) => ({who, addressee}));
}

/**
 * "Use the acronym ALARACT (all Army activities) only in electronically
 *  transmitted messages [...] Do not use it when addressing Army
 *  correspondence." - para 1-13
 */
export const ALARACT = {
    pattern: /\bALARACT\b/i,
    cite: "AR 25-50, para 1-13",
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

    /*
     * The mark on a memorandum that will be signed by hand: an underlined X.
     *
     * Figure 2-18 prints it that way at 150 px/in - the X carries a rule under
     * it, and the rule is the point. It is the space the approver strikes, so
     * the X is a marker sitting on a blank rather than a letter of text. An
     * underscore in the source, the same convention the underlined paragraph
     * headings of the decision memorandum use.
     */
    wetMark: "_X_",
    wetCite: "AR 25-50, fig 2-18",

    // Figure 2-19 replaces it with a checkbox on a digitally signed
    // memorandum - one the approver clicks rather than strikes.
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
