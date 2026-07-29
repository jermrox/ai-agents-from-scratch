# Code explanation: `army-memo-agent.js`

Nine files, each with one job:

| File | Responsibility |
| --- | --- |
| `ar25-50.js` | The regulation, codified. Constants, each carrying its paragraph citation. No logic beyond formatting helpers. |
| `text-metrics.js` | Arial/Helvetica advance widths, tokenizing, line breaking in inches. |
| `memo-formatter.js` | Layout engine plus two preview backends: plain text and print-ready HTML. |
| `memo-docx.js` | **The deliverable.** Word output: exact type, margins, tab stops, running heads, and a formatting lock. |
| `signature-blocks.js` | Chapter 6 formalities: table 6-1 grades, GS/IG, general officers, civilians, retired, USAR, authority lines. |
| `templates.js` | One editable skeleton per memorandum type, with `[BRACKETED]` placeholders. |
| `memo-validator.js` | Compliance checks. Every finding cites AR 25-50 and is tagged `content` or `format`. |
| `army-memo-agent.js` | Intent detection, the draft/validate/repair loop, and the CLI. |
| `verify.js` | Asserts the renderer *and the .docx* against the regulation's own figures. |

## Run

```bash
# List the memorandum types and the paragraph that governs each
node examples/16_army-memo-agent/army-memo-agent.js --list-types

# Start from an editable template and produce the Word deliverable
node examples/16_army-memo-agent/army-memo-agent.js --template decision \
    --docx decision-memo.docx --emit-spec decision-memo.json

# Fill in decision-memo.json, then render it again - same layout, your text
node examples/16_army-memo-agent/army-memo-agent.js --spec decision-memo.json \
    --docx decision-memo.docx

# No model required - canned content through the real formatter and validator
node examples/16_army-memo-agent/army-memo-agent.js --offline

# Check the renderer and the .docx against AR 25-50's own figures
node examples/16_army-memo-agent/verify.js

# With a local model, letting it pick the memorandum type from the request
node examples/16_army-memo-agent/army-memo-agent.js --docx memo.docx \
    "Notify subordinate battalions that Range 14 closes for maintenance 3-7 August 2026."
```

| Flag | Effect |
| --- | --- |
| `--template <type>` | Start from an editable skeleton: `standard`, `thru`, `record`, `decision`, `mou`, `moa` |
| `--spec <file.json>` | Render a spec you have already filled in |
| `--emit-spec <file.json>` | Write the spec out so you can edit it |
| `--docx <path>` | Word deliverable |
| `--html <path>` / `--text <path>` | Previews |
| `--seal <path>` | The DoD seal image, once (see `assets/README.md`) |
| `--offline` | Skip the model |

The live path needs `models/Qwen3-1.7B-Q8_0.gguf` (see [DOWNLOAD.md](../../DOWNLOAD.md)). Everything except the drafting step runs without a model, which is the point - the parts that must be exactly right are the parts that do not need one.

---

## 1) The regulation as data

`ar25-50.js` holds no cleverness. It holds the regulation, with the citation attached to each value so a finding can be argued against AR 25-50 rather than against this code:

```javascript
export const SPACING = {
    // "Type 'MEMORANDUM FOR' on the third line below the office symbol." - 2-4a(5)
    officeSymbolToMemorandumFor: {linesBelow: 3, cite: "AR 25-50, para 2-4a(5)"},

    // "Begin the signature block in the center of the page on the fifth line
    //  below the authority line." - 2-4c(2)(a)
    authorityLineToSignature: {linesBelow: 5, cite: "AR 25-50, para 2-4c(2)(a)"},
};
```

Vertical placement stays in the regulation's own units - *lines below* - and horizontal placement stays in inches. Neither is converted until render time. `linesBelow: 3` means two blank lines, because the regulation counts the target line itself:

```javascript
function gap(spacing) {
    return blank(Math.max(0, spacing.linesBelow - 1));
}
```

Getting this off by one is the single easiest way to produce a memo that is wrong everywhere, which is why it lives in one function.

---

## 2) Line breaking that preserves the spec

The 2024 revision of para 1-39b(9) requires **two** spaces after a period or question mark and **one** after a comma, colon, or semicolon. A conventional word wrapper destroys this on the first line break:

```javascript
text.split(/\s+/).join(" ")   // "2026.  Reschedule" becomes "2026. Reschedule"
```

`tokenize()` keeps the whitespace that preceded each token, so rejoining reproduces it exactly:

```javascript
export function tokenize(text) {
    const tokens = [];
    const re = /(\s*)(\S+)/g;
    let m;
    while ((m = re.exec(String(text))) !== null) {
        tokens.push({separator: m[1] ?? "", word: m[2]});
    }
    return tokens;
}
```

Lines break in **inches**, not characters, because every measurement in the regulation is an inch and para 1-19 recommends a proportional 12-point face:

```javascript
const candidate = current + separator + word;
if (measureTextIn(candidate, sizePt) <= widthForLine(index)) {
    current = candidate;
} else {
    push();          // separator is dropped at a break, which is correct
    current = word;
}
```

`widthForLine(index)` is how the AR 25-50 wrap rule is expressed. Line 0 loses the indent and the label; every later line gets the full 6.5 inches, because **continuation lines return to the left margin** rather than hanging under the label. This is visible throughout figures 2-1 to 2-5 and stated outright for the subject line in para 2-4a(6): *"begin the second line flush with the left margin."* It is the detail most hand-written memo templates get wrong.

Multiple-address blocks are the documented exception, indenting continuation lines a quarter inch (para 2-4a(5)(b)).

---

## 3) The quarter-inch tab grid

Para 1-39b(10) says *"Space ¼ inch to the right of the parenthesis when numbering subparagraphs."* Read as "label width plus a quarter inch" this produces a visibly wider gap than the figures show. Read as a quarter-inch tab grid it matches them exactly:

```javascript
function tabStopAfter(positionIn) {
    const stop = LAYOUT.labelGapIn;           // 0.25
    return (Math.floor((positionIn + 1e-9) / stop) + 1) * stop;
}
```

So `1.` at the left margin puts its text at 0.25 in, `a.` at the 0.25 in indent puts its text at 0.5 in, and `(1)` at 0.5 in puts its text at 0.75 in - one rhythm across all four levels. `verify.js` asserts each of these.

---

## 4) One line model, two backends

`layoutMemo()` produces line objects. Nothing else in the codebase knows how a memo is spaced:

```javascript
{kind: "text", text, indentIn, align, right, bold, role, prefix, prefixWidthIn}
```

- `role` is what the validator and `verify.js` search for (`office-symbol`, `memorandum-for`, `subject`, `paragraph`, `authority-line`, `digital-signature`).
- `right` is a flush-right element sharing the line - the date beside the office symbol (para 2-4a(3)(b)).
- `sameLine` is a second block sharing the line - the signature block beside the enclosure listing (para 2-4c(3)), or MOU signature blocks side by side (para 2-6c(5)).
- `prefix` is the paragraph label, kept separate from the text so the tab grid can position it.

`renderText()` scales these onto a character grid for the terminal. `renderHtml()` emits one `<div class="ln">` per regulation line at real inches, so the "Nth line below" counts survive into print:

```css
.page { width: 8.5in; min-height: 11in; padding: 0.5in 1in 1in 1in; }
.ln   { min-height: 13.8pt; white-space: pre-wrap; }
```

`white-space: pre-wrap` matters: the lines are already broken with real Arial metrics, and it stops the browser from collapsing the two-space sentence gaps.

`layoutMemo()` also returns `flow` - every line before pagination. The regulation's counts describe the document's flow, so that is what `verify.js` asserts against; a page break must not be able to change whether `MEMORANDUM FOR` is on the third line below the office symbol.

---

## 5) The letterhead and the seal

Para 1-16b(1): *"All official letterhead stationery will bear the DoD seal."* Para 1-16b(2): do not print any other seal, emblem, insignia, or motto.

The department seal ships in `assets/` and is applied to every letterhead memorandum with no configuration - it does not change, so there is nothing to configure. Clearing it explicitly is an **error**, not an advisory. It is never drawn or approximated: para 1-16b(2) forbids substituting any other device, and artwork that merely resembles the seal would produce a document that looks official and is not.

Its geometry was **measured, not assumed**. AR 25-50 never states the seal's size in prose, but ten figures draw it on a full 8.5 x 11 page. Scaling each seal's pixel bounding box against its page frame gives:

| | measured | sd |
| --- | --- | --- |
| diameter, width | 0.953 in | 0.005 |
| diameter, height | 0.941 in | 0.006 |
| left edge from page edge | 0.523 in | 0.005 |
| top edge from page edge | 0.524 in | 0.006 |

So **0.95 in square at 0.52 in from the top and left**. The earlier values - 1.0 in at 0.75 / 0.5 - were guesses, and all three were wrong.

One unit trap is worth naming: `docx-js` takes `transformation.width` in **pixels at 96 dpi**, not points. Passing points renders the seal at 0.71 in, which looks plausible and is wrong by a quarter inch. `verify.js` asserts the extent in English Metric Units (`868680` exactly, 914400 per inch), because that integer cannot hide a rounding slip.

The seal is anchored absolutely so the header text centres on the **page**, not on the space beside it - as the figures show.

---

## 6) Pagination

Para 2-5c is a set of widow-and-orphan rules with military specifics:

```javascript
const indivisible = len <= 3;                              // 2-5c(1)
const needsWholeBlock = indivisible || remaining < 2 || len - remaining < 2;
if (len > remaining && needsWholeBlock) flush();
```

And the rule that catches people out - the closing may not start a page alone (para 2-5c(4)):

```javascript
const stranded = !fits && lastBlockLines > 1 && linesOfLastParagraphOnThisPage < 2;
if (stranded || lastBlockLines === 1) {
    const moved = current.splice(current.length - linesOfLastParagraphOnThisPage);
    flush();
    push(moved);          // drag the last paragraph forward with the signature
}
```

Continuation pages get their own heading: office symbol 1 inch from the top, subject on the next line, text on the third line below (paras 2-5a to 2-5c), and a centred page number about an inch from the bottom (para 2-5d).

---

## 7) Findings that know who owns them

Every check returns a `class`:

```javascript
error("format",  "see-distribution-required", "...", "AR 25-50, para 2-4a(5)(c)")
warn ("content", "subject-too-long",          "...", "AR 25-50, para 2-4a(6)")
```

`format` findings mean the **renderer** is wrong - if one fires, `memo-formatter.js` has a bug and re-prompting a model cannot help. `content` findings are the author's, and only those go back to the LLM:

```javascript
export function repairInstructions(result) {
    return result.contentFindings.map((f) => `- ${f.message} (${f.cite})`);
}
```

Sending the model a layout complaint would invite it to start hand-formatting, which is the failure the whole design exists to prevent.

Checks that are heuristics rather than rules are advisories, not errors: passive voice (paras 1-38c to 1-38d), average sentence length (para 1-39b(2)), paragraph length (para 1-39b(3), hedged in the regulation itself with *"with few exceptions"*). Gate on those and the repair loop never terminates.

---

## 8) The grammar

```javascript
const grammar = await llama.createGrammarForJsonSchema(MEMO_CONTENT_SCHEMA);
const answer  = await session.prompt(prompt, {grammar});
return grammar.parse(answer);          // cannot throw - the sampler enforced it
```

The schema covers only what the model should decide: subject, addressees, and paragraphs as `{level, text}`. Office symbol, ARIMS record number, date, letterhead, and signature block come from `context` - they are matters of record, not of language, and `assembleMemo()` is where the two merge.

`buildParagraphTree()` turns the flat levels back into a hierarchy and repairs what the grammar cannot express:

```javascript
while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
const effective = Math.min(level, stack[stack.length - 1].level + 1);
```

A `level: 7` is clamped to 3 (fig 2-1 forbids subdividing past the third subdivision) and a level that skips a rung is pulled back to a real parent. The model's structural mistakes never reach the page.

---

## 9) Verification against the regulation

Figures 2-1 through 2-5 print their line counts in the left margin. `verify.js` uses those numbers as the oracle:

```javascript
check("fig 2-1: MEMORANDUM FOR is the 3d line below the office symbol",
    indexOf(doc, "memorandum-for") - indexOf(doc, "office-symbol"), 3,
    "AR 25-50, para 2-4a(5)");
```

61 checks covering the heading offsets, the indent ladder, the tab grid, the flush-left wrap, single- and multiple-address forms, the SEE DISTRIBUTION threshold, suspense dates, continuation-page headings, enclosure labels, sentence-spacing normalization, paragraph-depth clamping, and the validator's own catch rate.

```bash
node examples/16_army-memo-agent/verify.js
# AR 25-50 layout verification: 61/61 checks passed.
```

---

## 10) The Word deliverable

A PDF would be easier and would be the wrong answer. What gets staffed is a `.docx`, and it has to stay correct after somebody opens it and edits a sentence. So `memo-docx.js` does **not** emit the pre-broken lines the previews use - Word gets whole paragraphs plus the exact geometry, and does its own line breaking:

```javascript
new Paragraph({
    spacing: {before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO},
    indent:   {left: 0, firstLine: IN(indentIn)},   // wrap returns to the margin
    tabStops: [{type: TabStopType.LEFT, position: IN(textStartIn)}],
    keepLines: lines <= 3,     // para 2-5c(1)
    widowControl: true,        // para 2-5c(2)
    children: [run(label), tabRun(), ...emphasize(text)],
})
```

The two renderers agree because both measure Arial the same way. A document of frozen one-line paragraphs would shatter on the first edit; this one reflows.

`indent: {left: 0, firstLine: X}` is the whole AR 25-50 wrap rule in one line of OOXML: first line at the subdivision indent, every continuation back at the left margin.

**Running heads.** The first-page header is the letterhead; the default header repeats the office symbol and subject for continuation pages (paras 2-5a to 2-5c). Word then handles page breaks itself, which is why `keepLines` and `widowControl` carry the para 2-5c rules rather than hard-coded breaks. `titlePage: true` is what makes the two headers distinct.

**Formatting lock.** The user requirement was that nothing may change the font, size, spacing, or format. `settings.xml` gets:

```xml
<w:documentProtection w:formatting="1" w:enforcement="1"/>
```

Text stays fully editable - that is the point of shipping Word - but formatting cannot be changed from inside the application. Adding `w:edit="readOnly"` would lock the text too. This is a deterrent rather than a security control: unpassworded protection is removable from the Review tab, which is the right level for a document a staff officer still has to finish.

---

## 11) Templates and the editing surface

Every memorandum type has a skeleton in `templates.js` with `[BRACKETED]` placeholders where a value belongs:

```bash
node army-memo-agent.js --template decision --emit-spec memo.json --docx memo.docx
```

You now have two editing surfaces for the same document, and neither can damage the layout:

- **`memo.json`** - change the values, re-render with `--spec`
- **`memo.docx`** - type over the placeholders in Word, where formatting is locked

The validator reports every placeholder still unfilled (`unfilled-placeholder`), so a memorandum that still says `[FULL NAME]` cannot quietly reach a staffing folder.

The decision-memorandum skeleton is not free-form: figure 2-18 fixes it at FOR DECISION, PURPOSE, RECOMMENDATION(S) with the approval line, BACKGROUND, DISCUSSION with courses of action, IMPACT, COORDINATION, and the point of contact. `decision-memo-skeleton` reports any that go missing.

Two node flags exist for the shapes that figure needs:

- `literal: true` - a tabular row (the `APPROVED X / DISAPPROVED X / SEE ME X` line, a concurrence row). No letter, spacing preserved, columns placed by `tabsIn`.
- `_underscores_` - underline a run. Figure 2-18 underlines each heading word. Only the Word renderer acts on it; the previews strip the markers, since the `.docx` is the deliverable and emphasis is not a measurement.

---

## 12) Signature blocks: the formalities

`signature-blocks.js` holds chapter 6, because the signature block is the part most likely to be wrong and the rules depend on facts about the signer rather than on style:

```javascript
buildSignature({name: "Jane A. Ruiz", grade: "MG", title: "Commanding General"})
// -> ["JANE A. RUIZ", "Major General, USA", "Commanding General"]
```

The resolution order matters, and it is the regulation's, not a preference: retired status wins (para 6-6, no branch at all), then a GS or IG detail (para 6-5c(7), replaces the branch), then the categories that take `USA` - general officers, warrant officers, joint commands (paras 6-5c(3), (5), (8)) - then the branch abbreviation.

Other rules it encodes: general officers spell the grade out (paras 6-4f(3), 6-5c(1)); civilians get two lines, name and title, never a grade (paras 6-4a note 2, 6-8a); letters use upper-and-lowercase names, spelled-out grades, and `U.S. Army` instead of a branch (paras 6-4a(1), 6-4f(1)); reservists not on active duty add `USAR` (para 6-7); commanders append `Commanding` (para 6-4a(3)).

`authorityLineNeeded()` implements para 6-2b, which is the rule people miss: the authority line is **omitted** when the head of the office signs personally, and omitted when the text already carries a mandatory phrase such as *"The Commander desires ..."*.

---

## 13) Intent

`detectMemoType()` reads the request for the phrases that name a type in AR 25-50:

```javascript
detectMemoType("document the telephone conversation with range control")  // -> "record"
detectMemoType("I need a decision memo for the CG")                       // -> "decision"
```

It is deliberately shallow, and the chosen type is always printed back. A wrong guess is cheap to correct with `--template`; a wrong guess made *silently* would not be.

---

## 14) Every memorandum form, read from its figure

Nothing here is inferred from the prose alone. Each form was reconstructed from the figure that prints it, and several of those figures contradicted a reasonable reading of the text:

| Form | Figure | What the figure settled |
| --- | --- | --- |
| Standard | 2-1, 2-3, 2-4 | Wrap returns to the left margin; quarter-inch tab grid |
| Multiple address | 2-5, 2-6, 2-7 | Addresses stack under a bare `MEMORANDUM FOR`; second line indents 1/4 in; office-symbol addresses are uppercase and must not be mixed with full titles |
| SEE DISTRIBUTION | 2-8 | Listing is *blocked flush left*, not hung; sub-entries indent; `(CONT)` when it runs on |
| Separate listing | 2-9 | `DISTRIBUTION:` / `(see next page)`, full listing on its own page |
| Distribution formula | 2-10 | `SPECIAL DISTRIBUTION:` sub-block, all flush left |
| THRU | 2-11, 2-12 | The addressee line reads **`FOR`**, not `MEMORANDUM FOR`; two or more stack under a bare `MEMORANDUM THRU` |
| One paragraph | 2-13 | Not numbered - but its **subparagraphs still are** |
| Enclosures / CF | 2-14 | Two-column closing; `CF:` addressees flush left |
| MOU / MOA | 2-15, 2-16 | **Plain white paper**; semicolon-joined parties; date rule and `(Date)` under each block; third signer centred below |
| MFR | 2-17 | **Plain paper, no authority line, no addressee** |
| Decision | 2-18 | Fixed skeleton, underlined headings, `APPROVED X` approval line |
| Digital decision | 2-19 | Approval line is a **checkbox**, not an X |
| Signature blocks | D-2, D-8, D-14, D-20 | Enlisted use **`USA`, never a branch**; `USAR` *replaces* `USA` for an enlisted reservist; a long title wraps at 1/4 in; grade abbreviations are optional |

The Word checkbox is the one place a run is not Arial: Word implements checkbox content controls with an `MS Gothic` glyph (U+2610). That is Word's own mechanism, not a styling choice, and it applies only to the box itself.

---

## Writing your own memo

```javascript
import {renderHtmlDocument} from "./memo-formatter.js";
import {validateMemo, formatReport} from "./memo-validator.js";

const memo = {
    letterhead: {
        organization: "Headquarters, 4th Infantry Division",
        streetAddress: "1633 Mekong Street",
        cityStateZip: "Fort Carson, CO 80913-4321",
        seal: "./dod-seal.png",              // from the APD letterhead template
    },
    officeSymbol: "ATZB-RC",
    arimsRecordNumber: "25-50a",
    date: "17 July 2026",
    suspenseDate: "25 July 2026",            // optional, para 1-27
    addressees: ["Commander, 1st Battalion, 5th Infantry Regiment, ..."],
    subject: "Range 14 Closure for Scheduled Maintenance",
    paragraphs: [
        {text: "Range 14 closes 3 through 7 August 2026."},
        {text: "Range Control will complete the following work:", children: [
            {text: "Replace the target lifters on lanes 1 through 12."},
            {text: "Regrade the access road."},
        ]},
        {text: "My point of contact is Mr. David Okonkwo, ATZB-RC, at 719-555-0142 or david.a.okonkwo.civ@army.mil."},
    ],
    authorityLine: "FOR THE COMMANDER:",     // omit if signing in your own right
    signature: {name: "MARCUS T. HALE", gradeAndBranch: "LTC, IN", title: "Director, Plans and Operations"},
    enclosures: ["Range 14 Maintenance Schedule"],
    copiesFurnished: ["Garrison Safety Office"],
};

console.log(formatReport(validateMemo(memo)));
await fs.writeFile("memo.html", renderHtmlDocument(memo));
```

Other memo types set `type`: `"thru"` (para 2-4a(5)(d), with a `thru` array), `"record"` (para 2-7), `"decision"` (para 2-8), `"mou"` / `"moa"` (para 2-6, with a `parties` array and side-by-side `signers`).

---

## Scope

This example implements **chapter 2** of AR 25-50 (memorandums), the chapter 1 rules that govern them, and the chapter 6 signature-block and authority-line rules. All six memorandum forms are covered: standard, THRU, memorandum for record, decision memorandum, MOU, and MOA.

Letters (chapter 3) are **not** implemented - they use a different date format, `cc:` instead of `CF:`, no digital signatures (para 3-6c(2)(b)), and spelled-out grades. `signature-blocks.js` already handles the letter form of a signature block, so that is the piece in place. Forms of address are in appendix C of the regulation.

Two judgement calls are flagged in the code rather than hidden:

- **Page numbering.** Para 2-5d states no exception for the first page of a multiple-page memorandum, so the default numbers it. Set `numberFirstPage: false` for the common office practice of numbering continuation pages only.
- **Letterhead geometry.** AR 25-50 requires the APD template but does not publish its point sizes. The values in `LETTERHEAD` are the template's defaults and are labelled as such - they are not quotations from the regulation.
- **`CF: (w/o encls)`.** Para 2-4c(5) spells it `w/o encls`; figure 2-14 prints `wo/encls`. The prose wins, since it states the rule explicitly.
- **The DoD seal is never drawn.** Para 1-16b(1) requires it and para 1-16b(2) forbids substituting any other device, so the renderer uses the official image from the APD template or none at all. See `assets/README.md` - it is a one-time setup, because the seal does not change.
