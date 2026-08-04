/**
 * The fields that belong to the *unit* rather than to the memorandum.
 *
 * AR 25-50 is one regulation, but a memorandum written under it is not
 * interchangeable between offices. The organization's name, its street
 * address, its office symbol, and who signs for it are the office's own, and
 * they are the same on the next memorandum and the one after that. The subject,
 * the addressee, the date and the THRU chain change every time.
 *
 * Nothing here is a rule about *format* - the layout is identical whatever
 * these say, which is the whole point of the slots. What this module does is
 * separate the two lifetimes, so an office is asked for its own details once
 * and asked for the memorandum's details every time.
 *
 * The regulation is explicit that these are the office's to set, not this
 * code's: para 1-16b(2) forbids printing anything on letterhead "except those
 * approved or directed by HQDA", and para 2-4a(1) leaves the office symbol to
 * the office. So the agent's job is to know where they go, not what they say.
 */

import {LETTERHEAD, PERSONAL_ADDRESS_TYPES} from "./ar25-50.js";

/**
 * Every field a memorandum needs from a person rather than from the
 * regulation.
 *
 *   scope   "unit"       the office's own, worth remembering
 *           "memorandum" this one's, asked for every time
 *   path    where it lives on a memo spec
 *   prompt  the slot's grey prompt in Word, so the two can be matched up
 *   when    which memorandums it applies to; absent means all of them
 */
export const FIELDS = [
    {
        path: "letterhead.organization", scope: "unit",
        label: "Organization", prompt: "ORGANIZATION",
        hint: "The organizational name or title, as it is printed on the office's letterhead.",
        cite: "AR 25-50, paras 1-16b and 1-18",
        when: (memo) => usesLetterhead(memo),
    },
    {
        path: "letterhead.streetAddress", scope: "unit",
        label: "Street address", prompt: "STREET ADDRESS",
        hint: "The standardized street address.",
        cite: "AR 25-50, para 1-18",
        when: (memo) => usesLetterhead(memo),
    },
    {
        path: "letterhead.cityStateZip", scope: "unit",
        label: "City, State ZIP+4", prompt: "CITY, STATE ZIP+4",
        hint: "Two spaces between the State and the ZIP+4.",
        cite: "AR 25-50, paras 1-18 and 5-10b",
        when: (memo) => usesLetterhead(memo),
    },
    {
        path: "officeSymbol", scope: "unit",
        label: "Office symbol", prompt: "OFFICE SYMBOL",
        hint: "At the left margin on the first line of the heading.",
        cite: "AR 25-50, para 2-4a(1)",
        // An MOU/MOA has no office symbol (para 2-6c), the abbreviated MFR
        // omits it outright (fig 2-17 note 7), and a letter has no office
        // symbol line at all - chapter 3's heading is the date, subject if
        // used, address and salutation (paras 3-5d and 3-6a).
        when: (memo) => !isAgreement(memo) && !memo.abbreviated && !isLetter(memo),
    },
    {
        path: "signature.name", scope: "unit",
        label: "Signer name", prompt: "SIGNER NAME",
        // A memorandum's signature block is in capitals (para 6-4c); a
        // letter's is mixed case (para 3-6c(2)(c)).
        hint: "At the centre of the page.",
        cite: "AR 25-50, paras 6-4c and 3-6c(2)(c)",
        when: (memo) => !isAgreement(memo),
    },
    {
        path: "signature.gradeAndBranch", scope: "unit",
        label: "Grade and branch", prompt: "GRADE, BRANCH",
        hint: "For example LTC, IN. A civilian leaves this blank and gives a title only.",
        cite: "AR 25-50, paras 6-4f and 6-5c",
        when: (memo) => !isAgreement(memo) && !isLetter(memo),
    },
    {
        // A letter spells the grade out and carries the component, not the
        // branch: "Branch designations and 'General Staff' have no meaning to
        // the general public." - fig 3-1 continued, and para 3-4.
        path: "signature.gradeAndBranch", scope: "unit",
        label: "Grade and component", prompt: "GRADE, U.S. ARMY",
        hint: "Spelled out in full, then U.S. Army - for example Major General, U.S. Army.",
        cite: "AR 25-50, paras 3-4 and 3-6c(2)(c)",
        when: (memo) => isLetter(memo),
    },
    {
        path: "signature.title", scope: "unit",
        label: "Duty title", prompt: "DUTY TITLE",
        hint: "The position, not the person.",
        cite: "AR 25-50, para 6-4c",
        when: (memo) => !isAgreement(memo),
    },

    {
        // "Type the salutation on the second line below the last line of the
        //  address." - para 3-6a(4). The letter's, and only the letter's.
        path: "salutation", scope: "memorandum",
        label: "Salutation", prompt: "SALUTATION",
        hint: "For example Dear Governor Roe: - see appendix C for the correct form.",
        cite: "AR 25-50, para 3-6a(4)",
        when: (memo) => isLetter(memo),
    },
    {
        // Naming the row is what lets the salutation above be checked against
        // appendix C rather than only checked for being present.
        path: "addresseeCategory", scope: "memorandum", optional: true,
        label: "Addressee category", prompt: "ADDRESSEE CATEGORY",
        hint: "A table C-1 through C-11 heading, e.g. \"Governor of a State\" - checks the salutation against it.",
        cite: "AR 25-50, para 3-5e",
        when: (memo) => isLetter(memo),
    },
    {
        path: "subject", scope: "memorandum",
        label: "Subject", prompt: "SUBJECT",
        hint: "Ten words or less, one subject.",
        cite: "AR 25-50, para 2-4a(6)",
        // A letter's subject line is optional - "if used", para 3-6a(2).
        when: (memo) => !memo.abbreviated && !isLetter(memo),
    },
    {
        path: "addressees", scope: "memorandum", list: true,
        label: "MEMORANDUM FOR", prompt: "ADDRESSEE",
        hint: "The office expected to complete the action. One per line.",
        cite: "AR 25-50, para 2-4a(5)",
        when: (memo) => memo.type !== "record" && !isAgreement(memo) && !memo.seeDistribution
            && !isLetter(memo),
    },
    {
        path: "thru", scope: "memorandum", list: true, optional: true,
        label: "MEMORANDUM THRU", prompt: "THRU ADDRESSEE",
        hint: "Only when the action must be endorsed on the way. One per line, two at most.",
        cite: "AR 25-50, para 2-4a(5)(d)",
        when: (memo) => memo.type !== "record" && !isAgreement(memo) && !isLetter(memo),
    },
    {
        // A letter's address stands in the body of the page rather than after a
        // keyword, and it is written out in full - para 3-6a(3).
        path: "addressees", scope: "memorandum", list: true,
        label: "Address", prompt: "ADDRESSEE",
        hint: "Name, street, city and State, written out - no abbreviations except those in para 3-6a(3)(a).",
        cite: "AR 25-50, para 3-6a(3)",
        when: (memo) => isLetter(memo),
    },
    {
        // "Exclusive For" correspondence, appreciation, and commendation
        // address the name and title of a person, not an office - para
        // 2-4a(5).
        path: "addresseeTitle", scope: "memorandum",
        label: "Addressee's title", prompt: "TITLE",
        hint: "The person's duty title, not their organization.",
        cite: "AR 25-50, para 2-4a(5)",
        when: (memo) => PERSONAL_ADDRESS_TYPES.includes(memo?.type),
    },
    {
        // Only "Exclusive For" spells this out as a third element - para
        // 1-12b(1). Appreciation and commendation name only "the name and
        // title of the addressee" - para 2-4a(5) - so this does not apply there.
        path: "addresseeAddress", scope: "memorandum", optional: true,
        label: "Addressee's mailing address", prompt: "MAILING ADDRESS",
        hint: "Only \"Exclusive For\" correspondence names a mailing address.",
        cite: "AR 25-50, para 1-12b(1)",
        when: (memo) => memo?.type === "exclusiveFor",
    },
    {
        // Para 2-6c(2): the parties are named in the heading, not after a
        // MEMORANDUM FOR line - an MOU/MOA has no addressee at all (para 2-6c(1)).
        path: "parties", scope: "memorandum", list: true,
        label: "Parties to the agreement", prompt: "PARTY",
        hint: "The agencies entering into it, in the order they should appear. One per line.",
        cite: "AR 25-50, para 2-6c(2)",
        when: (memo) => isAgreement(memo),
    },
    {
        path: "authorityLine", scope: "memorandum", optional: true,
        label: "Authority line", prompt: "AUTHORITY LINE",
        hint: "Only when someone other than the commander signs - para 2-4c(1). Omitted on an MFR, an agreement, and a letter.",
        cite: "AR 25-50, para 2-4c(1)",
        when: (memo) => memo?.type !== "record" && !isAgreement(memo) && !isLetter(memo),
    },
    {
        path: "suspenseDate", scope: "memorandum", optional: true,
        label: "Suspense date", prompt: "SUSPENSE DATE",
        hint: "Only when a reply is required by a certain date - para 2-4a(4). Letters do not take one (para 1-27b).",
        cite: "AR 25-50, para 2-4a(4)",
        when: (memo) => memo?.type !== "record" && !isAgreement(memo) && !isLetter(memo),
    },
    {
        // A letter's date is civilian style and always shown - para 3-6a(1).
        path: "date", scope: "memorandum",
        label: "Date", prompt: "DATE",
        hint: "Civilian style, centred two lines below the letterhead - for example January 3, 2020.",
        cite: "AR 25-50, para 3-6a(1)",
        when: (memo) => isLetter(memo),
    },
    {
        path: "date", scope: "memorandum", optional: true,
        label: "Date", prompt: "DATE",
        hint: "Normally left blank - para 2-4a(3)(b) puts it on after the memorandum is signed.",
        cite: "AR 25-50, para 2-4a(3)(b)",
        when: (memo) => !memo.abbreviated && !isLetter(memo),
    },
];

const isAgreement = (memo) => memo?.type === "mou" || memo?.type === "moa";
const isLetter = (memo) => memo?.type === "letter";

/**
 * Whether this memorandum is written on letterhead at all. An MFR is on plain
 * white paper (fig 2-17), and an MOU/MOA defaults to it (para 2-6c(1)), so
 * neither has an organization block to ask about.
 */
function usesLetterhead(memo) {
    if (memo?.type === "record" || isAgreement(memo)) return false;
    // "Use computer-generated letterhead for the first page" - para 3-5b for a
    // letter, para 2-3a(1) for a memorandum. Both.
    return memo?.letterhead !== null;
}

const get = (obj, path) =>
    path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

function set(obj, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
    target[last] = value;
    return obj;
}

const isBlank = (value) => {
    if (value == null) return true;
    if (Array.isArray(value)) return value.length === 0;
    return String(value).trim() === "";
};

/** The fields that apply to this memorandum, in the order they appear on it. */
export function applicableFields(memo, scope = null) {
    return FIELDS.filter((f) => (scope == null || f.scope === scope))
        .filter((f) => (f.when ? f.when(memo ?? {}) : true));
}

/**
 * What is still to be supplied, ready to be asked for.
 *
 * A memorandum with every one of these blank is not defective - it is a
 * template, and the slots are the point. This is the list of questions, not a
 * list of faults; the validator reports them as `not-yet-supplied` warnings for
 * the same reason.
 */
export function outstandingFields(memo, scope = null) {
    // A bracketed placeholder counts as outstanding. "[FULL NAME]" is what a
    // template puts where a name goes; it is a blank wearing a disguise, and a
    // memorandum that ships with it has not been filled in.
    return applicableFields(memo, scope)
        .filter((f) => {
            const value = get(memo, f.path);
            return isBlank(value) || isPlaceholder(value)
                || (Array.isArray(value) && value.every(isPlaceholder));
        })
        .map(({when, ...rest}) => rest);
}

/** Everything the unit would be asked for, whether or not it is blank. */
export const unitFields = (memo) => applicableFields(memo, "unit");

/** Everything this memorandum needs, over and above the unit's own details. */
export const memorandumFields = (memo) => applicableFields(memo, "memorandum");

/**
 * Lift a unit's details out of a memorandum, to be kept and reused.
 *
 * Placeholder text is not a unit's details - `[ORGANIZATIONAL NAME/TITLE]` is
 * the regulation's own example, and saving it would hand the next memorandum a
 * filled-in field that is still a blank.
 */
export function profileFrom(memo) {
    const profile = {};
    for (const f of FIELDS.filter((f) => f.scope === "unit")) {
        const value = get(memo, f.path);
        if (isBlank(value) || isPlaceholder(value)) continue;
        set(profile, f.path, value);
    }
    return profile;
}

const PLACEHOLDER = /^\s*\[[^\]]*\]\s*$/;
const isPlaceholder = (value) => typeof value === "string" && PLACEHOLDER.test(value);

/**
 * Put a saved unit's details onto a memorandum.
 *
 * Anything the memorandum already says wins: a profile fills blanks, it does
 * not overwrite. That matters because one office may sign for another, and the
 * memorandum in hand is the more specific statement.
 */
export function applyProfile(memo, profile) {
    const out = structuredClone(memo ?? {});
    for (const f of FIELDS.filter((f) => f.scope === "unit")) {
        const supplied = get(profile, f.path);
        if (isBlank(supplied)) continue;
        if (!isBlank(get(out, f.path)) && !isPlaceholder(get(out, f.path))) continue;
        set(out, f.path, String(supplied).trim());
    }
    return out;
}

/**
 * Check a profile before it is trusted, and say what is wrong in the
 * regulation's terms.
 *
 * Only what the regulation actually constrains. The organization's *name* is
 * the office's business (para 1-16b(2) leaves it to HQDA-approved letterhead),
 * so there is nothing here to validate it against - but the city/State/ZIP line
 * has a stated form, and a field carrying a bracketed placeholder is a blank
 * wearing a disguise.
 */
export function validateProfile(profile) {
    const findings = [];
    const known = new Set(FIELDS.filter((f) => f.scope === "unit").map((f) => f.path));

    for (const path of flatten(profile)) {
        if (!known.has(path)) {
            findings.push({
                path, rule: "not-a-unit-field",
                message: `"${path}" is not one of the unit's fields. A profile carries only `
                    + `${[...known].join(", ")}.`,
                cite: "unit profile",
            });
        }
    }

    for (const f of FIELDS.filter((f) => f.scope === "unit")) {
        const value = get(profile, f.path);
        if (isBlank(value)) continue;
        if (isPlaceholder(value)) {
            findings.push({
                path: f.path, rule: "placeholder-saved",
                message: `${f.label} is still the regulation's own example text. `
                    + "Saving it would hand the next memorandum a field that looks filled in and is not.",
                cite: f.cite,
            });
        }
    }

    const zip = get(profile, "letterhead.cityStateZip");
    if (!isBlank(zip) && !isPlaceholder(zip) && /\d{5}/.test(zip) && !/\s{2}\d{5}/.test(zip)) {
        findings.push({
            path: "letterhead.cityStateZip", rule: "zip-spacing",
            message: "Two spaces go between the State and the ZIP+4.",
            cite: "AR 25-50, para 5-10b",
        });
    }

    return findings;
}

function flatten(obj, prefix = "") {
    if (obj == null || typeof obj !== "object") return [];
    return Object.entries(obj).flatMap(([k, v]) => {
        const path = prefix ? `${prefix}.${k}` : k;
        return v && typeof v === "object" && !Array.isArray(v) ? flatten(v, path) : [path];
    });
}

/**
 * The default letterhead lines, for a form that wants to show what goes where
 * without pretending they are this office's.
 */
export const LETTERHEAD_EXAMPLES = {
    "letterhead.organization": LETTERHEAD.lines[1],
    "letterhead.streetAddress": LETTERHEAD.lines[2],
    "letterhead.cityStateZip": LETTERHEAD.lines[3],
};
