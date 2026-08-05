/**
 * From a form to a memo spec - the pure half of the front end.
 *
 * Everything here takes plain data in and gives a memo spec back: no HTTP,
 * no filesystem, no DOM. That is what lets the same functions serve the Node
 * server (memo-server.js re-exports them) and run unchanged inside a browser
 * bundle - one implementation of "what the form means", wherever the form is.
 */

import {MEMO_TYPES, formatMemoDate, formatLetterDate, ADDRESS_LIMITS, PERSONAL_ADDRESS_TYPES} from "./ar25-50.js";
import {createTemplate, recordFieldPlaceholders} from "./templates.js";
import {detectMemoType, assembleMemo} from "./memo-intent.js";

/**
 * Split a body textarea into the flat {text, level} list buildParagraphTree()
 * nests. One paragraph per blank-line-separated block; indentation is the
 * subdivision level, two spaces or one tab per rung.
 *
 * That is the whole syntax, and it is deliberately not a numbering scheme.
 * Para 2-4b(4)(b) makes the labels the renderer's job - a hand-typed "1."
 * would be duplicated by the one the tab grid puts there - and figure 2-1
 * stops at the third subdivision, which buildParagraphTree() clamps.
 */
export function parseBody(text) {
    const blocks = String(text ?? "").split(/\n[ \t]*\n/).filter((b) => b.trim());

    return blocks.map((block) => {
        const indent = /^[ \t]*/.exec(block)[0].replace(/\t/g, "  ").length;
        const dashed = /^[ \t]*- /.test(block);
        const level = dashed ? Math.max(1, Math.floor(indent / 2)) : Math.floor(indent / 2);
        return {
            level,
            // Soft-wrapped lines inside one block are one paragraph; the
            // renderer breaks lines itself, from Arial metrics.
            text: block.replace(/^[ \t]*- ?/, "").replace(/\s*\n\s*/g, " ").trim(),
        };
    }).filter((p) => p.text);
}

/**
 * The inverse of parseBody(): a paragraph tree back into the textarea syntax,
 * so what the model drafted lands in the form as something you can edit rather
 * than as a finished document you can only accept or discard.
 */
export function bodyFromParagraphs(paragraphs = [], depth = 0) {
    const out = [];
    for (const p of paragraphs) {
        if (p?.text) out.push("  ".repeat(depth) + p.text);
        if (p?.children?.length) out.push(bodyFromParagraphs(p.children, depth + 1));
    }
    return out.join("\n\n");
}

/** A list entry per line, blanks dropped. */
const lines = (text) => String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

/**
 * Build a memo spec from the form. Anything the form leaves empty falls back to
 * the placeholder, never to a plausible-looking value - a memorandum that says
 * [OFFICE SYMBOL] is obviously unfinished, while one that says ATZB-RC because
 * that is what the demo used is wrong in a way nobody notices.
 */
export function specFromForm(form = {}) {
    const record = recordFieldPlaceholders();
    const type = form.type && MEMO_TYPES[form.type] ? form.type : detectMemoType(form.request ?? "");
    const template = createTemplate(type);

    const filled = (value, fallback) => {
        const v = typeof value === "string" ? value.trim() : value;
        return v ? v : fallback;
    };

    const body = parseBody(form.body);
    const letterheadGiven = [form.organization, form.streetAddress, form.cityStateZip].some((v) => v?.trim());

    const context = {
        type,
        officeSymbol: filled(form.officeSymbol, record.officeSymbol),
        // The date defaults to today, military style - owner-directed. Para
        // 2-4a(3)(b) allows adding it after signing instead; typing a
        // different date in the form still overrides.
        date: filled(form.date, formatMemoDate()),
        suspenseDate: filled(form.suspenseDate, null),
        // An unsupplied addressee is a blank like any other, so it falls back
        // to the template's placeholder rather than to nothing. An MFR and an
        // agreement genuinely have no addressee (fig 2-17, para 2-6c(1)) -
        // and template.addressees is already [] or undefined for those, so
        // the fallback lands on the right thing either way.
        addressees: lines(form.addressees).length ? lines(form.addressees) : (template.addressees ?? []),
        thru: lines(form.thru).length ? lines(form.thru) : (template.thru ?? []),
        enclosures: lines(form.enclosures),
        copiesFurnished: lines(form.copiesFurnished),
        authorityLine: filled(form.authorityLine, null),
        signature: {
            name: filled(form.signerName, record.signature.name),
            gradeAndBranch: filled(form.signerGrade, record.signature.gradeAndBranch),
            title: filled(form.signerTitle, record.signature.title),
        },
        // "Exclusive For" correspondence, appreciation, and commendation
        // address the name and title of a person, not an office (para
        // 2-4a(5)) - the same blank-falls-back-to-template's-placeholder
        // treatment as everything else here.
        addresseeTitle: filled(form.addresseeTitle, template.addresseeTitle ?? null),
        addresseeAddress: filled(form.addresseeAddress, template.addresseeAddress ?? null),
        // Blank means "addressed to a named person" - the ordinary case above.
        // Filled in, "Exclusive For" addresses the commander of an office
        // instead (para 1-12b(1)) - there is no template default for it,
        // because most "Exclusive For" correspondence does not use it.
        toCommanderOf: filled(form.toCommanderOf, null),
        // A checkbox submits only when checked, so its absence from the form
        // - not a blank string - is what "unchecked" looks like on the wire.
        digitalSignature: form.digitalSignature !== undefined,
        // Every memorandum, the MFR included, goes out on the unit's
        // letterhead - by the owner's direction an MFR is never prepared
        // without the seal and DEPARTMENT OF THE ARMY header. An agreement
        // is the one plain-paper form (para 2-6c(1)), and its renderer
        // ignores this field.
        letterhead: letterheadGiven ? {
            organization: filled(form.organization, record.letterhead.organization),
            streetAddress: filled(form.streetAddress, record.letterhead.streetAddress),
            cityStateZip: filled(form.cityStateZip, record.letterhead.cityStateZip),
        } : record.letterhead,
    };
    // An MFR takes no authority line - fig 2-17 step 6.
    if (type === "record") context.authorityLine = null;
    // "Exclusive For" correspondence, appreciation, and commendation name one
    // person - only ever addressees[0], both here and in the renderer - so
    // stray extra lines (left over from switching a form out of a type that
    // does take a list) are dropped before validation sees them rather than
    // tripping the multi-recipient checks over data that will never render.
    if (PERSONAL_ADDRESS_TYPES.includes(type)) context.addressees = context.addressees.slice(0, 1);

    /*
     * Para 2-4a(5)(c): more than five addressees is a SEE DISTRIBUTION
     * memorandum, and the DISTRIBUTION: listing it requires carries the same
     * names SEE DISTRIBUTION stands in for - so unless the office wants a
     * different list, the addressees already typed serve as it rather than
     * asking for the same names twice. Only the types that use a real,
     * multi-recipient MEMORANDUM FOR line can trigger this: an MFR and an
     * agreement have no addressee at all, a letter's "address" is one
     * recipient written out in full, and "Exclusive For"/appreciation/
     * commendation each name exactly one person - none of the five can
     * sensibly have "too many" addressees.
     */
    const usesDistribution = !["record", "mou", "moa", "letter"].includes(type)
        && !PERSONAL_ADDRESS_TYPES.includes(type);
    if (usesDistribution) {
        context.distribution = lines(form.distribution);
        context.seeDistribution = context.addressees.length > ADDRESS_LIMITS.seeDistributionAbove
            || context.distribution.length > 0;
        if (context.seeDistribution && !context.distribution.length) context.distribution = context.addressees;
    }

    /*
     * The letter is chapter 3, not chapter 2. Its date is civilian style, it
     * carries no office symbol and no authority line, its salutation is part of
     * the heading, and "digital signatures will not be used on letters" -
     * para 3-6c(2)(b). None of that is a variation on the memorandum, so the
     * memorandum's defaults are cleared rather than adjusted.
     */
    if (type === "letter") {
        context.officeSymbol = null;
        context.authorityLine = null;
        context.digitalSignature = false;
        context.salutation = filled(form.salutation, template.salutation);
        context.complimentaryClose = filled(form.complimentaryClose, template.complimentaryClose);
        context.date = filled(form.date, formatLetterDate());
        // "See appendix C for proper addressing of letters" - para 3-5e. Naming
        // the category here is what lets the salutation be checked against the
        // regulation's own form rather than only against "is something there."
        context.addresseeCategory = filled(form.addresseeCategory, null);
    }

    const memo = assembleMemo({
        subject: String(form.subject ?? "").trim(),
        paragraphs: body.length ? body : template.paragraphs,
        addressees: context.addressees,
    }, context);
    // buildParagraphTree() only nests a flat {text, level} list; a template's
    // paragraphs are already nested, so they are put back as they were.
    if (!body.length) memo.paragraphs = template.paragraphs;

    // The agreement forms carry structure the standard spec has no field
    // for - "parties" instead of an addressee, two signers instead of one
    // signature block (para 2-6c(5)), each falling back to the template's
    // own placeholder field by field, same as everything else on this page.
    if (type === "mou" || type === "moa") {
        memo.parties = lines(form.parties).length ? lines(form.parties) : template.parties;
        memo.signers = [0, 1].map((i) => ({
            name: filled(form[`signer${i + 1}Name`], template.signers[i].name),
            gradeAndBranch: filled(form[`signer${i + 1}Grade`], template.signers[i].gradeAndBranch),
            titleAndAgency: filled(form[`signer${i + 1}Title`], template.signers[i].titleAndAgency),
        }));
    }
    return memo;
}

