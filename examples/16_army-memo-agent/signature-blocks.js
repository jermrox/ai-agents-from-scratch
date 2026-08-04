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
 * Table 6-1 and appendix D disagree about the spelled-out warrant officer
 * grade, and the disagreement is real, not a typo.
 *
 * Table 6-1 carries the numeral: "CW3  Chief Warrant Officer 3". Both figures
 * that spell a warrant officer's grade in a signature block drop it - figure
 * D-13 prints "Chief Warrant Officer, GS" and figure D-10 prints "Warrant
 * Officer, U.S. Army". Neither is a placeholder: the same figures name Major
 * General, Lieutenant General, Colonel, Major and Captain exactly, so the
 * missing numeral is a choice, and it is made twice in two figures.
 *
 * The figures win here because they are examples of the thing being built - a
 * signature block. Table 6-1 stays the authority everywhere else, which is why
 * spellOutGrade() above is unchanged.
 */
export const WARRANT_OFFICER_SIGNATURE_TITLES = {
    CW5: "Chief Warrant Officer",
    CW4: "Chief Warrant Officer",
    CW3: "Chief Warrant Officer",
    CW2: "Chief Warrant Officer",
    WO1: "Warrant Officer",
};
export const WARRANT_OFFICER_TITLE_CITE = "AR 25-50, figs D-10 and D-13 (table 6-1 carries the numeral)";

/** The grade as it is spelled out in a signature block specifically. */
export function spellOutGradeForSignature(grade) {
    const abbr = normalizeGrade(grade);
    if (!abbr) return null;
    return WARRANT_OFFICER_SIGNATURE_TITLES[abbr] ?? GRADE_ABBREVIATIONS[abbr];
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
    reserveLetters: "U.S. Army Reserve",
    retired: "USA Retired",
};

/**
 * Branches that survive onto a letter.
 *
 * "Do not use military abbreviations on letters; use 'U.S. Army.'" - 6-4f(1),
 * and figure D-10 carries no branch at all: "Major, U.S. Army", "Captain,
 * U.S. Army", "Warrant Officer, U.S. Army". Para 6-5c(9) names the exception:
 * "Branch designation should be used in letters only when necessary for
 * credibility. For example, use medical corps or chaplain."
 */
export const LETTER_BRANCH_EXCEPTIONS = ["MC", "CH"];
export const LETTER_BRANCH_CITE = "AR 25-50, paras 6-4f(1), 6-5c(8), and 6-5c(9)";

/**
 * "Army National Guard personnel not on active duty will use the two-letter
 *  State abbreviation followed by 'ARNG'" - para 6-5c(11), for example KSARNG.
 * Title 10 Guard personnel use "USA" instead - para 6-5c(10).
 */
export const nationalGuardDesignation = (state) => `${String(state ?? "").toUpperCase()}ARNG`;
export const NATIONAL_GUARD_CITE = "AR 25-50, paras 6-5c(10) and 6-5c(11)";

/**
 * Para 6-5c(11) adds a second requirement for three categories, and gives no
 * example of it:
 *
 *   "General officers, chaplains, and warrant officers will also use the
 *    four-letter State or territory office symbol."
 *
 * The two-letter form is shown - "KSARNG (Kansas Army National Guard)" - but
 * the four-letter office symbol is not, and none of the appendix D figures in
 * the supplied pages is an ARNG block. So this is reported to the drafter
 * rather than constructed: a four-letter symbol invented here would look
 * exactly as authoritative as a correct one.
 */
export const ARNG_OFFICE_SYMBOL_CATEGORIES = ["general officer", "chaplain", "warrant officer"];
export const ARNG_OFFICE_SYMBOL_CITE = "AR 25-50, para 6-5c(11)";

/**
 * "Do not use the '(P)' (meaning the signer is promotable) as part of a
 *  signature block in Army correspondence unless it benefits or enhances the
 *  image of the Army." - para 6-5c(2)
 */
export const PROMOTABLE = {pattern: /\(P\)/, cite: "AR 25-50, para 6-5c(2)"};

/**
 * The professional-degree abbreviations para 6-8c names or gives as its own
 * examples - "Doctor of Philosophy (Ph.D.), Bachelor of Science (B.S.), and
 * Master of Fine Arts (M.F.A.)" - plus the common credentials that follow the
 * same "letters, periods, comma before" shape. Matched with a word boundary
 * so "B.S." does not fire on ordinary text that happens to contain a "b".
 */
export const DEGREE_ABBREVIATION = /\b(Ph\.?D|Ed\.?D|J\.?D|M\.?D|B\.?A|B\.?S|M\.?A|M\.?S|M\.?B\.?A|M\.?F\.?A)\.?\b/;

/**
 * "The person signing will write his or her own name and add the word 'for' in
 *  front of the typed name in the signature block." - para 6-3c
 *
 * The word is added by hand at signing, so the typed block is unchanged. This
 * is reported rather than rendered, because typing it would be wrong.
 */
export const SIGNING_FOR_ANOTHER = {
    cite: "AR 25-50, para 6-3c",
    instruction: "The person signing writes their own name and adds the word \"for\" by hand in front of the typed name. The typed signature block stays the absent official's and is not changed.",
};

/**
 * Build a signature block.
 *
 * @param {object} signer
 * @param {string} signer.name          Full name as signed. - para 6-3a
 * @param {string} [signer.grade]       "MAJ" or "Major". Omit for civilians.
 * @param {string} [signer.branch]      Branch abbreviation, for example "IN", "AG".
 * @param {string} signer.title         Duty title. - para 6-4a(2)
 * @param {string} [signer.organization] Last line when the letterhead does not
 *                                      carry it. - para 6-5d, fig D-9
 * @param {boolean} [signer.civilian]   Civilian official. - paras 6-4a note 2, 6-8
 * @param {boolean} [signer.commanding] Append "Commanding". - para 6-4a(3)
 * @param {boolean} [signer.acting]     Acting incumbent, so the title becomes
 *                                      "Acting Commander". - para 6-5e(1), fig D-21
 * @param {boolean} [signer.spellOut]   Spell out the grade even when the
 *                                      abbreviation is allowed. - para 6-5c(1), fig D-12
 * @param {boolean} [signer.generalStaff]      Use "GS". - para 6-5c(7)
 * @param {boolean} [signer.inspectorGeneral]  Use "IG". - para 6-5c(7)
 * @param {boolean} [signer.jointCommand]      Use "USA". - para 6-5c(8)
 * @param {boolean} [signer.contractSurgeon]   Use "USA". - para 6-8b
 * @param {boolean} [signer.chaplain]   "Chaplain (MAJ) USA". - para 6-5c(6)
 * @param {boolean} [signer.retired]    "USA Retired", no branch. - para 6-6
 * @param {boolean} [signer.reserveNotOnActiveDuty] Use "USAR". - para 6-7, figs D-20 to D-22
 * @param {boolean} [signer.nationalGuardNotOnActiveDuty] Use "<ST>ARNG". - para 6-5c(11)
 * @param {string}  [signer.state]      Two-letter State, for the ARNG designation.
 * @param {boolean} [signer.signingForAnother] Someone signs for the named
 *                                      official, adding "for" by hand. - para 6-3c
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
        /*
         * "Abbreviations reflecting professional degrees may be used in
         *  civilian signature blocks when dealing with foreign and high-level
         *  officials outside DoD [or in] Army teaching institutions... Do not
         *  use these abbreviations in routine correspondence." - para 6-8c.
         * The exception is the correspondence's context, not the signer's -
         * `foreignOrHighLevelOfficial` and `academicInstitution` name that
         * context rather than describing the person.
         */
        if (DEGREE_ABBREVIATION.test(`${signer.name ?? ""} ${signer.title ?? ""}`)
            && !signer.foreignOrHighLevelOfficial && !signer.academicInstitution) {
            findings.push({
                rule: "degree-abbreviation-routine",
                message: "A degree abbreviation in a civilian signature block is used only for foreign and "
                    + "high-level officials outside DoD, or in Army teaching institutions - not in routine "
                    + "correspondence.",
                cite: "AR 25-50, para 6-8c",
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
    const spelled = spellOutGradeForSignature(abbr);
    const mustSpell = isLetter || isGeneralOfficer(abbr) || signer.spellOut === true;
    const gradeText = mustSpell
        ? (spelled ?? signer.grade ?? "")
        : (abbr ?? signer.grade ?? "");

    // The component designation - the thing that says which Army this signer
    // belongs to. It occupies the slot "USA" would occupy rather than stacking
    // on top of it: figure D-20 is "SFC, USAR", not "SFC, USA, USAR", and the
    // note under figure D-22 says a USAR warrant officer "should always use
    // USAR as their branch". Where a real branch is carried, para 6-7 puts the
    // component after it instead - figure D-21, "MAJ, MC, USAR".
    let component = isLetter ? DESIGNATIONS.armyLetters : DESIGNATIONS.army;
    if (signer.reserveNotOnActiveDuty) {
        component = isLetter ? DESIGNATIONS.reserveLetters : DESIGNATIONS.reserve;
    } else if (signer.nationalGuardNotOnActiveDuty) {
        // "will use the two-letter State abbreviation followed by ARNG" - 6-5c(11)
        if (!signer.state) {
            findings.push({
                rule: "arng-state-missing",
                message: "An Army National Guard signer not on active duty needs the two-letter State abbreviation that precedes \"ARNG\".",
                cite: NATIONAL_GUARD_CITE,
            });
        }
        component = nationalGuardDesignation(signer.state);

        // Three categories owe a second element the regulation does not
        // illustrate anywhere in the supplied pages. - para 6-5c(11)
        const category = isGeneralOfficer(signer.grade) ? "general officer"
            : signer.chaplain ? "chaplain"
            : isWarrantOfficer(signer.grade) ? "warrant officer"
            : null;
        if (category && !signer.stateOfficeSymbol) {
            findings.push({
                rule: "arng-office-symbol-required",
                message: `An Army National Guard ${category} not on active duty also uses the four-letter State or territory office symbol. AR 25-50 gives no example of its form, so it is not constructed here - supply it as \`stateOfficeSymbol\`.`,
                cite: ARNG_OFFICE_SYMBOL_CITE,
            });
        }
    }

    // Designation, in the order the regulation resolves conflicts: retired
    // status wins, then the GS/IG detail, then the categories that carry no
    // branch at all, then the branch itself.
    //
    // Enlisted personnel take the component, never a branch abbreviation.
    // Figure D-14 shows this throughout - "Command Sergeant Major, USA",
    // "MSG, USA", "SFC, USA".
    const branchKeptOnLetter = LETTER_BRANCH_EXCEPTIONS.includes(
        String(signer.branch ?? "").toUpperCase());

    let designation;
    let trailing = null;      // component appended after a real branch, per 6-7
    if (signer.retired) {
        // "no organization or branch of the Army will be shown" - para 6-6
        designation = DESIGNATIONS.retired;
        if (signer.branch) {
            findings.push({
                rule: "retired-branch",
                message: "Retired personnel show no branch or organization, only \"USA Retired\".",
                cite: "AR 25-50, para 6-6",
            });
        }
    } else if (signer.generalStaff || signer.inspectorGeneral) {
        // "In these cases, officers will not use their branch designation."
        //  - para 6-5c(7). Figure D-2 shows this outranks the general-officer
        //  rule: "Major General, GS", not "Major General, USA". Figure D-13
        //  shows it reaching warrant officers: "Chief Warrant Officer, GS".
        designation = signer.generalStaff
            ? DESIGNATIONS.generalStaff
            : DESIGNATIONS.inspectorGeneral;
        if (component !== DESIGNATIONS.army && component !== DESIGNATIONS.armyLetters) {
            trailing = component;
        }
    } else if (isEnlisted(abbr) || isGeneralOfficer(abbr) || isWarrantOfficer(abbr)
               || signer.jointCommand || signer.contractSurgeon) {
        // General officers (6-5c(3)), warrant officers (6-5c(5)), officers at a
        // Joint command headquarters (6-5c(8)), and contract surgeons (6-8b)
        // carry no branch, so the component stands alone.
        designation = component;
    } else if (isLetter && !branchKeptOnLetter) {
        designation = component;
        if (signer.branch) {
            findings.push({
                rule: "letter-branch-dropped",
                message: `A letter carries no branch abbreviation, so "${signer.branch}" is replaced by "${component}". Branch is kept only where credibility requires it, such as medical corps or chaplain.`,
                cite: LETTER_BRANCH_CITE,
            });
        }
    } else {
        designation = signer.branch ?? null;
        if (!designation) {
            findings.push({
                rule: "branch-missing",
                message: "Memorandum signature blocks for commissioned officers use a branch abbreviation on the grade line.",
                cite: "AR 25-50, para 6-4f(2)",
            });
        }
        // "Add the identification 'USAR' after [...] the branch assignment of
        //  commissioned officers." - para 6-7, figure D-21 "MAJ, MC, USAR".
        if (component !== DESIGNATIONS.army && component !== DESIGNATIONS.armyLetters) {
            trailing = component;
        }
    }

    // "For chaplains, put the grade in parentheses and precede it with the word
    //  'Chaplain'" - para 6-5c, for example "Chaplain (CPT) USA". There is no
    //  comma before the designation, unlike every other grade line.
    let gradeAndBranch;
    if (signer.chaplain) {
        if (isLetter) {
            // Figures D-23 and D-24 govern chaplain blocks and are on AR page
            // 93, outside the pages this module was built against. The
            // memorandum form is quoted verbatim in para 6-5c; the letter form
            // is not, so it is reported rather than invented.
            findings.push({
                rule: "chaplain-letter-form-unverified",
                message: "The chaplain signature block on a letter is not specified in the text of AR 25-50. Figures D-23 and D-24 govern it; check them before releasing.",
                cite: "AR 25-50, figs D-23 and D-24",
            });
        }
        const chaplainComponent = signer.retired ? DESIGNATIONS.retired : component;
        gradeAndBranch = `Chaplain (${abbr ?? signer.grade}) ${chaplainComponent}`;
    } else {
        gradeAndBranch = [gradeText, designation, trailing].filter(Boolean).join(", ");
    }

    if (PROMOTABLE.pattern.test(gradeAndBranch)) {
        findings.push({
            rule: "promotable-in-signature",
            message: "Do not use \"(P)\" in a signature block unless it benefits or enhances the image of the Army.",
            cite: PROMOTABLE.cite,
        });
    }

    if (signer.signingForAnother) {
        findings.push({
            rule: "signing-for-another",
            message: SIGNING_FOR_ANOTHER.instruction,
            cite: SIGNING_FOR_ANOTHER.cite,
        });
    }

    return finish(name, gradeAndBranch, signer, findings);
}

function finish(name, gradeAndBranch, signer, findings) {
    // Below the grade line the block is a list of elements, and the difference
    // between them is visible in the figures. A title that will not fit on one
    // line continues indented 1/4 inch (para 6-4c, figure D-13). "Commanding"
    // and the organization are elements in their own right, so they sit flush
    // with the name - figure D-1 and figure D-9. `continuation` records which
    // of the two a segment is; turning that into inches is the renderer's job.
    const segments = titleSegmentsOf(signer.title);

    // "'Commanding' for commanders to denote the active exercise of
    //  authority." - para 6-4a(3). An officer serving in an acting capacity
    //  takes the acting title instead (para 6-5e(1)) - figure D-21 is "Acting
    //  Commander", not "Commanding", and figure D-15 is "Acting First
    //  Sergeant".
    if (signer.commanding) {
        const word = signer.acting ? "Acting Commander" : "Commanding";
        if (!segments.some((s) => s.text === word)) segments.push({text: word, continuation: false});
    }

    // "When the organization is not identified in the letterhead, show it as
    //  the last line of the signature block." - para 6-5d. Figure D-9 is the
    //  officer writing as an individual: "CPT, AR / Co B, 2/34 Armor".
    if (signer.organization) {
        segments.push({text: String(signer.organization), continuation: false});
    }

    const title = segments.map((s) => s.text).join("\n");
    const lines = [name, gradeAndBranch, ...segments.map((s) => s.text)].filter(Boolean);

    // "Civilians will use only a two-line signature block consisting of name
    //  and title, unless a third line is necessary for a long title." - 6-4a note 2
    if (signer.civilian && lines.length > 3) {
        findings.push({
            rule: "civilian-block-length",
            message: "A civilian signature block runs two lines, or three only when the title needs a second line.",
            cite: "AR 25-50, para 6-4a note 2",
        });
    }

    return {name, gradeAndBranch, title, titleSegments: segments, lines, findings};
}

/**
 * A title string split into segments. Line breaks the author put inside the
 * title are continuations of it, so they take the 1/4-inch indent of para
 * 6-4c - figure D-13 sets a three-line title that way, with both continuations
 * indented equally.
 */
function titleSegmentsOf(title) {
    if (!title) return [];
    return String(title).split("\n").map((s) => s.trim()).filter(Boolean)
        .map((text, i) => ({text, continuation: i > 0}));
}

/**
 * Resolve a memorandum's `signature` field into the three elements a block is
 * made of, accepting either a structured `signer` - in which case chapter 6
 * decides the grade line - or the finished elements directly.
 *
 * Each returned segment carries `continuation`, which says whether it is the
 * rest of a title that would not fit on one line - indent it 1/4 inch, per
 * para 6-4c and figure D-13 - or an element in its own right. "Commanding"
 * (para 6-4a(3)) and the organization (para 6-5d) are elements, which is why
 * figure D-1 sets "Commanding" flush with the name and figure D-9 does the
 * same with "Co B, 2/34 Armor". Wrapping a segment that is still too wide is
 * the renderer's job and also continues at 1/4 inch.
 */
export function resolveSignature(sig = {}, correspondence = "memorandum") {
    const built = sig?.signer ? buildSignature(sig.signer, correspondence) : null;
    if (built) {
        return {
            name: built.name,
            gradeAndBranch: built.gradeAndBranch ?? null,
            titleSegments: built.titleSegments,
            findings: built.findings,
        };
    }

    // The elements given directly. A "\n" inside `title` is a title
    // continuation; "Commanding" and the organization have their own fields so
    // they can stay flush without the caller having to know the difference.
    const isLetter = correspondence === "letter";
    // Unsupplied is empty, not a stand-in word. The renderers turn an empty
    // block into click-to-type slots on the lines para 6-4c gives it.
    const rawName = String(sig?.name ?? "");
    const segments = titleSegmentsOf(sig?.title);
    if (sig?.commanding) {
        const word = sig.acting ? "Acting Commander" : "Commanding";
        if (!segments.some((s) => s.text === word)) segments.push({text: word, continuation: false});
    }
    if (sig?.organization) segments.push({text: String(sig.organization), continuation: false});

    return {
        name: isLetter ? rawName : rawName.toUpperCase(),
        gradeAndBranch: sig?.gradeAndBranch ?? null,
        titleSegments: segments,
        findings: [],
    };
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
        // "Note. All SECARMY delegations will be copy furnished to the AASA."
        // - para 6-2d, Note. Not a formatting rule the layout can enforce -
        // it is a routing requirement about who else receives the memorandum
        // - so it is a fact the validator checks for, not something rendered.
        copyFurnished: "AASA",
        copyFurnishedCite: "AR 25-50, para 6-2d, Note",
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
