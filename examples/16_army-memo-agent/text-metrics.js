/**
 * Type metrics for the layout engine.
 *
 * AR 25-50 states every horizontal measurement in inches - 1-inch margins
 * (para 2-3c), 1/4- and 1/2-inch subparagraph indents (fig 2-1), 1/4 inch to
 * the right of the parenthesis (para 1-39b(10)). Measuring line length in
 * characters would only be correct for a monospace face, and para 1-19
 * recommends a 12-point proportional font.
 *
 * So lines are broken in inches using real advance widths. The plain-text
 * backend then displays those same breaks on a character grid; it is a preview
 * of the real document rather than a second, different layout.
 *
 * Widths are the standard Helvetica AFM advance widths in 1/1000 em. Arial is
 * metrically compatible with Helvetica, which is why Word substitutes one for
 * the other without reflowing a document.
 */

const HELVETICA_WIDTHS = {
    " ": 278, "!": 278, '"': 355, "#": 556, $: 556, "%": 889, "&": 667, "'": 191,
    "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
    0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556,
    ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015,
    A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
    J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
    S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
    "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333,
    a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222,
    j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333,
    s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
    "{": 334, "|": 260, "}": 334, "~": 584,
};

/** Bold faces are wider; this is the Helvetica-Bold delta, close enough for layout. */
const BOLD_SCALE = 1.055;

const DEFAULT_WIDTH = 556; // unmapped glyphs fall back to digit width

/**
 * Width of `text` in inches at `sizePt`.
 * 1 point = 1/72 inch; AFM widths are thousandths of an em.
 */
export function measureTextIn(text, sizePt, {bold = false} = {}) {
    let units = 0;
    for (const ch of String(text)) {
        units += HELVETICA_WIDTHS[ch] ?? DEFAULT_WIDTH;
    }
    const inches = (units / 1000) * (sizePt / 72);
    return bold ? inches * BOLD_SCALE : inches;
}

/**
 * Split text into tokens that remember the whitespace that preceded them.
 *
 * This is what keeps para 1-39b(9) alive through a line break: the two spaces
 * after a sentence-ending period are carried on the following token, so
 * rejoining tokens reproduces the spacing exactly instead of collapsing it to
 * a single space.
 */
export function tokenize(text) {
    const tokens = [];
    const re = /(\s*)(\S+)/g;
    let m;
    while ((m = re.exec(String(text))) !== null) {
        tokens.push({separator: m[1] ?? "", word: m[2]});
    }
    return tokens;
}

/**
 * Break `text` into lines that fit the available width.
 *
 * `widthForLine(lineIndex)` returns the inches available on that line, which is
 * how the first-line indent and the flush-left wrap of AR 25-50 are expressed:
 * line 0 is narrower by the indent, every later line gets the full measure.
 *
 * Returns [{text, indentIn}] with the separator preserved between words and
 * stripped at a break.
 */
export function breakLines(text, {sizePt, widthForLine, indentForLine, bold = false}) {
    const tokens = tokenize(text);
    if (tokens.length === 0) return [{text: "", indentIn: indentForLine(0)}];

    const lines = [];
    let index = 0;
    let current = "";

    const push = () => {
        lines.push({text: current, indentIn: indentForLine(index)});
        index++;
        current = "";
    };

    for (const {separator, word} of tokens) {
        if (current === "") {
            // A word longer than the measure still has to go somewhere; the
            // regulation forbids hyphenating across pages (para 2-5c(3)) and
            // says nothing about breaking one mid-line, so it stays whole.
            current = word;
            continue;
        }
        const candidate = current + separator + word;
        if (measureTextIn(candidate, sizePt, {bold}) <= widthForLine(index)) {
            current = candidate;
        } else {
            push();
            current = word;
        }
    }
    push();
    return lines;
}

export {HELVETICA_WIDTHS};
