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

/** Placeholder syntax, so tooling and the validator agree on what is unfilled. */
export const PLACEHOLDER = /\[[A-Z][A-Z0-9 _/()-]*\]/g;

export function hasPlaceholders(value) {
    if (typeof value === "string") return PLACEHOLDER.test(value);
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
    seal: null,
};

const SIGNATURE = {
    name: "[FULL NAME]",
    gradeAndBranch: "[GRADE, BRANCH]",
    title: "[DUTY TITLE]",
};

const POC = "My point of contact for this action is [GRADE OR PREFIX] [FULL NAME], [OFFICE SYMBOL], at [PHONE] or [EMAIL].";

function base(overrides = {}) {
    return {
        type: "standard",
        letterhead: {...LETTERHEAD},
        officeSymbol: "[OFFICE SYMBOL]",
        arimsRecordNumber: "[ARIMS RECORD NUMBER]",
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
        authorityLine: "FOR THE COMMANDER:",
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
        authorityLine: "FOR THE COMMANDER:",
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
                    {text: "APPROVED  X\tDISAPPROVED  X\tSEE ME  X", literal: true, tabsIn: [2.5, 4.5]},
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
function agreement(type) {
    return {
        type,
        letterhead: {...LETTERHEAD},
        officeSymbol: null,
        date: formatMemoDate(),
        parties: ["[FIRST AGENCY]", "[SECOND AGENCY]"],
        subject: "[SUBJECT OF THE AGREEMENT]",
        paragraphs: [
            {text: "_REFERENCES_.  [List the references directly related to this document.]"},
            {text: "_PURPOSE_.  [Clearly state the purpose of this " + (type === "moa" ? "agreement" : "understanding") + ".]"},
            {text: "_BACKGROUND_.  [Include a brief background.]"},
            {
                text: "_UNDERSTANDINGS, AGREEMENTS, SUPPORT, RESOURCES, AND RESPONSIBILITIES_.",
                children: [
                    {text: "[FIRST AGENCY] agrees to [responsibilities]."},
                    {text: "[SECOND AGENCY] agrees to [responsibilities]."},
                ],
            },
            {text: "_EFFECTIVE DATE_.  This " + (type === "moa" ? "agreement" : "understanding") + " is effective [DATE]."},
            {text: "_REVIEW, REVISION, MODIFICATION, OR CANCELLATION_.  [Enter the date mutually agreed to by the signers or their designated representatives.]"},
        ],
        // "Place the signature blocks in protocol order, with the senior
        //  official on the right." - para 2-6c(5)(d)
        signers: [
            {name: "[JUNIOR OFFICIAL NAME]", titleAndAgency: "[GRADE, BRANCH, TITLE, AGENCY]", date: "[DATE]"},
            {name: "[SENIOR OFFICIAL NAME]", titleAndAgency: "[GRADE, BRANCH, TITLE, AGENCY]", date: "[DATE]"},
        ],
        digitalSignature: false,
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
