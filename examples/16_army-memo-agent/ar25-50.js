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

    // Where the body starts on page 1.
    //
    // "Type the office symbol on the second line below the seal." - para
    // 2-4a(1), and "Type the OFFICE SYMBOL at the left margin, two lines below
    // the seal" - fig 2-2. So this is stated, not a matter of taste.
    //
    // It is derived from the letterhead rather than measured off the figures,
    // because what the rule fixes is a *relationship*: the office symbol sits
    // two lines below the last thing above it. An absolute inch set
    // independently of where the letterhead actually ends cannot hold that
    // relationship, and did not - rendering the .docx and measuring the page
    // put the office symbol 2.66 lines below the last letterhead line instead
    // of 2.
    //
    // The letterhead block begins at the seal's own top offset and occupies
    // one line for the seal plus one for each letterhead line; "second line
    // below" then means one blank line after it.
    letterheadLines: 4,
    lineHeightPt: 13.8,          // Word single spacing for 12 pt Arial
    get officeSymbolTopIn() {
        const line = this.lineHeightPt / 72;
        return this.sealTopIn + (1 + this.letterheadLines + 1) * line;
    },
    officeSymbolTopCite: "AR 25-50, para 2-4a(1) and fig 2-2",

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
    // LEGACY_LETTERHEAD_SIZES to follow the older template.
    titleSizePt: 12,
    addressSizePt: 12,
    letterheadSizeCite: "AR 25-50, para 1-19 - the organization sets the size; 12 pt throughout by default",

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
 * The smaller letterhead sizes measured from the 2009 field template, for an
 * office that still sets its letterhead that way. Not a rule - para 1-19
 * leaves the size to the organization.
 *
 *   renderDocx(memo, {letterhead: LEGACY_LETTERHEAD_SIZES})
 */
export const LEGACY_LETTERHEAD_SIZES = {
    titleSizePt: 10,
    addressSizePt: 8,
    cite: "measured from an Army unit memorandum template (HHC/ESB, 9 December 2009)",
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

export const PROTOCOL_CITE = "AR 25-50, appendix B, figs B-1 and B-2";

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
    exclusiveFor: {title: "Exclusive For Memorandum", cite: "AR 25-50, para 1-12"},
    appreciation: {title: "Memorandum of Appreciation", cite: "AR 25-50, paras 2-2 and 2-4a(5)"},
    commendation: {title: "Memorandum of Commendation", cite: "AR 25-50, paras 2-2 and 2-4a(5)"},
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
