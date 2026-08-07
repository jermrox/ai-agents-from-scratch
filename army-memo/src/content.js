/**
 * Normalize and lightly validate model-authored memorandum content.
 *
 * Keeps the layout engine safe from odd shapes without teaching the model any
 * formatting. Paragraph levels are clamped to figure 2-1; subjects lose a
 * trailing period; sentence spacing can be normalized for para 1-39b(9).
 */

import {normalizePunctuationSpacing} from "./ar25-50.js";

/**
 * Coerce a draft into the content shape assembleMemo() expects.
 * @param {unknown} raw
 * @param {{normalizeSpacing?: boolean}} [opts]
 */
export function normalizeContent(raw, opts = {}) {
    const src = raw && typeof raw === "object" ? raw : {};
    const normalizeSpacing = opts.normalizeSpacing !== false;

    let subject = String(src.subject ?? "").trim();
    subject = subject.replace(/\.+$/, "").trim();

    const addressees = Array.isArray(src.addressees)
        ? src.addressees.map((a) => String(a ?? "").trim()).filter(Boolean)
        : [];

    const paragraphs = (Array.isArray(src.paragraphs) ? src.paragraphs : [])
        .map((p) => {
            const levelNum = Number(p?.level);
            const level = Number.isFinite(levelNum)
                ? Math.max(0, Math.min(3, Math.round(levelNum)))
                : 0;
            let text = String(p?.text ?? "").replace(/\s*\n\s*/g, " ").trim();
            // Strip accidental hand numbering the model may still emit.
            text = text.replace(/^(?:\d+\.|[a-z]\.|\([0-9]+\)|\([a-z]\))\s+/i, "");
            if (normalizeSpacing) text = normalizePunctuationSpacing(text);
            return {level, text};
        })
        .filter((p) => p.text);

    return {subject, addressees, paragraphs};
}

/** Soft checks that mirror MEMO_CONTENT_SCHEMA beyond JSON Schema. */
export function contentIssues(content) {
    const issues = [];
    if (!content.subject) issues.push("subject is empty");
    else if (content.subject.split(/\s+/).filter(Boolean).length > 10) {
        issues.push("subject exceeds ten words");
    }
    if (!content.paragraphs.length) issues.push("no paragraphs");
    else {
        const last = content.paragraphs[content.paragraphs.length - 1];
        if (last.level !== 0) issues.push("point-of-contact paragraph must be level 0");
        if (!/point of contact|\bpoc\b|contact for this/i.test(last.text)) {
            issues.push("last paragraph should be the point of contact");
        }
    }
    return issues;
}
