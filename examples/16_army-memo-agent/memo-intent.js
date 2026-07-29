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

    return {
        type: context.type ?? "standard",
        letterhead: context.letterhead !== undefined ? context.letterhead : record.letterhead,
        officeSymbol: context.officeSymbol ?? record.officeSymbol,
        arimsRecordNumber: context.arimsRecordNumber ?? record.arimsRecordNumber,
        date: context.date ?? record.date,
        suspenseDate: context.suspenseDate ?? null,
        addressStyle: context.addressStyle ?? "mixed",
        addressees: content.addressees?.length ? content.addressees : (context.addressees ?? []),
        thru: context.thru ?? [],
        seeDistribution: context.seeDistribution ?? false,
        distribution: context.distribution ?? [],
        subject: content.subject,
        paragraphs: buildParagraphTree(content.paragraphs),
        authorityLine: context.authorityLine ?? null,
        signature: context.signature ?? record.signature,
        digitalSignature: context.digitalSignature !== false,
        enclosures: context.enclosures ?? [],
        copiesFurnished: context.copiesFurnished ?? [],
        font: context.font,
    };
}

// ---------------------------------------------------------------------------
// Reading the request
// ---------------------------------------------------------------------------

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
        [/\bmemorandum for record\b|\bmfr\b|\b(record|document|memorialize|write up)\b[^.]*\b(call|phone call|conversation|meeting|discussion|decision reached|agreement reached)\b/, "record"],
        [/\bdecision memo\w*\b|\bfor decision\b|\bseeking (a )?decision\b|\bapproval memo\w*\b/, "decision"],
        [/\bthru\b|\bthrough the chain of command\b|\bendorse\w*\b/, "thru"],
    ];
    for (const [pattern, type] of rules) {
        if (pattern.test(text)) return type;
    }
    return "standard";
}
