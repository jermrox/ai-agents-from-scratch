/**
 * AR 25-50 compliance checker.
 *
 * Every finding carries the paragraph or figure it comes from, so a violation
 * is arguable against the regulation rather than against this code.
 *
 * Findings are split into two classes, and the split is the point of the whole
 * example:
 *
 *   `format`  - the renderer owns these. If one ever fires, memo-formatter.js
 *               has a bug; re-prompting a model would not fix it.
 *   `content` - the author owns these: subject too long, no point of contact,
 *               passive voice, acronyms in the subject line. These are what the
 *               agent feeds back to the LLM for a repair pass.
 */

import {
    LAYOUT,
    TYPE,
    LETTERHEAD,
    WRITING_STANDARDS,
    ARMY_CAPITALIZATION,
    ADDRESS_LIMITS,
    MAX_SUBDIVISION_DEPTH,
    MAX_DEPTH_CITE,
    MEMO_DATE_PATTERN,
    MEMO_DATE_STAMP_PATTERN,
    DATE_FORMAT_CITE,
    TIME,
    POSTSCRIPTS,
    PUNCTUATION_SPACING,
    hasCorrectPunctuationSpacing,
    enclosureLabel,
    ENCLOSURE_CITE,
    COPY_MARKERS,
    SPACING,
} from "./ar25-50.js";

import {layoutMemo, renderText} from "./memo-formatter.js";

function finding(severity, klass, rule, message, cite, extra = {}) {
    return {severity, class: klass, rule, message, cite, ...extra};
}

const error = (...a) => finding("error", ...a);
const warn = (...a) => finding("warning", ...a);

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

function checkHeading(memo, out) {
    if (!memo.officeSymbol) {
        out.push(error("content", "office-symbol-missing",
            "The heading has no office symbol. It identifies the writer's office and is the first element of the heading.",
            "AR 25-50, para 2-4a(1)"));
    } else if (/\s{2,}/.test(memo.officeSymbol)) {
        out.push(warn("content", "office-symbol-crowded",
            "Do not crowd the office symbol line; if the additional information is lengthy, use a second line flush with the left margin.",
            "AR 25-50, para 2-4a(1)"));
    }

    if (!memo.arimsRecordNumber) {
        out.push(warn("content", "arims-missing",
            "No ARIMS record number. Agencies place the appropriate Army record number in parentheses one space after the office symbol (for example, ISES-RM (25-50a)).",
            "AR 25-50, paras 1-5 and 2-4a(2)"));
    }

    if (!memo.date) {
        out.push(error("content", "date-missing",
            "Memorandums must be dated.",
            "AR 25-50, para 2-4a(3)(a)"));
    } else if (!MEMO_DATE_PATTERN.test(memo.date)) {
        const isStamp = MEMO_DATE_STAMP_PATTERN.test(memo.date);
        out.push(isStamp
            ? warn("content", "date-stamp-form",
                `"${memo.date}" is a date-stamp form. A typed memorandum date is written out in full, for example 13 March 2020.`,
                DATE_FORMAT_CITE)
            : error("content", "date-format",
                `"${memo.date}" is not a valid memorandum date. Use "13 March 2020"; the forms "13 Mar 20" and "13 Mar 2020" are for date stamps only.`,
                DATE_FORMAT_CITE));
    }

    if (memo.suspenseDate && !MEMO_DATE_PATTERN.test(memo.suspenseDate) && !MEMO_DATE_STAMP_PATTERN.test(memo.suspenseDate)) {
        out.push(error("content", "suspense-format",
            `Suspense date "${memo.suspenseDate}" is not a valid date form.`,
            "AR 25-50, paras 1-27a and 2-4a(4)"));
    }

    const addressees = memo.addressees ?? [];
    if (addressees.length === 0 && !memo.seeDistribution && memo.type !== "record" && memo.type !== "mou" && memo.type !== "moa") {
        out.push(error("content", "no-addressee",
            "No addressee. Write to the office that is expected to complete the action.",
            "AR 25-50, para 2-4a(5)"));
    }

    if (addressees.length > ADDRESS_LIMITS.seeDistributionAbove && !memo.seeDistribution) {
        out.push(error("format", "see-distribution-required",
            `${addressees.length} addressees exceeds the five-address limit for a multiple-address memorandum; use the SEE DISTRIBUTION format.`,
            ADDRESS_LIMITS.cite));
    }

    if (memo.seeDistribution && !(memo.distribution?.length)) {
        out.push(error("content", "distribution-list-missing",
            "A SEE DISTRIBUTION memorandum must carry a DISTRIBUTION: listing below the signature block or enclosure listing, whichever is lower.",
            "AR 25-50, para 2-4a(5)(c)"));
    }

    // "Type addresses in either all uppercase letters or uppercase and
    //  lowercase letters. Do not mix the two styles. Be consistent." - 2-4a(5)
    if (addressees.length > 1) {
        const allCaps = addressees.map((a) => a === a.toUpperCase());
        if (allCaps.some(Boolean) && !allCaps.every(Boolean)) {
            out.push(error("content", "address-style-mixed",
                "Addresses mix all-uppercase and upper/lowercase styles. Pick one and be consistent.",
                "AR 25-50, para 2-4a(5)"));
        }
    }
}

function checkSubject(memo, out) {
    const subject = (memo.subject ?? "").trim();
    if (!subject) {
        out.push(error("content", "subject-missing", "The memorandum has no subject line.",
            "AR 25-50, para 2-4a(6)"));
        return;
    }

    const words = subject.split(/\s+/);
    if (words.length > WRITING_STANDARDS.subjectMaxWords) {
        out.push(warn("content", "subject-too-long",
            `Subject is ${words.length} words. Use one subject and write it in ${WRITING_STANDARDS.subjectMaxWords} words or less, if possible.`,
            WRITING_STANDARDS.subjectCite));
    }

    // "Avoid using abbreviations in the subject line; however, if the subject
    //  needs more than 10 words, limit the number of words by using commonly
    //  recognized authorized acronyms (for example, DA, DoD, FY, and HQDA)." - 2-4a(6)
    const permitted = new Set(["DA", "DOD", "DoD", "FY", "HQDA", "U.S.", "US"]);
    const acronyms = words.filter((w) => /^[A-Z]{2,}$/.test(w.replace(/[^\w]/g, "")) && !permitted.has(w.replace(/[^\w]/g, "")));
    if (acronyms.length && words.length <= WRITING_STANDARDS.subjectMaxWords) {
        out.push(warn("content", "subject-acronyms",
            `Avoid abbreviations in the subject line: ${acronyms.join(", ")}. They are permitted only to hold a long subject under ten words, and then only commonly recognized ones such as DA, DoD, FY, and HQDA.`,
            "AR 25-50, para 2-4a(6)"));
    }

    if (/[.]$/.test(subject)) {
        out.push(warn("content", "subject-punctuation",
            "The subject line does not take a closing period.",
            "AR 25-50, figs 2-1 through 2-5"));
    }
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

const PASSIVE = /\b(am|is|are|was|were|be|being|been)\s+(?:\w+ly\s+)?(\w+(?:ed|en))\b/gi;

function checkBody(memo, doc, out) {
    const paragraphs = memo.paragraphs ?? [];

    if (paragraphs.length === 0) {
        out.push(error("content", "body-empty", "The memorandum has no body text.",
            "AR 25-50, para 2-4b"));
        return;
    }

    // "Do not number a one-paragraph memorandum." - 2-4b(4)(a)
    // The renderer already honours this; the check guards against a caller
    // hand-numbering the text.
    if (paragraphs.length === 1 && /^\s*1\.\s/.test(paragraphs[0].text ?? "")) {
        out.push(error("content", "one-paragraph-numbered",
            "Do not number a one-paragraph memorandum. Remove the leading \"1.\" - the renderer omits it automatically.",
            "AR 25-50, para 2-4b(4)(a)"));
    }

    for (const p of paragraphs) {
        if (/^\s*\(?\d+[.)]\s|^\s*[a-z][.)]\s/i.test(p.text ?? "")) {
            out.push(warn("content", "manual-numbering",
                `Paragraph text begins with its own label ("${(p.text ?? "").slice(0, 12).trim()}..."). Labels come from the paragraph tree; hand-typed ones will be duplicated.`,
                "AR 25-50, para 2-4b(4)(b)"));
            break;
        }
    }

    const walk = (nodes, depth, path) => {
        // "When a paragraph is subdivided, there must be at least two
        //  subparagraphs. If there is a subparagraph 'a,' there must be a
        //  subparagraph 'b.'" - fig 2-1
        nodes.forEach((node, i) => {
            const here = [...path, i + 1].join(".");
            const kids = node.children ?? [];

            if (kids.length === 1) {
                out.push(error("content", "orphan-subparagraph",
                    `Paragraph ${here} has a single subparagraph. When a paragraph is subdivided there must be at least two: if there is an "a," there must be a "b."`,
                    "AR 25-50, fig 2-1"));
            }

            if (depth > MAX_SUBDIVISION_DEPTH) {
                out.push(error("content", "too-deep",
                    `Paragraph ${here} is at subdivision level ${depth}. Do not subdivide beyond the third subdivision.`,
                    MAX_DEPTH_CITE));
            }

            const text = node.text ?? "";
            if (!hasCorrectPunctuationSpacing(text)) {
                out.push(warn("format", "punctuation-spacing",
                    `Paragraph ${here} does not use ${PUNCTUATION_SPACING.afterSentenceEnd} spaces after ending punctuation; the renderer normalized it.`,
                    PUNCTUATION_SPACING.cite));
            }

            checkArmyCapitalization(text, here, out);
            checkTime(text, here, out);

            if (kids.length) walk(kids, depth + 1, [...path, i + 1]);
        });
    };
    walk(paragraphs, 0, []);

    checkParagraphLength(doc, out);
    checkSentenceLength(paragraphs, out);
    checkPassiveVoice(paragraphs, out);
    checkPointOfContact(paragraphs, out);
    checkPostscript(paragraphs, out);
}

function checkParagraphLength(doc, out) {
    for (const block of doc.bodyBlocks) {
        if (block.lines.length > WRITING_STANDARDS.paragraphMaxLines) {
            out.push(warn("content", "paragraph-too-long",
                `A paragraph runs ${block.lines.length} lines. Write paragraphs that, with few exceptions, are no more than ${WRITING_STANDARDS.paragraphMaxLines} lines.`,
                WRITING_STANDARDS.paragraphCite,
                {excerpt: block.text.slice(0, 60) + "..."}));
        }
    }
}

function collectText(nodes, acc = []) {
    for (const n of nodes) {
        acc.push(n.text ?? "");
        if (n.children?.length) collectText(n.children, acc);
    }
    return acc;
}

function checkSentenceLength(paragraphs, out) {
    const text = collectText(paragraphs).join(" ");
    const sentences = text.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
    if (sentences.length === 0) return;

    const lengths = sentences.map((s) => s.split(/\s+/).length);
    const average = lengths.reduce((a, b) => a + b, 0) / lengths.length;

    if (average > WRITING_STANDARDS.averageSentenceWords + 5) {
        out.push(warn("content", "sentences-long",
            `Average sentence length is ${average.toFixed(1)} words. The average should be about ${WRITING_STANDARDS.averageSentenceWords}.`,
            WRITING_STANDARDS.sentenceCite));
    }

    // "Avoid sentences that begin with 'It is,' 'There is,' or 'There are.'" - 1-39b(8)
    const expletive = sentences.filter((s) => /^(It is|There is|There are)\b/i.test(s));
    for (const s of expletive) {
        out.push(warn("content", "expletive-opening",
            `Avoid sentences that begin with "It is," "There is," or "There are": "${s.slice(0, 50)}..."`,
            "AR 25-50, para 1-39b(8)"));
    }
}

function checkPassiveVoice(paragraphs, out) {
    for (const text of collectText(paragraphs)) {
        PASSIVE.lastIndex = 0;
        const hits = [...text.matchAll(PASSIVE)];
        for (const hit of hits) {
            out.push(warn("content", "passive-voice",
                `Possible passive construction: "${hit[0]}". Active voice is the basic style of Army writing - put the actor before the verb.`,
                WRITING_STANDARDS.activeVoiceCite));
        }
    }
}

/**
 * "Ensure the point of contact line is in the last paragraph of the body." - 2-4b(1)(e)
 * "the writer or point of contact will be identified by military grade or
 *  civilian prefix, first and last name; position and address; phone; and
 *  email address, if appropriate." - 1-23a
 */
function checkPointOfContact(paragraphs, out) {
    const flat = collectText(paragraphs);
    const last = flat[flat.length - 1] ?? "";
    const anywhere = flat.join(" ");

    const looksLikePoc = /point of contact|POC\b/i.test(last);
    if (!looksLikePoc) {
        const elsewhere = /point of contact|POC\b/i.test(anywhere);
        out.push(warn("content", "poc-placement",
            elsewhere
                ? "The point of contact appears in the body but not in the last paragraph."
                : "No point of contact. Identify the writer or point of contact by grade or civilian prefix, first and last name, position, phone, and email.",
            "AR 25-50, paras 1-23a and 2-4b(1)(e)"));
        return;
    }

    if (!/\d{3}[-.\s]?\d{3,4}/.test(last)) {
        out.push(warn("content", "poc-no-phone",
            "The point of contact paragraph gives no telephone number.",
            "AR 25-50, para 1-23a"));
    }
    if (!/@/.test(last)) {
        out.push(warn("content", "poc-no-email",
            "The point of contact paragraph gives no email address.",
            "AR 25-50, para 1-23a"));
    }
}

function checkPostscript(paragraphs, out) {
    for (const text of collectText(paragraphs)) {
        if (POSTSCRIPTS.pattern.test(text)) {
            out.push(error("content", "postscript",
                "Do not use postscripts in Army correspondence.",
                POSTSCRIPTS.cite));
        }
    }
}

function checkArmyCapitalization(text, path, out) {
    for (const word of ARMY_CAPITALIZATION.words) {
        const lower = word.toLowerCase();
        const re = new RegExp(`(?<![\\w-])${lower}(?![\\w-])`, "g");
        if (re.test(text)) {
            out.push(warn("content", "army-capitalization",
                `Paragraph ${path} writes "${lower}" in lowercase. Capitalize "${word}" when it refers to the U.S. Army sense of the word.`,
                ARMY_CAPITALIZATION.cite));
        }
    }
}

function checkTime(text, path, out) {
    if (TIME.prohibitedSuffix.test(text)) {
        out.push(error("content", "time-hours-suffix",
            `Paragraph ${path} writes military time with the word "hours". The word "hours" will not be used in conjunction with military time.`,
            TIME.cite));
    }
    // 12-hour civilian time belongs in letters, not memorandums.
    if (/\b\d{1,2}:\d{2}\s?(a\.?m\.?|p\.?m\.?)/i.test(text)) {
        out.push(error("content", "civilian-time",
            `Paragraph ${path} uses civilian time. Military time is used for memorandums - four digits, 0001 to 2400.`,
            TIME.cite));
    }
}

// ---------------------------------------------------------------------------
// Closing
// ---------------------------------------------------------------------------

function checkClosing(memo, out) {
    const sig = memo.signature ?? {};
    if (!sig.name) {
        out.push(error("content", "signature-missing",
            "The closing has no signature block.",
            "AR 25-50, paras 2-4c(2) and 6-4"));
    } else if (sig.name !== sig.name.toUpperCase()) {
        out.push(error("format", "signature-case",
            "The name in a memorandum signature block is typed in all uppercase letters.",
            "AR 25-50, figs 2-1 through 2-5"));
    }

    if (!sig.title) {
        out.push(warn("content", "signature-title-missing",
            "The signature block gives no title.",
            "AR 25-50, para 6-4"));
    }

    if (memo.authorityLine) {
        const line = String(memo.authorityLine);
        if (line !== line.toUpperCase()) {
            out.push(error("format", "authority-line-case",
                "The authority line is typed at the left margin in uppercase letters.",
                "AR 25-50, para 2-4c(1)"));
        }
        // "Do not use 'FOR THE COMMANDER' on the authority line of technical
        //  channel correspondence." - 1-10c
        if (memo.technicalChannel && /FOR THE COMMANDER/i.test(line)) {
            out.push(error("content", "authority-line-technical-channel",
                "Do not use \"FOR THE COMMANDER\" on the authority line of technical channel correspondence.",
                "AR 25-50, para 1-10c"));
        }
    }

    const encls = memo.enclosures ?? [];
    if (encls.length) {
        const expected = enclosureLabel(encls.length);
        if (memo.enclosureLabel && memo.enclosureLabel !== expected) {
            out.push(error("format", "enclosure-label",
                `Enclosure listing should read "${expected}". For one enclosure use "Encl" without a preceding 1; for more than one use "N Encls".`,
                ENCLOSURE_CITE));
        }
    }

    if (memo.copiesFurnished?.length && memo.copyMarker && memo.copyMarker !== COPY_MARKERS.memorandum) {
        out.push(error("format", "copy-marker",
            `Memorandums use "${COPY_MARKERS.memorandum}"; "${COPY_MARKERS.letter}" is for letters.`,
            COPY_MARKERS.cite));
    }
}

// ---------------------------------------------------------------------------
// Page and media
// ---------------------------------------------------------------------------

function checkPresentation(memo, doc, out) {
    const lh = memo.letterhead ?? {};

    if (!lh.seal) {
        out.push(warn("format", "seal-missing",
            "No DoD seal supplied. All official letterhead stationery will bear the DoD seal; use the letterhead template on the APD website and pass its seal image as letterhead.seal. The renderer draws a labelled placeholder until then.",
            LETTERHEAD.sealCite,
            {template: LETTERHEAD.templateSource}));
    }

    if (lh.additionalInsignia) {
        out.push(error("format", "insignia-prohibited",
            "Do not print any seals, emblems, decorative devices, distinguishing insignia, slogans, office symbols, names, or mottos on letterhead stationery except those approved or directed by HQDA.",
            LETTERHEAD.insigniaCite));
    }

    if (!lh.organization) {
        out.push(warn("content", "letterhead-organization",
            "Letterhead has no organizational name. Letterhead identifies the originating organization and provides the complete standardized mailing address.",
            "AR 25-50, para 1-16a"));
    }

    if (!lh.cityStateZip || !/\d{5}(-\d{4})?/.test(lh.cityStateZip)) {
        out.push(warn("content", "zip-missing",
            "Letterhead has no ZIP code. The ZIP code will be used on all letterhead.",
            "AR 25-50, para 1-35"));
    }

    const font = memo.font ?? {};
    if (font.sizePt && font.sizePt !== TYPE.recommendedSizePt) {
        out.push(warn("format", "font-size",
            `Font size ${font.sizePt} pt. A font with a point size of ${TYPE.recommendedSizePt} is recommended; the choice rests with the organization's senior leader.`,
            TYPE.cite));
    }
    if (font.family && TYPE.forbiddenStyles.some((s) => font.family.toLowerCase().includes(s))) {
        out.push(error("format", "font-style",
            `"${font.family}" is a decorative face. Unusual type styles, such as Script, will not be used in official correspondence.`,
            TYPE.cite));
    }

    if (LAYOUT.justifyRight) {
        out.push(error("format", "right-justified",
            "Do not justify right margins.", LAYOUT.marginsCite));
    }

    const pages = doc.pages.length;
    if (memo.type === "decision" && pages > WRITING_STANDARDS.decisionMemoMaxPages) {
        out.push(error("content", "decision-memo-length",
            `Decision memorandum runs ${pages} pages. It should not exceed ${WRITING_STANDARDS.decisionMemoMaxPages} pages, excluding supporting documents.`,
            WRITING_STANDARDS.decisionMemoCite));
    } else if (pages > WRITING_STANDARDS.preferredPages) {
        out.push(warn("content", "multi-page",
            `Memorandum runs ${pages} pages. Write one-page letters and memorandums for most correspondence; use enclosures for additional information.`,
            WRITING_STANDARDS.pageCite));
    }

    // Continuation-page rules the paginator is responsible for. - 2-5c
    doc.pages.slice(1).forEach((page) => {
        const heading = page.heading ?? [];
        if (!heading.some((l) => l.role === "office-symbol")) {
            out.push(error("format", "continuation-office-symbol",
                `Page ${page.number} does not repeat the office symbol at the left margin 1 inch from the top edge.`,
                "AR 25-50, para 2-5a"));
        }
        if (!heading.some((l) => l.role === "subject")) {
            out.push(error("format", "continuation-subject",
                `Page ${page.number} does not repeat the subject on the line below the office symbol.`,
                "AR 25-50, para 2-5b"));
        }
    });
}

// ---------------------------------------------------------------------------
// Rendered-output checks
// ---------------------------------------------------------------------------

/**
 * Verify the rendered lines against the counts in SPACING. These are the
 * checks that would catch a regression in memo-formatter.js itself.
 */
function checkRenderedSpacing(doc, out) {
    const first = doc.pages[0];
    if (!first) return;

    const lines = first.lines;
    const indexOfRole = (role) => lines.findIndex((l) => l.role === role);

    const officeSymbol = indexOfRole("office-symbol");
    const memoFor = lines.findIndex((l) => l.role === "memorandum-for");
    if (officeSymbol >= 0 && memoFor > officeSymbol) {
        const delta = memoFor - officeSymbol;
        if (delta !== SPACING.officeSymbolToMemorandumFor.linesBelow) {
            out.push(error("format", "spacing-memorandum-for",
                `MEMORANDUM FOR renders on line ${delta} below the office symbol; the regulation places it on the third.`,
                SPACING.officeSymbolToMemorandumFor.cite));
        }
    }

    const subject = indexOfRole("subject");
    const lastAddress = lastIndexOfRoles(lines, ["address", "memorandum-for", "thru"]);
    if (subject >= 0 && lastAddress >= 0) {
        const delta = subject - lastAddress;
        if (delta !== SPACING.addressToSubject.linesBelow) {
            out.push(error("format", "spacing-subject",
                `SUBJECT renders on line ${delta} below the last address line; the regulation places it on the second.`,
                SPACING.addressToSubject.cite));
        }
    }

    const firstBody = lines.findIndex((l) => l.role === "paragraph");
    const lastSubject = lastIndexOfRoles(lines, ["subject"]);
    if (firstBody >= 0 && lastSubject >= 0) {
        const delta = firstBody - lastSubject;
        if (delta !== SPACING.subjectToBody.linesBelow) {
            out.push(error("format", "spacing-body",
                `The body begins on line ${delta} below the subject; the regulation places it on the third.`,
                SPACING.subjectToBody.cite));
        }
    }
}

function lastIndexOfRoles(lines, roles) {
    for (let i = lines.length - 1; i >= 0; i--) {
        if (roles.includes(lines[i].role)) return i;
    }
    return -1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a memo spec against AR 25-50.
 * Returns {compliant, errors, warnings, findings, contentFindings, formatFindings}.
 */
export function validateMemo(memo, options = {}) {
    const out = [];
    const doc = layoutMemo(memo, options);

    checkHeading(memo, out);
    checkSubject(memo, out);
    checkBody(memo, doc, out);
    checkClosing(memo, out);
    checkPresentation(memo, doc, out);
    checkRenderedSpacing(doc, out);

    const errors = out.filter((f) => f.severity === "error");
    const warnings = out.filter((f) => f.severity === "warning");

    return {
        compliant: errors.length === 0,
        findings: out,
        errors,
        warnings,
        contentFindings: out.filter((f) => f.class === "content"),
        formatFindings: out.filter((f) => f.class === "format"),
        pages: doc.pages.length,
    };
}

/** Human-readable report, one line per finding. */
export function formatReport(result) {
    if (result.findings.length === 0) {
        return `AR 25-50 compliance: PASS (${result.pages} page${result.pages === 1 ? "" : "s"}), no findings.`;
    }

    const lines = [
        `AR 25-50 compliance: ${result.compliant ? "PASS with advisories" : "FAIL"} - ` +
        `${result.errors.length} error(s), ${result.warnings.length} advisory(ies), ${result.pages} page(s).`,
        "",
    ];

    for (const f of result.findings) {
        const tag = f.severity === "error" ? "ERROR" : "ADVISORY";
        lines.push(`  [${tag}] ${f.rule} (${f.class})`);
        lines.push(`      ${f.message}`);
        lines.push(`      -> ${f.cite}`);
    }
    return lines.join("\n");
}

/**
 * The subset of findings worth sending back to a language model. Format
 * findings are excluded on purpose: the renderer owns layout, so re-prompting
 * cannot fix them and would only invite the model to hand-format the output.
 */
export function repairInstructions(result) {
    return result.contentFindings.map((f) => `- ${f.message} (${f.cite})`);
}

export {renderText};
