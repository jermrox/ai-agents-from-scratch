/**
 * Editable memorandum templates.
 *
 * Each template is a complete memo spec with `[BRACKETED]` placeholders where a
 * value belongs. The placeholders are the editing surface: fill them in JSON
 * and re-render, or render the .docx and type over them in Word. Either way the
 * layout is untouched, because none of it lives in the text.
 *
 * `_underscores_` mark a run to underline. Figure 2-18 underlines the leading
 * heading word of each decision-memorandum paragraph; the renderer honours the
 * marker and nothing else, so emphasis stays deliberate (para 1-32).
 */

import {MEMO_TYPES, formatMemoDate} from "./ar25-50.js";

/**
 * Placeholder syntax, so tooling and the validator agree on what is unfilled.
 *
 * Two or more capitals after the bracket, then anything up to the close. The
 * leading capitals are what separate a blank from ordinary bracketed prose:
 * "[PURPOSE SENTENCE - state the action first]" is a blank, "[Enclosure 1]" is
 * not. Instructional placeholders carry lowercase guidance after the caps, so
 * matching only `[ALL CAPS]` would miss most of the body of every template.
 */
export const PLACEHOLDER = /\[[A-Z]{2,}[^\]]*\]/g;

export function hasPlaceholders(value) {
    if (typeof value === "string") {
        // PLACEHOLDER is global, and `.test()` on a global regex advances
        // lastIndex - calling it twice on the same string returns true then
        // false. Reset before every use.
        PLACEHOLDER.lastIndex = 0;
        return PLACEHOLDER.test(value);
    }
    if (Array.isArray(value)) return value.some(hasPlaceholders);
    if (value && typeof value === "object") return Object.values(value).some(hasPlaceholders);
    return false;
}

/** Every unfilled placeholder in a spec, as dotted paths. */
export function findPlaceholders(value, path = "", out = []) {
    if (typeof value === "string") {
        const matches = value.match(PLACEHOLDER);
        if (matches) out.push({path, placeholders: [...new Set(matches)]});
    } else if (Array.isArray(value)) {
        value.forEach((v, i) => findPlaceholders(v, `${path}[${i}]`, out));
    } else if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) {
            findPlaceholders(v, path ? `${path}.${k}` : k, out);
        }
    }
    return out;
}

const LETTERHEAD = {
    organization: "[ORGANIZATIONAL NAME/TITLE]",
    streetAddress: "[STANDARDIZED STREET ADDRESS]",
    cityStateZip: "[CITY STATE 12345-1234]",
    // seal omitted on purpose: the shipped department seal is the default.
};

const SIGNATURE = {
    name: "[FULL NAME]",
    gradeAndBranch: "[GRADE, BRANCH]",
    title: "[DUTY TITLE]",
};

/**
 * The matters of record - who the office is, what it is called, when the thing
 * was signed, and who signed it. A drafting model must never supply these, and
 * the person running the agent usually cannot either: the date is not known
 * until signature (para 2-4a(3)(b): "Place the date on the same line as the
 * office symbol flush with the right margin *after the memorandum has been
 * signed*"), and the signature block belongs to whoever ends up signing.
 *
 * They come back blank, not filled with something plausible. What the document
 * carries is the *frame* - "DEPARTMENT OF THE ARMY", "MEMORANDUM FOR",
 * "SUBJECT:", and the lines the signature block occupies - with nothing in the
 * slots until somebody says what goes there.
 *
 * `letterhead` is an object of blanks rather than null, because null means
 * something else: plain white paper, as an MFR requires (fig 2-17). Blank
 * means the letterhead is there and nobody has filled it in yet.
 *
 * The layout does not depend on any of these values, so filling them in later
 * - in JSON, or by typing into the slots in Word - cannot move anything.
 */
export function recordFieldPlaceholders() {
    return {
        letterhead: {organization: "", streetAddress: "", cityStateZip: ""},
        officeSymbol: "",
        date: "",
        signature: {name: "", gradeAndBranch: "", title: ""},
    };
}

/** Which fields recordFieldPlaceholders() covers, and why each is a matter of record. */
export const RECORD_FIELDS = [
    {path: "letterhead", label: "Letterhead", cite: "AR 25-50, paras 1-16 and 1-18"},
    {path: "officeSymbol", label: "Office symbol", cite: "AR 25-50, para 2-4a(1)"},
    {path: "date", label: "Date", cite: "AR 25-50, para 2-4a(3)(b)"},
    {path: "signature", label: "Signature block", cite: "AR 25-50, paras 2-4c(2) and 6-4"},
];

const POC = "My point of contact for this action is [GRADE OR PREFIX] [FULL NAME], [OFFICE SYMBOL], at [PHONE] or [EMAIL].";

function base(overrides = {}) {
    return {
        type: "standard",
        letterhead: {...LETTERHEAD},
        officeSymbol: "[OFFICE SYMBOL]",
        date: formatMemoDate(),
        suspenseDate: null,
        addressStyle: "mixed",
        addressees: ["[ADDRESSEE, STREET, CITY STATE ZIP+4]"],
        thru: [],
        subject: "[SUBJECT IN TEN WORDS OR LESS]",
        paragraphs: [],
        authorityLine: null,
        signature: {...SIGNATURE},
        digitalSignature: true,
        enclosures: [],
        copiesFurnished: [],
        ...overrides,
    };
}

/**
 * Standard memorandum - para 2-4, figures 2-1 through 2-14.
 */
function standard() {
    return base({
        paragraphs: [
            {text: "[PURPOSE SENTENCE - state the action or decision first, in the active voice.]"},
            {text: "[MAIN POINT - the recommendation, conclusion, or most important information.]"},
            {text: POC},
        ],
    });
}

/**
 * MEMORANDUM THRU - para 2-4a(5)(d), figures 2-11 and 2-12.
 * "Do not address memorandums to more than two THRU addressees unless it is
 *  absolutely necessary." - fig 2-12
 */
function thru() {
    return base({
        type: "thru",
        thru: ["[THRU ADDRESSEE, STREET, CITY STATE ZIP+4]"],
        addressees: ["[ACTION ADDRESSEE, STREET, CITY STATE ZIP+4]"],
        paragraphs: [
            {text: "[PURPOSE SENTENCE - what you are asking the action addressee to do.]"},
            {text: "[SUPPORTING INFORMATION the THRU addressee needs in order to comment or concur.]"},
            {text: POC},
        ],
    });
}

/**
 * Memorandum for record - para 2-7, figure 2-17.
 * Plain white paper, no authority line, one page if possible.
 */
function record() {
    return base({
        type: "record",
        letterhead: null,          // "Type the MFR on plain white paper." - fig 2-17
        addressees: [],
        authorityLine: null,       // "Do not use an authority line." - fig 2-17
        subject: "[SUBJECT OF THE RECORD]",
        paragraphs: [
            {text: "[AUTHORITY OR BASIS for the action, or the meeting or telephone conversation being recorded, with date and time in military format.]"},
            {text: "[BACKGROUND having a direct bearing on the matter, to inform reviewing and signing officials.]"},
            {text: POC},
        ],
    });
}

/**
 * Decision memorandum - para 2-8, figures 2-18 and 2-19.
 *
 * The paragraph skeleton is fixed by figure 2-18: FOR DECISION, PURPOSE,
 * RECOMMENDATION(S) with the approval line, BACKGROUND, DISCUSSION with courses
 * of action, IMPACT, COORDINATION, and the point of contact. Two pages maximum,
 * excluding supporting documents (para 2-8a).
 */
function decision() {
    return base({
        type: "decision",
        thru: ["[CHAIN OF COMMAND MEMBER, AS NECESSARY]"],
        addressees: ["[DECISION AUTHORITY]"],
        subject: "[SUBJECT OF THE DECISION]",
        paragraphs: [
            {text: "_FOR DECISION_."},
            {text: "_PURPOSE_.  [In one concise sentence, state the action to be taken, such as \"To obtain SECARMY approval for ...\"]"},
            {
                text: "_RECOMMENDATION(S)_.  [State the specific recommendation, such as \"CG sign the enclosed memorandum at TAB A.\"]",
                children: [
                    // The approval line is a tabular row, not a subparagraph:
                    // it carries no letter and its columns are the content.
                    // `approvalLine` lets the renderer choose the mark: an "X"
                    // to strike by hand (fig 2-18) or a checkbox to click on a
                    // digitally signed memorandum (fig 2-19).
                    {approvalLine: true, literal: true, tabsIn: [2.5, 4.5]},
                ],
            },
            {text: "_BACKGROUND_.  [Explain the origin of the action, convey the facts necessary to understand the recommendation, and list the alternatives considered.]"},
            {
                text: "_DISCUSSION_.  [Assess the courses of action considered, in terms of advantages and disadvantages. Include supporting documents as enclosures at tabs and summarize their key points here.]",
                children: [
                    {text: "COA 1:  [Advantages/Disadvantages]"},
                    {text: "COA 2:  [Advantages/Disadvantages]"},
                    {text: "COA 3:  [Advantages/Disadvantages]"},
                ],
            },
            {text: "_IMPACT_.  [Indicate the impact of the recommended decision on personnel, equipment, funding, and stationing. Identify who is affected and how. If none, state \"No impact.\"]"},
            {
                text: "_COORDINATION_.  [Indicate with whom and when the action was staffed. Line through the word that does not apply and enter the date. Justification will accompany all nonconcurrences.]",
                children: [
                    // Concurrence rows: "line through the word that does not
                    // apply" and enter the date. - fig 2-18
                    {text: "[ORGANIZATION]\tCONCUR/NONCONCUR\t[DATE]", literal: true, tabsIn: [2.75, 4.75]},
                    {text: "([NAME])", literal: true, tabsIn: [2.75, 4.75]},
                    {text: "[ORGANIZATION]\tCONCUR/NONCONCUR\t[DATE]", literal: true, tabsIn: [2.75, 4.75]},
                    {text: "([NAME])", literal: true, tabsIn: [2.75, 4.75]},
                ],
            },
            {text: "POC for this action is [FULL NAME], [OFFICE SYMBOL], at [PHONE] or [EMAIL]."},
        ],
        authorityLine: null,
        enclosures: ["[TAB A - SUPPORTING DOCUMENT]"],
    });
}

/**
 * Memorandum of understanding / agreement - para 2-6, figures 2-15 and 2-16.
 *
 * An MOU describes shared concepts and plans where no transfer of funds is
 * anticipated (para 2-6a); an MOA establishes terms where transfer of funds for
 * services is anticipated (para 2-6b).
 */
/**
 * Memorandum of understanding / agreement - para 2-6, figures 2-15 and 2-16.
 *
 * The paragraph skeleton is the one the figures actually print, which is more
 * specific than the category list in para 2-6c(3) ("will generally contain,
 * but is not limited to"). Headings take a colon and are not underlined -
 * figures 2-15 and 2-16 set them in plain type.
 *
 * An MOU describes shared concepts and plans where no transfer of funds is
 * anticipated (para 2-6a); an MOA establishes terms where transfer of funds
 * for services is anticipated (para 2-6b). Both are prepared on plain white
 * paper (para 2-6c(1)); DA letterhead is appropriate only when the agreement
 * is between two Army activities.
 */
function agreement(type) {
    const moa = type === "moa";
    const word = moa ? "MOA" : "MOU";
    const noun = moa ? "Agreement" : "Understanding";

    const provisions = moa
        ? [
            {text: "Points of Contact:"},
            {text: "Review of Agreement:  [This MOA will be reviewed annually, or ...]"},
            {text: "Modification of Agreement:  [This MOA may be modified only by the written agreement of the Parties, duly signed by their authorized representatives.]"},
            {text: "Disputes:  [Any disputes relating to this MOA will ...]"},
            {text: "Termination of Agreement:"},
            {text: "Transferability:"},
            {text: "Entire Agreement:  [It is expressly understood and agreed that this MOA embodies the entire agreement between the Parties regarding the MOA's subject matter.]"},
            {text: "Effective Date:  [This MOA takes effect ...]"},
            {text: "Expiration Date:  [This Agreement expires on [DATE].]"},
        ]
        : [
            {text: "Points of Contact:"},
            {text: "Correspondence:"},
            {text: "Funds and Manpower:  [This MOU does not document or provide for the exchange of funds or manpower between the Parties, nor does it make any commitment of funds or resources.]"},
            {text: "Modifications of MOU:"},
            {text: "Disputes:"},
            {text: "Termination of Understanding:"},
            {text: "Transferability:"},
            {text: "Entire Understanding:  [It is expressly understood and agreed that this MOU embodies the entire understanding between the Parties regarding the MOU's subject matter.]"},
            {text: "Effective Date:  [This MOU takes effect the day after all parties have signed.]"},
            {text: "Expiration Date:"},
            {text: `Cancellation of Previous ${word}:  [This ${word} cancels and supersedes the ${word} between the same parties with the subject [SUBJECT] and effective date of [DATE].]`},
        ];

    return {
        type,
        // "Prepare the MOU/MOA on plain white paper." - para 2-6c(1)
        letterhead: null,
        officeSymbol: null,
        date: formatMemoDate(),
        parties: ["[FIRST AGENCY]", "[SECOND AGENCY]"],
        subject: `[SUBJECT OF THE ${moa ? "AGREEMENT" : "UNDERSTANDING"}]`,
        paragraphs: [
            {text: "BACKGROUND:  [If there is a need to discuss background, do so here.]"},
            {text: moa
                ? "REFERENCES/AUTHORITIES:  [State the legal authorities.]"
                : "REFERENCES/AUTHORITIES:  [An MOU is non-binding. Generally, authorities need not be included. If appropriate, N/A may be used.]"},
            {text: moa
                ? "AUTHORITIES:  [State the legal authorities.]"
                : "AUTHORITIES:  [An MOU is non-binding. Generally, authorities need not be included. If appropriate, N/A may be used.]"},
            {text: `PURPOSE:  [State the purpose of the ${word}.]`},
            {text: moa
                ? "RESPONSIBILITIES OF THE PARTIES:"
                : "UNDERSTANDINGS OF THE PARTIES:  [State the intentions of all parties.]"},
            {text: "PERSONNEL:"},
            {text: "GENERAL PROVISIONS:", children: provisions},
        ],
        // "Place the signature blocks in protocol order, with the senior
        //  official on the right." - para 2-6c(5)(d). A third signer is
        //  centred below, the highest ranking of the three.
        signers: [
            {name: "[JUNIOR OFFICIAL NAME]", gradeAndBranch: "[GRADE, BRANCH]", titleAndAgency: `[TITLE, AGENCY]`},
            {name: "[SENIOR OFFICIAL NAME]", gradeAndBranch: "[GRADE, BRANCH]", titleAndAgency: `[TITLE, AGENCY]`},
        ],
        digitalSignature: false,
        enclosures: [],
    };
}

export const TEMPLATES = {
    standard,
    thru,
    record,
    decision,
    mou: () => agreement("mou"),
    moa: () => agreement("moa"),
};

/** Build a fresh, fully editable spec for a memorandum type. */
export function createTemplate(type = "standard") {
    const build = TEMPLATES[type];
    if (!build) {
        const known = Object.keys(TEMPLATES).join(", ");
        throw new Error(`Unknown memorandum type "${type}". Known types: ${known}`);
    }
    return build();
}

/** Human-readable list of the types, with the paragraph that governs each. */
export function describeTemplates() {
    return Object.keys(TEMPLATES).map((key) => ({
        type: key,
        title: MEMO_TYPES[key]?.title ?? key,
        cite: MEMO_TYPES[key]?.cite ?? "AR 25-50",
    }));
}

/**
 * Merge user-supplied values into a template, leaving untouched placeholders in
 * place so the caller can see what is still unfilled.
 */
export function fillTemplate(template, values = {}) {
    const merged = structuredClone(template);
    for (const [key, value] of Object.entries(values)) {
        if (value === undefined) continue;
        if (value && typeof value === "object" && !Array.isArray(value) && merged[key] && typeof merged[key] === "object" && !Array.isArray(merged[key])) {
            merged[key] = {...merged[key], ...value};
        } else {
            merged[key] = value;
        }
    }
    return merged;
}
