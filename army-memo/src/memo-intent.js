/**
 * From a request to a memo spec.
 *
 * Two steps sit between what somebody asks for and something the formatter can
 * lay out: deciding which of the memorandum types AR 25-50 defines this is
 * (para 2-2), and merging the words with the facts of record.
 *
 * They live here, apart from the CLI and apart from the front end, because
 * both need them and neither should own them.
 */

import {recordFieldPlaceholders} from "./templates.js";
import {validateMemo, repairInstructions} from "./memo-validator.js";
import {normalizeContent} from "./content.js";

// ---------------------------------------------------------------------------
// The paragraph tree
// ---------------------------------------------------------------------------

/**
 * Rebuild the nested paragraph structure the renderer expects, clamping the
 * depth to the third subdivision (AR 25-50, fig 2-1) and repairing levels that
 * skip a rung.
 */
export function buildParagraphTree(flat) {
    const root = [];
    const stack = [{children: root, level: -1}];

    for (const item of flat ?? []) {
        const requested = Number.isFinite(item.level) ? Math.round(item.level) : 0;
        const level = Math.max(0, Math.min(3, requested));

        // Never let a paragraph jump more than one level deeper than its
        // predecessor - a level 3 directly under a level 0 has no parent.
        while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
        const effective = Math.min(level, stack[stack.length - 1].level + 1);

        const node = {text: (item.text ?? "").trim(), children: []};
        stack[stack.length - 1].children.push(node);
        stack.push({children: node.children, level: effective});
    }

    return prune(root);
}

/** Drop empty children arrays so the tree compares cleanly in tests. */
function prune(nodes) {
    return nodes.map((n) => {
        const children = prune(n.children ?? []);
        return children.length ? {text: n.text, children} : {text: n.text};
    });
}

// ---------------------------------------------------------------------------
// Assembling the full memo
// ---------------------------------------------------------------------------

/**
 * Merge model-authored content with the facts the caller owns. The model never
 * supplies the office symbol, ARIMS number, date, letterhead, or signature -
 * those are matters of record, not of language.
 */
export function assembleMemo(content, context = {}) {
    // Anything the caller does not know becomes a placeholder rather than a
    // plausible-looking default. `letterhead` is compared against undefined
    // because null is a real answer - an MFR is on plain paper (fig 2-17).
    const record = recordFieldPlaceholders();
    const type = context.type ?? "standard";

    /*
     * "MEMORANDUM FOR RECORD" is the whole heading - there is no addressee to
     * put after it, no THRU chain to route it through, and "Do not use an
     * authority line" (fig 2-17 step 6). These are facts about the type, not
     * drafting choices, so they override drafted content and caller context
     * alike - a model or a stale form field that supplied an addressee for
     * an MFR must not have it rendered. Enforced here, once, rather than in
     * every caller that builds a context: CLI and server both build one and
     * had each remembered `authorityLine` but not `addressees`/`thru`,
     * which is exactly how this gap got in.
     *
     * The letterhead is NOT cleared for an MFR: by the owner's direction an
     * MFR is always prepared on the unit's letterhead, seal and header
     * included, exactly like a standard memorandum - fig 2-17's plain-paper
     * example is read as illustrative setup, not a prohibition.
     */
    const isRecord = type === "record";

    return {
        type,
        letterhead: context.letterhead !== undefined ? context.letterhead : record.letterhead,
        // null is a real answer (agreements / letters omit the office symbol).
        officeSymbol: context.officeSymbol !== undefined ? context.officeSymbol : record.officeSymbol,
        date: context.date !== undefined ? context.date : record.date,
        suspenseDate: context.suspenseDate ?? null,
        addressStyle: context.addressStyle ?? "mixed",
        addressees: isRecord ? [] : (content.addressees?.length ? content.addressees : (context.addressees ?? [])),
        thru: isRecord ? [] : (context.thru ?? []),
        seeDistribution: context.seeDistribution ?? false,
        distribution: context.distribution ?? [],
        subject: content.subject,
        paragraphs: buildParagraphTree(content.paragraphs),
        authorityLine: isRecord ? null : (context.authorityLine ?? null),
        signature: context.signature ?? record.signature,
        digitalSignature: context.digitalSignature !== false,
        enclosures: context.enclosures ?? [],
        copiesFurnished: context.copiesFurnished ?? [],
        font: context.font,

        // "Exclusive For" correspondence, appreciation, and commendation
        // address the name and title of a person, not an office (para
        // 2-4a(5)) - carried the same way salutation/complimentaryClose are
        // below: present only when the caller supplies them.
        addresseeTitle: context.addresseeTitle,
        addresseeAddress: context.addresseeAddress,
        toCommanderOf: context.toCommanderOf,

        // The letter's own heading elements - para 3-6a. A memorandum has
        // neither, and carrying them as undefined keeps one spec shape for
        // both vehicles rather than two.
        salutation: context.salutation,
        complimentaryClose: context.complimentaryClose,
        // Names a row in appendix C, so the salutation above can be checked
        // against the form the regulation actually prescribes for it - not
        // carried into layout, only into validation.
        addresseeCategory: context.addresseeCategory,

        // MOU/MOA (para 2-6): parties and dual signature blocks are matters of
        // record supplied by the caller, never by the drafting model.
        parties: context.parties,
        signers: context.signers,
    };
}

// ---------------------------------------------------------------------------
// Reading the request
// ---------------------------------------------------------------------------

/*
 * The record request is the one whose two halves - "memorialize this" and
 * "this is what happened" - can land in either order in ordinary speech: "I
 * had a meeting... need to document it" says the event first, "document my
 * call with range control" says it second. A single ordered regex only
 * catches the second shape. Two lookaheads catch both, because each only
 * asserts its half is present somewhere in the request, not where.
 *
 * Verb suffixes are bounded, not `\w*` - "log" matched loosely enough to eat
 * a suffix would also eat "logistics". Each stem lists only the inflections
 * that are actually this verb: document/documents/documented/documenting,
 * not document plus anything word-shaped after it. "Write up" also takes a
 * pronoun in natural speech - "write *it* up" - so the object is optional
 * between the two halves rather than assumed absent. RECORD_EVENTS' "basis
 * for" is para 2-7a's other named use, alongside "informal meetings or
 * telephone conversations": "the authority or basis for an action taken."
 */
const RECORD_VERBS = "record(?:s|ed|ing)?|document(?:s|ed|ing)?|memorializ(?:e|es|ed|ing)|" +
    "log(?:s|ged|ging)?|captur(?:e|es|ed|ing)|" +
    "wr(?:ite|ites|ote|itten|iting) (?:it |this |that |them )?up";
const RECORD_EVENTS = "calls?|phone calls?|conversations?|meetings?|discussions?|briefings?|" +
    "site visits?|walkthroughs?|staff syncs?|syncs?|decision reached|agreement reached|basis for";
const RECORD_PATTERN = new RegExp(
    `\\bmemorandum for record\\b|\\bmemo for record\\b|\\bmfr\\b|` +
    `(?=.*\\b(?:${RECORD_VERBS})\\b)(?=.*\\b(?:${RECORD_EVENTS})\\b)`);

/**
 * Pick the memorandum type from what the user actually asked for.
 *
 * Deliberately shallow: it reads the request for the phrases that name a type
 * in AR 25-50 and otherwise returns "standard". Getting this wrong is cheap to
 * correct with --template; getting it wrong *silently* would not be, so the
 * chosen type is always printed back.
 */
export function detectMemoType(request = "") {
    const text = String(request).toLowerCase();
    const rules = [
        [/\bmemorandum of agreement\b|\bmoa\b/, "moa"],
        [/\bmemorandum of understanding\b|\bmou\b/, "mou"],
        [RECORD_PATTERN, "record"],
        [/\bdecision memo\w*\b|\bfor decision\b|\bseeking (a )?decision\b|\bapproval memo\w*\b/, "decision"],
        [/\bthru\b|\bthrough the chain of command\b|\bendorse\w*\b/, "thru"],
        [/\bexclusive for\b/, "exclusiveFor"],
        // "commend" alone, bounded, so "recommend"/"recommendation" (no word
        // boundary before the shared "commend" substring) never matches.
        [/\bcommend(?:s|ed|ation|ations)?\b/, "commendation"],
        [/\bappreciation\b/, "appreciation"],
        // Letters are the chapter 3 vehicle: civilian-style address + salutation.
        // Keep this late so "memorandum of ..." phrases win first.
        [/\b(formal |official )?letter\b(?!\s*head)|\bwrite (?:a |an )letter\b|\bsalutation\b/, "letter"],
    ];
    for (const [pattern, type] of rules) {
        if (pattern.test(text)) return type;
    }
    return "standard";
}

// ---------------------------------------------------------------------------
// The draft / validate / repair loop
// ---------------------------------------------------------------------------

/**
 * Draft, render, validate, and re-draft until the content findings clear or the
 * pass budget runs out.
 *
 * `draft` is any async (request, feedback) => content function. The offline demo
 * passes a stub; the live path passes the constrained LLM call. Keeping it a
 * parameter is what makes the loop testable without a model.
 */
export async function runMemoAgent({request, context, draft, maxPasses = 3, onPass}) {
    let content = normalizeContent(await draft(request, null));
    let best = {memo: assembleMemo(content, context)};
    best.result = validateMemo(best.memo);

    for (let pass = 1; pass < maxPasses; pass++) {
        onPass?.({pass, result: best.result, memo: best.memo});

        const instructions = repairInstructions(best.result);
        if (instructions.length === 0) break;

        content = normalizeContent(await draft(request, instructions));
        const memo = assembleMemo(content, context);
        const result = validateMemo(memo);

        // Keep the better draft rather than the latest one - a repair pass can
        // trade one advisory for two, and a stub drafter returns the same text
        // every time.
        if (score(result) >= score(best.result)) break;
        best = {memo, result};
    }

    return best;
}

/** Lower is better: errors dominate, advisories break ties. */
function score(result) {
    return result.errors.length * 100 + result.warnings.length;
}
