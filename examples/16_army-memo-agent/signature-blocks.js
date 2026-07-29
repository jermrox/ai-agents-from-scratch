/**
 * Signature blocks and authority lines - AR 25-50, chapter 6 and appendix D.
 *
 * This is where the formalities live. The signature block is the part of a
 * memorandum most likely to be wrong, because the rules depend on facts about
 * the signer that no amount of prose style can fix: whether they are a general
 * officer, whether they are detailed to the general staff, whether they are
 * retired, whether the document is a memorandum or a letter.
 *
 * `buildSignature()` takes those facts and produces the block. It never
 * guesses - an unknown grade abbreviation comes back as a finding rather than
 * being passed through.
 */

/** Table 6-1, Army grade abbreviations. */
export const GRADE_ABBREVIATIONS = {
    GEN: "General",
    LTG: "Lieutenant General",
    MG: "Major General",
    BG: "Brigadier General",
    COL: "Colonel",
    LTC: "Lieutenant Colonel",
    MAJ: "Major",
    CPT: "Captain",
    "1LT": "First Lieutenant",
    "2LT": "Second Lieutenant",
    CW5: "Chief Warrant Officer 5",
    CW4: "Chief Warrant Officer 4",
    CW3: "Chief Warrant Officer 3",
    CW2: "Chief Warrant Officer 2",
    WO1: "Warrant Officer 1",
    CSM: "Command Sergeant Major",
    SGM: "Sergeant Major",
    "1SG": "First Sergeant",
    MSG: "Master Sergeant",
    SFC: "Sergeant First Class",
    SSG: "Staff Sergeant",
    SGT: "Sergeant",
    CPL: "Corporal",
    SPC: "Specialist",
    PFC: "Private First Class",
    PV2: "Private",
    PV1: "Private",
};

export const GRADE_TABLE_CITE = "AR 25-50, table 6-1";

/**
 * "Use the full general officer military grade on all formal or official
 *  correspondence (for example, Major General and Lieutenant General)."
 *  - para 6-4f(3), and "In preparing general officer signature blocks, spell
 *  out the military grade." - para 6-5c(1)
 */
export const GENERAL_OFFICER_GRADES = ["GEN", "LTG", "MG", "BG"];
export const GENERAL_OFFICER_CITE = "AR 25-50, paras 6-4f(3) and 6-5c(1)";

/** Warrant officer grades, which take "USA" unless a branch title applies. */
export const WARRANT_OFFICER_GRADES = ["CW5", "CW4", "CW3", "CW2", "WO1"];

/** Enlisted grades, for the USAR designation rule in para 6-7. */
export const ENLISTED_GRADES = [
    "CSM", "SGM", "1SG", "MSG", "SFC", "SSG", "SGT", "CPL", "SPC", "PFC", "PV2", "PV1",
];

export const isGeneralOfficer = (grade) => GENERAL_OFFICER_GRADES.includes(normalizeGrade(grade));
export const isWarrantOfficer = (grade) => WARRANT_OFFICER_GRADES.includes(normalizeGrade(grade));
export const isEnlisted = (grade) => ENLISTED_GRADES.includes(normalizeGrade(grade));

/** Accept either "MAJ" or "Major" and return the abbreviation. */
export function normalizeGrade(grade) {
    if (!grade) return null;
    const raw = String(grade).trim();
    const upper = raw.toUpperCase();
    if (GRADE_ABBREVIATIONS[upper]) return upper;
    const found = Object.entries(GRADE_ABBREVIATIONS)
        .find(([, full]) => full.toUpperCase() === upper);
    return found ? found[0] : null;
}

export function spellOutGrade(grade) {
    const abbr = normalizeGrade(grade);
    return abbr ? GRADE_ABBREVIATIONS[abbr] : null;
}

/**
 * Designations that replace the branch abbreviation entirely.
 *
 *   GS / IG - "Officers assigned or detailed as general staff officers and
 *             officers in the grade of colonel or below detailed as inspectors
 *             general will use the designation 'GS' or 'IG' as appropriate. In
 *             these cases, officers will not use their branch designation."
 *             - para 6-5c(7)
 *   USA     - general officers on memorandums (6-5c(3)), deputy commanders
 *             (6-5c(4)), warrant officers (6-5c(5)), chaplains (6-5c(6)),
 *             joint commands (6-5c(8)), contract surgeons (6-8b)
 */
export const DESIGNATIONS = {
    generalStaff: "GS",
    inspectorGeneral: "IG",
    army: "USA",
    armyLetters: "U.S. Army",
    reserve: "USAR",
    retired: "USA Retired",
};

/**
 * Build a signature block.
 *
 * @param {object} signer
 * @param {string} signer.name          Full name as signed. - para 6-3a
 * @param {string} [signer.grade]       "MAJ" or "Major". Omit for civilians.
 * @param {string} [signer.branch]      Branch abbreviation, for example "IN", "AG".
 * @param {string} signer.title         Duty title. - para 6-4a(2)
 * @param {boolean} [signer.civilian]   Civilian official. - paras 6-4a note 2, 6-8
 * @param {boolean} [signer.commanding] Append "Commanding". - para 6-4a(3)
 * @param {boolean} [signer.generalStaff]      Use "GS". - para 6-5c(7)
 * @param {boolean} [signer.inspectorGeneral]  Use "IG". - para 6-5c(7)
 * @param {boolean} [signer.jointCommand]      Use "USA". - para 6-5c(8)
 * @param {boolean} [signer.chaplain]   "Chaplain (MAJ) USA". - para 6-5c(6)
 * @param {boolean} [signer.retired]    "USA Retired", no branch. - para 6-6
 * @param {boolean} [signer.reserveNotOnActiveDuty] Add "USAR". - para 6-7
 * @param {"memorandum"|"letter"} [correspondence]
 * @returns {{name: string, gradeAndBranch: string|null, title: string,
 *            lines: string[], findings: object[]}}
 */
export function buildSignature(signer, correspondence = "memorandum") {
    const findings = [];
    const isLetter = correspondence === "letter";

    // "Type it (in capital letters on memorandums and in uppercase and
    //  lowercase on letters) identical to the individual's signature." - 6-4a(1)
    const name = isLetter ? titleCaseName(signer.name) : String(signer.name ?? "").toUpperCase();

    // "The official signature block for civilians will consist of the name and
    //  title." - para 6-8a. Two lines, never three.
    if (signer.civilian) {
        if (signer.grade) {
            findings.push({
                rule: "civilian-grade",
                message: "A civilian signature block carries name and title only, with no military grade.",
                cite: "AR 25-50, paras 6-4a note 2 and 6-8a",
            });
        }
        return finish(name, null, signer, findings);
    }

    const abbr = normalizeGrade(signer.grade);
    if (signer.grade && !abbr) {
        findings.push({
            rule: "unknown-grade",
            message: `"${signer.grade}" is not an Army grade in table 6-1.`,
            cite: GRADE_TABLE_CITE,
        });
    }

    // Grade: spelled out for general officers and in every letter. For everyone
    // else on a memorandum the abbreviation is the default, but "in military
    // correspondence, grade abbreviations are optional" (para 6-5c(1)), and
    // figures D-2 and D-14 show both forms - "Lieutenant Colonel, AG" beside
    // "MSG, USA". `spellOut` selects the long form.
    const spelled = spellOutGrade(abbr);
    const mustSpell = isLetter || isGeneralOfficer(abbr) || signer.spellOut === true;
    const gradeText = mustSpell
        ? (spelled ?? signer.grade ?? "")
        : (abbr ?? signer.grade ?? "");

    // Designation, in the order the regulation resolves conflicts: retired
    // status wins, then the GS/IG detail, then the categories that take USA,
    // then the branch.
    //
    // Enlisted personnel take "USA", never a branch abbreviation. Figure D-14
    // shows this throughout - "Command Sergeant Major, USA", "MSG, USA",
    // "SFC, USA" - and a reservist not on active duty takes "USAR" in its
    // place rather than in addition to it (fig D-20).
    let designation;
    if (isEnlisted(abbr) && !signer.retired) {
        designation = signer.reserveNotOnActiveDuty
            ? DESIGNATIONS.reserve
            : (isLetter ? DESIGNATIONS.armyLetters : DESIGNATIONS.army);
    } else if (signer.retired) {
        // "no organization or branch of the Army will be shown" - para 6-6
        designation = DESIGNATIONS.retired;
        if (signer.branch) {
            findings.push({
                rule: "retired-branch",
                message: "Retired personnel show no branch or organization, only \"USA Retired\".",
                cite: "AR 25-50, para 6-6",
            });
        }
    } else if (signer.generalStaff) {
        designation = DESIGNATIONS.generalStaff;
    } else if (signer.inspectorGeneral) {
        designation = DESIGNATIONS.inspectorGeneral;
    } else if (isGeneralOfficer(abbr) || signer.jointCommand || isWarrantOfficer(abbr)) {
        designation = isLetter ? DESIGNATIONS.armyLetters : DESIGNATIONS.army;
    } else if (isLetter) {
        // "Do not use military abbreviations on letters; use 'U.S. Army.'" - 6-4f(1)
        designation = DESIGNATIONS.armyLetters;
    } else {
        designation = signer.branch ?? null;
        if (!designation) {
            findings.push({
                rule: "branch-missing",
                message: "Memorandum signature blocks for commissioned officers use a branch abbreviation on the grade line.",
                cite: "AR 25-50, para 6-4f(2)",
            });
        }
    }

    // "For chaplains, put the grade in parentheses and precede it with the word
    //  'Chaplain'" - para 6-5c(c), for example "Chaplain (CPT) USA".
    let gradeAndBranch;
    if (signer.chaplain) {
        gradeAndBranch = `Chaplain (${abbr ?? signer.grade})${" "}${DESIGNATIONS.army}`;
    } else {
        gradeAndBranch = [gradeText, designation].filter(Boolean).join(", ");
    }

    // "Add the identification 'USAR' after the grade of enlisted personnel or
    //  the branch assignment of commissioned officers." - para 6-7.
    // Enlisted blocks already carry USAR in place of USA, so this appends only
    // for commissioned and warrant officers.
    if (signer.reserveNotOnActiveDuty && !signer.retired && !isEnlisted(abbr)
        && !String(gradeAndBranch).includes(DESIGNATIONS.reserve)) {
        gradeAndBranch = `${gradeAndBranch}, ${DESIGNATIONS.reserve}`;
    }

    return finish(name, gradeAndBranch, signer, findings);
}

function finish(name, gradeAndBranch, signer, findings) {
    // "'Commanding' for commanders to denote the active exercise of
    //  authority." - para 6-4a(3)
    const title = signer.commanding
        ? [signer.title, "Commanding"].filter(Boolean).join("\n")
        : (signer.title ?? "");

    const lines = [name, gradeAndBranch, ...String(title).split("\n")].filter(Boolean);

    // "Civilians will use only a two-line signature block consisting of name
    //  and title, unless a third line is necessary for a long title." - 6-4a note 2
    if (signer.civilian && lines.length > 3) {
        findings.push({
            rule: "civilian-block-length",
            message: "A civilian signature block runs two lines, or three only when the title needs a second line.",
            cite: "AR 25-50, para 6-4a note 2",
        });
    }

    return {name, gradeAndBranch, title, lines, findings};
}

function titleCaseName(name) {
    return String(name ?? "")
        .toLowerCase()
        .replace(/(^|[\s.'-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// ---------------------------------------------------------------------------
// Authority lines - para 6-2 and appendix D
// ---------------------------------------------------------------------------

export const AUTHORITY_LINES = {
    // "Only the SA can approve the signature delegation of 'BY ORDER OF THE
    //  SECRETARY OF THE ARMY.'" - para 6-2d
    secretary: {
        text: "BY ORDER OF THE SECRETARY OF THE ARMY:",
        cite: "AR 25-50, para 6-2d",
        restricted: true,
    },
    // "Documents signed by the commander's staff normally use this authority
    //  line when the document pertains to command policy." - para 6-2e(2)
    commander: {
        text: "FOR THE COMMANDER:",
        cite: "AR 25-50, para 6-2e(2)",
    },
    // "If an agency or staff head delegates signature authority in his or her
    //  area of responsibility, use that authority line." - para 6-2e(1)
    agencyHead: {
        text: (title) => `FOR THE ${String(title).toUpperCase()}:`,
        cite: "AR 25-50, para 6-2e(1)",
    },
};

/**
 * "Omit the authority line on letters and correspondence prepared for the
 *  personal signature of the head of a command, agency, or office. Also, omit
 *  it when the text includes a mandatory phrase." - para 6-2b
 */
export const MANDATORY_PHRASES = [
    /\bThe Secretary of the Army directs\b/i,
    /\bThe Commander desires\b/i,
    /\bThe Commanding Officer\b/i,
    /\bthe Commander[^.]*has asked that I inform you\b/i,
];

export const MANDATORY_PHRASE_CITE = "AR 25-50, para 6-2b";

/**
 * Decide whether an authority line belongs on this memorandum.
 * Returns {required, reason, cite}.
 */
export function authorityLineNeeded({signerIsHead, correspondence = "memorandum", bodyText = ""}) {
    if (correspondence === "letter") {
        return {required: false, reason: "Letters do not carry an authority line.", cite: MANDATORY_PHRASE_CITE};
    }
    if (signerIsHead) {
        return {
            required: false,
            reason: "Correspondence prepared for the personal signature of the head of a command, agency, or office omits the authority line.",
            cite: MANDATORY_PHRASE_CITE,
        };
    }
    const phrase = MANDATORY_PHRASES.find((p) => p.test(bodyText));
    if (phrase) {
        return {
            required: false,
            reason: "The text contains a mandatory phrase, so the authority line is omitted.",
            cite: MANDATORY_PHRASE_CITE,
        };
    }
    return {
        required: true,
        reason: "A person other than the commander signs, so an authority line shows the correspondence expresses the will of the commander.",
        cite: "AR 25-50, para 6-2a",
    };
}
