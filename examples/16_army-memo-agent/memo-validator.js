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
    ADDRESSING,
    LISTING,
    VALID_STATE_CODES,
    STATE_TABLE_CITE,
    ZIP,
    OVERSEAS_CODES,
    OVERSEAS_CITE,
    checkProtocolOrder,
    PROTOCOL_CITE,
    ALARACT,
    supersedingAuthority,
    SUPERSEDING_AUTHORITY,
    MASS_MAILING,
    letterAudiences,
    LETTER_AUDIENCES,
    APPENDIX_F,
    TABBING,
    checkTabSequence,
    INTERNAL_CORRESPONDENCE,
    hasGeographicAddress,
    HQDA_PRINCIPALS_COLLECTIVE,
    countHqdaPrincipals,
    SEPARATE_COVER,
    bodyMentionsEnclosure,
    MFR_ABBREVIATED,
} from "./ar25-50.js";

import {layoutMemo, renderText, usesLetterhead} from "./memo-formatter.js";
import {findPlaceholders, hasPlaceholders} from "./templates.js";
import {
    buildSignature,
    resolveSignature,
    authorityLineNeeded,
    normalizeGrade,
    isEnlisted,
    GRADE_TABLE_CITE,
} from "./signature-blocks.js";

function finding(severity, klass, rule, message, cite, extra = {}) {
    return {severity, class: klass, rule, message, cite, ...extra};
}

const error = (...a) => finding("error", ...a);
const warn = (...a) => finding("warning", ...a);

/**
 * MOUs and MOAs are the one memorandum form para 2-4 does not govern. Para
 * 2-6c(1) enumerates their heading - centered title, "BETWEEN", the agreeing
 * agencies - and the office symbol and ARIMS record number are not among them.
 * Para 2-6c(5) replaces the single signature block with the agreeing parties'
 * blocks side by side on the same line.
 */
const isAgreement = (memo) => memo?.type === "mou" || memo?.type === "moa";

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

function checkHeading(memo, out) {
    if (!memo.officeSymbol && !isAgreement(memo) && !memo.abbreviated) {
        out.push(warn("content", "not-yet-supplied",
            "Office symbol. Its slot is on the first line of the heading, with the date flush right beside it.",
            "AR 25-50, para 2-4a(1)"));
    } else if (/\s{2,}/.test(memo.officeSymbol)) {
        out.push(warn("content", "office-symbol-crowded",
            "Do not crowd the office symbol line; if the additional information is lengthy, use a second line flush with the left margin.",
            "AR 25-50, para 2-4a(1)"));
    }

    // The abbreviated MFR of figure 2-17 note 7 omits the office symbol, and
    // para 2-4a(3)(b) puts the date "on the same line as the office symbol" -
    // so removing that line removes the date's line with it. The correspondence
    // the MFR is written on carries the date.
    if (memo.abbreviated) {
        // no date line to check
    } else if (!memo.date) {
        // Para 2-4a(3)(b) puts the date on "after the memorandum has been
        // signed", so blank is the normal state of a draft, not a defect.
        out.push(warn("content", "not-yet-supplied",
            "Date. Its slot is flush right on the office symbol line, and it goes on after the memorandum is signed.",
            "AR 25-50, para 2-4a(3)(b)"));
    } else if (hasPlaceholders(memo.date)) {
        // A placeholder is an unfilled field, not a malformed one, and
        // checkPlaceholders already reports it. Complaining about its *format*
        // too would be two findings for one blank, and the wrong one first.
        // Para 2-4a(3)(b) puts the date on after signature anyway.
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

    if (memo.suspenseDate && !hasPlaceholders(memo.suspenseDate)
        && !MEMO_DATE_PATTERN.test(memo.suspenseDate) && !MEMO_DATE_STAMP_PATTERN.test(memo.suspenseDate)) {
        out.push(error("content", "suspense-format",
            `Suspense date "${memo.suspenseDate}" is not a valid date form.`,
            "AR 25-50, paras 1-27a and 2-4a(4)"));
    }

    const addressees = memo.addressees ?? [];
    if (addressees.length === 0 && !memo.seeDistribution && memo.type !== "record" && memo.type !== "mou" && memo.type !== "moa") {
        out.push(warn("content", "not-yet-supplied",
            "Addressee. Its slot follows MEMORANDUM FOR. Write to the office that is expected to complete the action.",
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

    checkAddressingStyle(addressees, out);
    // These apply to a single addressee too, so they run outside
    // checkAddressingStyle, which only concerns multiple-address memorandums.
    checkAddressGeography(addressees, out);
    checkProtocol(addressees, out);

    if (memo.distributionOnSeparatePage && !(memo.distribution?.length)) {
        out.push(error("content", "distribution-page-empty",
            "The memorandum promises a distribution listing on a separate page but supplies no entries.",
            LISTING.separatePageCite));
    }
}

/**
 * Figure 2-6 addressing rules for a multiple-address memorandum:
 *   "Use one of the following [...] a. The full title and address (see figure
 *    2-5). b. Office symbols. [...] Type the office symbol addresses in
 *    uppercase. Do not mix the two authorized types of addressing."
 *   "Because WASH DC and ALEX VA are abbreviations, do not use a comma between
 *    the city and the state."
 */
function checkAddressingStyle(addressees, out) {
    if (addressees.length < 2) return;

    // An office-symbol address opens with an organization and a symbol in
    // parentheses, for example "HQDA (DAMI-XX), 1000 ARMY PENTAGON ...".
    const isOfficeSymbol = (a) => /^[A-Z0-9.\- ]{2,12}\s*\([A-Z0-9-]+\)/.test(String(a).trim());
    const kinds = addressees.map(isOfficeSymbol);

    if (kinds.some(Boolean) && !kinds.every(Boolean)) {
        out.push(error("content", "addressing-types-mixed",
            "Addresses mix the full-title method with the office-symbol method. Use one or the other.",
            ADDRESSING.mixCite));
    }

    if (kinds.every(Boolean)) {
        for (const a of addressees) {
            if (String(a) !== String(a).toUpperCase()) {
                out.push(error("content", "office-symbol-address-case",
                    `Office-symbol addresses are typed in uppercase: "${a}"`,
                    ADDRESSING.mixCite));
                break;
            }
        }
    }

    for (const a of addressees) {
        for (const city of ADDRESSING.abbreviatedCities) {
            const re = new RegExp(`\\b${city}\\s*,\\s*[A-Z]{2}\\b`, "i");
            if (re.test(String(a))) {
                out.push(error("content", "abbreviated-city-comma",
                    `"${city}" is an abbreviation, so no comma goes between the city and the state.`,
                    ADDRESSING.abbreviatedCityCite));
                break;
            }
        }
    }

}

/**
 * State codes and ZIP codes inside an addressee line.
 *
 *   "Use the USPS two-letter abbreviations listed in table 5-3." - para 5-10c
 *   "The ZIP code is a nine-digit number [...] Type the ZIP code two spaces
 *    after the last letter of the State." - para 5-10b
 *   APO/FPO mail "will not have the city or country name placed in the
 *    address." - para 5-10
 */
function checkAddressGeography(addressees, out) {
    for (const a of addressees) {
        const text = String(a);

        // A trailing "XX 12345-6789" is the state-and-ZIP tail.
        const tail = /\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/.exec(text.trim());
        if (!tail) continue;

        const [, code, zip] = tail;
        if (!VALID_STATE_CODES.has(code)) {
            out.push(error("content", "unknown-state-code",
                `"${code}" is not a USPS State or territory abbreviation, nor an overseas code (AE, AP, AA).`,
                STATE_TABLE_CITE));
        }

        if (!zip.includes("-")) {
            out.push(warn("content", "zip-not-plus-four",
                `"${zip}" is a five-digit ZIP. A complete address uses the nine-digit ZIP+4.`,
                ZIP.cite));
        }

        // "Type the ZIP code two spaces after the last letter of the State."
        const spacing = new RegExp(`\\b${code}( +)${zip.replace("-", "\\-")}\\s*$`).exec(text.trim());
        if (spacing && spacing[1].length !== ZIP.spacesAfterState) {
            out.push(warn("format", "zip-spacing",
                `The ZIP code goes ${ZIP.spacesAfterState} spaces after the last letter of the State; the renderer normalized it.`,
                ZIP.cite));
        }

        // APO/FPO addresses carry no city or country name.
        if (/\b(APO|FPO)\b/i.test(text) && Object.keys(OVERSEAS_CODES).includes(code)) {
            const beforeApo = text.split(/\b(?:APO|FPO)\b/i)[0];
            if (/,\s*[A-Za-z][A-Za-z .]{3,}\s*,?\s*$/.test(beforeApo)) {
                out.push(warn("content", "apo-city-name",
                    "Mail addressed to an APO or FPO carries no city or country name; identifying overseas units could breach security.",
                    OVERSEAS_CITE));
            }
        }
    }
}

/**
 * Protocol sequence. AR 25-50 states an order only for the two populations in
 * appendix B - the Office of the Secretary of Defense (fig B-1) and HQDA
 * principal officials (fig B-2) - so addressees outside those lists are
 * ignored rather than reordered on a guess.
 */
function checkProtocol(addressees, out) {
    if (addressees.length < 2) return;
    const result = checkProtocolOrder(addressees);
    if (!result.inOrder) {
        out.push(warn("content", "protocol-order",
            `"${result.offender.addressee}" is listed after "${result.previous.addressee}", but precedes it in the protocol sequence for HQDA principal officials.`,
            PROTOCOL_CITE));
    }
}

function checkSubject(memo, out) {
    // "Omit the office symbol and subject line." - fig 2-17 note 7
    if (memo.abbreviated) {
        return;
    }
    const subject = (memo.subject ?? "").trim();
    if (!subject) {
        out.push(warn("content", "not-yet-supplied",
            "Subject. Its slot follows \"SUBJECT:\" on the second line below the address.",
            "AR 25-50, para 2-4a(6)"));
        return;
    }
    // Still a placeholder: checkPlaceholders reports it, and the style rules
    // below would be judging the placeholder's own wording, not the author's.
    if (hasPlaceholders(subject)) return;

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
            // A `literal` child is a row, not a subparagraph: it carries no
            // letter and its columns are the content. Figure 2-18's approval
            // line and figure 2-18's coordination rows are both of these, and
            // counting them as subparagraphs would demand a "b." for a block
            // the regulation never letters at all.
            const kids = (node.children ?? []).filter((k) => !k.literal);

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
    checkPointOfContact(paragraphs, out, memo);
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

/**
 * Body text with the still-unfilled parts dropped. The style rules of para
 * 1-39 judge the author's prose, and a placeholder is not the author's prose -
 * it is a blank, which checkPlaceholders already reports. Measuring the
 * template's own wording for sentence length or passive voice tells the author
 * nothing and buries the one finding that matters.
 */
function authoredText(paragraphs) {
    return collectText(paragraphs).filter((t) => !hasPlaceholders(t));
}

function checkSentenceLength(paragraphs, out) {
    const text = authoredText(paragraphs).join(" ");
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
    for (const text of authoredText(paragraphs)) {
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
function checkPointOfContact(paragraphs, out, memo) {
    // "Ensure the point of contact line is in the last paragraph of the body."
    //  is para 2-4b(1)(e), a standard-memorandum body rule. Para 2-6c(3) lists
    //  what an agreement's text contains - references, purpose, background,
    //  understandings, effective date, review date - and a point of contact is
    //  not one of them.
    if (isAgreement(memo)) return;

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

    // The paragraph is there but still a template line - [PHONE] and [EMAIL]
    // are exactly the blanks checkPlaceholders reports, so saying the phone
    // number is missing as well is the same fact twice.
    if (hasPlaceholders(last)) return;

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

/**
 * "Use the acronym ALARACT (all Army activities) only in electronically
 *  transmitted messages [...] Do not use it when addressing Army
 *  correspondence." - para 1-13
 */
function checkAlaract(memo, out) {
    const targets = [...(memo.addressees ?? []), ...(memo.thru ?? []),
                     ...(memo.distribution ?? []).map((d) => (typeof d === "string" ? d : d.text))];
    if (targets.some((t) => ALARACT.pattern.test(String(t)))) {
        out.push(error("content", "alaract-in-address",
            "ALARACT is used only in electronically transmitted messages, not when addressing Army correspondence.",
            ALARACT.cite));
    }
}

/**
 * Para 1-6 Note and para 2-2 Note both hand formatting authority to
 * publications that are not AR 25-50 and are not public. When one of them
 * applies, this module cannot claim compliance, so it says so instead of
 * quietly applying AR 25-50 anyway.
 */
function checkSupersedingAuthority(memo, out) {
    const verdict = supersedingAuthority({
        signerTitle: [memo.signature?.title, memo.signature?.titleLines?.join(" ")]
            .filter(Boolean).join(" "),
        originatingOrganization: [memo.letterhead?.organization, memo.letterhead?.title]
            .filter(Boolean).join(" "),
    });
    if (!verdict.superseded) return;

    out.push(warn("content", "superseded-format",
        `AR 25-50's formats do not govern this memorandum: ${verdict.reason}. ` +
        `Format it under ${SUPERSEDING_AUTHORITY.publications.join(" and ")} instead. ` +
        `This tool implements AR 25-50 only, so its output is a starting draft here, not a compliant product.`,
        SUPERSEDING_AUTHORITY.cite));
}

/**
 * "This appendix prescribes special requirements for mass mailings, which are
 *  defined as similar correspondence [...] sent to 20 or more recipients."
 *  - para E-1
 *
 * Appendix E adds no format element, so this cannot be a format finding. It
 * attaches release-authority and review obligations to the organization, which
 * only a human can discharge.
 */
function checkMassMailing(memo, out) {
    const recipients = (memo.addressees ?? []).length + (memo.distribution ?? []).length;
    if (recipients < MASS_MAILING.threshold) return;

    out.push(warn("content", "mass-mailing",
        `This reaches ${recipients} recipients, at or above the ${MASS_MAILING.threshold}-recipient mass-mailing threshold. ` +
        `A named release authority and an error-free review are required before it goes out. ` +
        MASS_MAILING.prohibitions.join(" "),
        MASS_MAILING.cite));
}

/**
 * Para 3-2 reserves a fixed audience to the letter. A memorandum addressed to
 * one of them is the wrong document, which no amount of memorandum formatting
 * fixes - so this reports the vehicle rather than the format.
 */
function checkCorrespondenceVehicle(memo, out) {
    for (const {who, addressee} of letterAudiences(memo.addressees)) {
        out.push(warn("content", "wrong-vehicle",
            `"${addressee}" is ${who}, an audience the letter is used for, not the memorandum. ` +
            `A letter differs in every part - see AR 25-50, chapter 3. This module builds memorandums only.`,
            LETTER_AUDIENCES.cite));
    }
}

/**
 * Appendix F is an Acrobat workflow, not a Word one, so the .docx can never
 * carry the boxes it describes. Two of its requirements change what has to
 * happen after conversion, and neither is visible in the file itself - so they
 * are reported rather than silently left undone.
 */
function checkDigitalSignature(memo, out) {
    if (memo.digitalSignature === false) return;

    if (memo.thru?.length) {
        out.push(warn("content", "thru-signature-boxes",
            `${APPENDIX_F.thru.perAddressee} There ${memo.thru.length === 1 ? "is 1 THRU addressee" : `are ${memo.thru.length} THRU addressees`}, so that many box pairs are needed. ` +
            `They are Acrobat form fields added after the Word file is converted, so this .docx cannot carry them.`,
            APPENDIX_F.thru.cite));
    }

    if ((memo.signatories?.length ?? 0) > 1) {
        out.push(warn("content", "multiple-signature-boxes",
            APPENDIX_F.multipleSigners.rule, APPENDIX_F.multipleSigners.cite));
    }
}

/**
 * Chapter 4's tabbing rules are physical - plastic tabs, blank carrier sheets,
 * positions measured on paper - with one exception that lands in the text:
 *
 *   "To tab a correspondence package forwarded for signature or approval,
 *    identify the tabs in the document. (Tabs may be any letter or number as
 *    long as they are consecutive and fully identified in the text.)" - 4-4a
 *
 * Both halves of that parenthesis are checkable, so both are checked.
 */
function checkTabbing(memo, out) {
    const bodyText = collectText(memo.paragraphs ?? []).join(" ");
    const seq = checkTabSequence(memo.tabs ?? [], bodyText);

    if (seq.labels.length) {
        if (seq.mixedKinds) {
            out.push(error("content", "tab-labels-mixed",
                `Tab labels mix letters and numbers: ${seq.labels.join(", ")}. Tabs may be any letter or number, but one kind throughout.`,
                TABBING.packageCite));
        } else if (!seq.consecutive) {
            out.push(error("content", "tab-labels-not-consecutive",
                `Tab labels ${seq.labels.join(", ")} are not consecutive.`,
                TABBING.packageCite));
        }
        if (seq.unmentioned.length) {
            out.push(error("content", "tab-not-identified",
                `The body never identifies ${seq.unmentioned.length === 1 ? "tab" : "tabs"} ${seq.unmentioned.join(", ")}. Every tab is fully identified in the text.`,
                TABBING.packageCite));
        }
    }

    // "When sending an enclosure separately from the correspondence, write it
    //  in the body of the correspondence and add a short note to the enclosure
    //  when forwarded." - para 4-2d(2)
    for (const e of memo.enclosures ?? []) {
        if (typeof e === "string" || !e.forwardedSeparately) continue;
        const title = e.title ?? "";
        if (!bodyMentionsEnclosure(title, bodyText)) {
            out.push(error("content", "separate-cover-not-in-body",
                `"${title}" is forwarded separately, so the body has to say so. Nothing in the text mentions it.`,
                SEPARATE_COVER.cite));
        }
        out.push(warn("content", "separate-cover-note",
            `"${title}" is forwarded separately. ${SEPARATE_COVER.note}`,
            SEPARATE_COVER.cite));
    }

    // "If the correspondence has three or more enclosures, tab each one." - 4-3
    const encls = memo.enclosures ?? [];
    if (encls.length >= TABBING.tabWhenEnclosuresAtLeast && seq.labels.length === 0) {
        out.push(warn("content", "enclosures-need-tabs",
            `${encls.length} enclosures. Correspondence with three or more enclosures has each one tabbed, and each enclosure's first page is marked "${TABBING.stampEachEnclosure(1)}" and so on at the lower right corner.`,
            `${TABBING.cite}; ${TABBING.stampCite}`));
    }
}

/**
 * Two figure notes that suppress the geographic address, and one that
 * collapses a long list of HQDA principals into a single line.
 */
function checkInternalAddressing(memo, out) {
    const addressees = memo.addressees ?? [];

    const internal = INTERNAL_CORRESPONDENCE[memo.internalTo];
    if (internal) {
        for (const a of addressees) {
            if (hasGeographicAddress(a)) {
                out.push(error("content", "geographic-address-on-internal",
                    `This is ${internal.description}, so the full geographic location is omitted: "${a}"`,
                    internal.cite));
            }
        }
    } else if (memo.internalTo) {
        out.push(warn("content", "unknown-internal-scope",
            `"${memo.internalTo}" is not a case the regulation defines. The two that suppress the geographic address are ${Object.keys(INTERNAL_CORRESPONDENCE).join(" and ")}.`,
            INTERNAL_CORRESPONDENCE.armyStaff.cite));
    }

    // Figure 2-8 names them collectively rather than one by one, which also
    // keeps the list under the five-address limit of para 2-4a(5)(c).
    const principals = countHqdaPrincipals(addressees);
    if (principals >= 3) {
        out.push(warn("content", "hqda-principals-collective",
            `${principals} of the addressees are HQDA principal officials. Figure 2-8 addresses them as one line, "${HQDA_PRINCIPALS_COLLECTIVE.text}", which para B-2 defines as all the positions in figure B-2.`,
            HQDA_PRINCIPALS_COLLECTIVE.cite));
    }
}

/**
 * The abbreviated MFR of figure 2-17 note 7 - written at the foot of somebody
 * else's correspondence. It is the only memorandum in chapter 2 that carries
 * neither an office symbol nor a subject line, so the ordinary heading checks
 * would demand both.
 */
function checkAbbreviatedMfr(memo, out) {
    if (!memo.abbreviated) return;

    if (memo.type !== "record") {
        out.push(error("content", "abbreviated-not-mfr",
            `Only a memorandum for record has an abbreviated form; this is a ${memo.type} memorandum.`,
            MFR_ABBREVIATED.cite));
        return;
    }
    for (const field of MFR_ABBREVIATED.omits) {
        if (memo[field] && !hasPlaceholders(memo[field])) {
            out.push(error("content", "abbreviated-mfr-extra-field",
                `An abbreviated MFR omits the ${field === "officeSymbol" ? "office symbol" : "subject line"}; "${memo[field]}" was supplied.`,
                MFR_ABBREVIATED.cite));
        }
    }
    out.push(warn("content", "abbreviated-mfr-placement",
        `An abbreviated MFR begins ${MFR_ABBREVIATED.linesBelowPrecedingCorrespondence} lines below the last line of the correspondence it is written on. Nothing above it belongs to this memorandum.`,
        MFR_ABBREVIATED.cite));
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
    // The block as it will actually be rendered - resolveSignature() accepts
    // either the structured signer or the finished elements, so this checks
    // what reaches the page rather than which form the caller happened to use.
    const raw = memo.signature ?? {};
    const sig = resolveSignature(raw);
    const suppliedName = raw.signer ? raw.signer.name : raw.name;

    if (isAgreement(memo)) {
        // "the signature blocks of the agreeing agencies' parties appear on
        //  the same line" - para 2-6c(5)
        const signers = memo.signers ?? [];
        if (signers.length < 2) {
            out.push(error("content", "agreement-signers-missing",
                `An agreement carries one signature block per agreeing party, side by side; ${signers.length} supplied.`,
                "AR 25-50, para 2-6c(5)"));
        }
    } else if (!suppliedName) {
        out.push(warn("content", "not-yet-supplied",
            "Signature block. Its three slots are at the centre of the page on the fifth line below the text.",
            "AR 25-50, paras 2-4c(2)(a) and 6-4c"));
    } else if (sig.name !== sig.name.toUpperCase()) {
        out.push(error("format", "signature-case",
            "The name in a memorandum signature block is typed in all uppercase letters.",
            "AR 25-50, figs 2-1 through 2-5"));
    }

    // Figure D-14 shows four noncommissioned officer blocks with no title at
    // all, so the title is only expected where the block is not a bare
    // name-and-grade pair.
    if (suppliedName && sig.titleSegments.length === 0
        && !isEnlisted(raw.signer?.grade) && !isAgreement(memo)) {
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

    // The seal ships with the example and is applied automatically, so this
    // only fires if a caller explicitly cleared it.
    if (lh.seal === null && usesLetterhead(memo)) {
        out.push(error("format", "seal-missing",
            "Letterhead carries no seal. All official letterhead stationery will bear the department seal.",
            LETTERHEAD.sealCite,
            {template: LETTERHEAD.templateSource}));
    }

    if (lh.additionalInsignia) {
        out.push(error("format", "insignia-prohibited",
            "Do not print any seals, emblems, decorative devices, distinguishing insignia, slogans, office symbols, names, or mottos on letterhead stationery except those approved or directed by HQDA.",
            LETTERHEAD.insigniaCite));
    }

    if (!lh.organization && usesLetterhead(memo)) {
        out.push(warn("content", "letterhead-organization",
            "Letterhead has no organizational name. Letterhead identifies the originating organization and provides the complete standardized mailing address.",
            "AR 25-50, para 1-16a"));
    }

    if (usesLetterhead(memo) && (!lh.cityStateZip || !/\d{5}(-\d{4})?/.test(lh.cityStateZip))) {
        out.push(warn("content", "zip-missing",
            "Letterhead has no ZIP code. The ZIP code will be used on all letterhead.",
            "AR 25-50, para 1-35"));
    }

    const font = memo.font ?? {};
    if (font.sizePt > TYPE.maxSizePt) {
        out.push(error("format", "font-too-large",
            `Font size ${font.sizePt} pt exceeds the ${TYPE.maxSizePt} pt ceiling for body type.`,
            TYPE.maxSizeCite));
    } else if (font.sizePt && font.sizePt !== TYPE.recommendedSizePt) {
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
        if (!heading.some((l) => l.role === "office-symbol") && !isAgreement(memo)) {
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

    // The third-line rule governs whichever line opens the address block. On a
    // THRU memorandum that is MEMORANDUM THRU - figures 2-11 and 2-12 put the
    // THRU chain first and the action office on a FOR line below it, so
    // measuring FOR against the office symbol would demand line 3 for a line
    // the regulation never puts there.
    const opener = lines.findIndex((l) => l.role === "thru" || l.role === "memorandum-for");
    if (officeSymbol >= 0 && opener > officeSymbol) {
        const delta = opener - officeSymbol;
        const label = lines[opener].role === "thru" ? "MEMORANDUM THRU" : "MEMORANDUM FOR";
        if (delta !== SPACING.officeSymbolToMemorandumFor.linesBelow) {
            out.push(error("format", "spacing-memorandum-for",
                `${label} renders on line ${delta} below the office symbol; the regulation places it on the third.`,
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
// Memorandum type rules
// ---------------------------------------------------------------------------

/**
 * Rules that only bind particular memorandum types, which is where most real
 * mistakes happen - an MFR on letterhead with an authority line looks perfectly
 * correct until you check figure 2-17.
 */
function checkMemoType(memo, out) {
    if (memo.type === "record") {
        // "Type the MFR on plain white paper." - fig 2-17
        // Tested against the spec, not usesLetterhead(): the renderer already
        // forces plain paper for an MFR, so asking it would always say "no
        // letterhead" and the mistake in the spec would go unreported.
        if (memo.letterhead != null) {
            out.push(error("format", "mfr-letterhead",
                "A memorandum for record is typed on plain white paper, not letterhead. Set letterhead to null.",
                "AR 25-50, fig 2-17"));
        }
        // "Do not use an authority line. Anyone may prepare and sign an MFR." - fig 2-17
        if (memo.authorityLine) {
            out.push(error("content", "mfr-authority-line",
                "A memorandum for record does not carry an authority line; anyone may prepare and sign an MFR.",
                "AR 25-50, fig 2-17"));
        }
        if (memo.addressees?.length) {
            out.push(error("format", "mfr-addressee",
                "A memorandum for record is addressed MEMORANDUM FOR RECORD and takes no addressee.",
                "AR 25-50, fig 2-17"));
        }
    }

    // "Do not address memorandums to more than two THRU addressees unless it is
    //  absolutely necessary." - fig 2-12
    if ((memo.thru?.length ?? 0) > 2) {
        out.push(warn("content", "thru-count",
            `${memo.thru.length} THRU addressees. Do not address memorandums to more than two unless it is absolutely necessary.`,
            "AR 25-50, fig 2-12"));
    }

    if (memo.type === "decision") {
        // The skeleton is fixed by fig 2-18.
        const headings = ["FOR DECISION", "PURPOSE", "RECOMMENDATION", "BACKGROUND",
                          "DISCUSSION", "IMPACT", "COORDINATION"];
        const text = collectText(memo.paragraphs ?? []).join(" ").toUpperCase();
        const missing = headings.filter((h) => !text.includes(h));
        if (missing.length) {
            out.push(warn("content", "decision-memo-skeleton",
                `The decision memorandum is missing these paragraphs: ${missing.join(", ")}.`,
                "AR 25-50, para 2-8b and fig 2-18"));
        }
    }

    if ((memo.type === "mou" || memo.type === "moa") && (memo.signers?.length ?? 0) < 2) {
        out.push(error("content", "agreement-signers",
            "An MOU or MOA carries the signature block of each agreeing agency, in protocol order with the senior official on the right.",
            "AR 25-50, para 2-6c(5)"));
    }
}

/**
 * Signature-block formalities from chapter 6, delegated to signature-blocks.js
 * so the rules live next to the grade table they depend on.
 */
function checkSignatureFormalities(memo, out) {
    const sig = memo.signature;
    if (!sig) return;

    if (sig.gradeAndBranch && !hasPlaceholders(sig.gradeAndBranch)) {
        const first = String(sig.gradeAndBranch).split(",")[0].trim();
        // Only check tokens that look like a grade attempt.
        if (/^[A-Za-z0-9]{2,4}$/.test(first) && !normalizeGrade(first)) {
            out.push(warn("content", "grade-not-in-table",
                `"${first}" is not an Army grade abbreviation in table 6-1.`,
                GRADE_TABLE_CITE));
        }
    }

    if (sig.signer) {
        const built = buildSignature(sig.signer, "memorandum");
        for (const f of built.findings) {
            out.push(warn("content", f.rule, f.message, f.cite));
        }
    }

    const decision = authorityLineNeeded({
        signerIsHead: memo.signerIsHead ?? false,
        bodyText: collectText(memo.paragraphs ?? []).join(" "),
    });
    if (!decision.required && memo.authorityLine && memo.type !== "record") {
        out.push(warn("content", "authority-line-unnecessary",
            `${decision.reason} Remove the authority line.`, decision.cite));
    }
}

/**
 * Unfilled template placeholders. Not a regulation rule - a workflow one. A
 * memorandum that still says [FULL NAME] is not ready to sign, and this is the
 * check that stops it reaching the staffing folder.
 */
function checkPlaceholders(memo, out) {
    const spots = findPlaceholders({
        officeSymbol: memo.officeSymbol,
        // The date is the placeholder most likely to survive to the staffing
        // folder, because para 2-4a(3)(b) means it is *supposed* to be blank
        // until the memorandum is signed. That makes reporting it more
        // important than the others, not less.
        date: memo.date,
        suspenseDate: memo.suspenseDate,
        subject: memo.subject,
        addressees: memo.addressees,
        thru: memo.thru,
        paragraphs: memo.paragraphs,
        signature: memo.signature,
        letterhead: memo.letterhead,
        enclosures: memo.enclosures,
    });

    for (const spot of spots) {
        out.push(warn("content", "unfilled-placeholder",
            `${spot.path} still holds template placeholders: ${spot.placeholders.join(", ")}`,
            "template not yet filled in"));
    }
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
    checkMemoType(memo, out);
    checkSignatureFormalities(memo, out);
    checkPlaceholders(memo, out);
    checkAlaract(memo, out);
    checkSupersedingAuthority(memo, out);
    checkMassMailing(memo, out);
    checkCorrespondenceVehicle(memo, out);
    checkDigitalSignature(memo, out);
    checkTabbing(memo, out);
    checkInternalAddressing(memo, out);
    checkAbbreviatedMfr(memo, out);

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
