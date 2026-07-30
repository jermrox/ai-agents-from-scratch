# Code explanation: `army-memo-agent.js`

Thirteen files, each with one job:

| File | Responsibility |
| --- | --- |
| `ar25-50.js` | The regulation, codified. Constants, each carrying its paragraph citation. No logic beyond formatting helpers. |
| `text-metrics.js` | Arial/Helvetica advance widths, tokenizing, line breaking in inches. |
| `memo-formatter.js` | Layout engine plus two preview backends: plain text and print-ready HTML. |
| `memo-docx.js` | **The deliverable.** Word output: exact type, margins, tab stops, running heads, and a formatting lock. |
| `signature-blocks.js` | Chapter 6 and appendix D: table 6-1 grades, GS/IG, general officers, warrant officers, civilians, retired, USAR, ARNG, chaplains, authority lines. |
| `templates.js` | One editable skeleton per memorandum type, with `[BRACKETED]` placeholders. |
| `memo-validator.js` | Compliance checks. Every finding cites AR 25-50 and is tagged `content` or `format`. |
| `memo-intent.js` | Request &rarr; memorandum type; content + facts of record &rarr; a spec; the draft/validate/repair loop. |
| `memo-drafter.js` | The drafting model as a service: loaded once, one job at a time, no context bleed. |
| `memo-server.js` | **The front end.** A page that takes a request and returns a checked memorandum and a Word file. |
| `army-memo-agent.js` | The CLI. |
| `verify.js` | Asserts the renderer *and the .docx* against the regulation's own figures. |
| `validate-ooxml.py` | Validates the .docx against ISO/IEC 29500-4 - the schema Word itself enforces. |

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

# The front end: say what you need, get a memorandum and a .docx
node examples/16_army-memo-agent/army-memo-agent.js --serve

# Check the renderer and the .docx against AR 25-50's own figures,
# and the .docx against the schema Word enforces
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
| `--serve` | Open the front end on http://localhost:4250 (`--port`, `--host` to change) |
| `--model <path>` | A GGUF to draft with; `MEMO_MODEL_PATH` does the same |
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

**Where page 1's body starts** is stated too, and was briefly treated as a judgement call it never was. Para 2-4a(1): *"Type the office symbol on the second line below the seal."* Figure 2-2 repeats it. The same ten figures put the seal's lower edge at 1.450 in and the office symbol at **1.792 in** (sd 0.029) from the top of the page, so that is the top margin.

Deriving it instead - seal bottom plus two 13.8 pt lines - gives 1.853 in, which overshoots: the seal's edge is not a line boundary, and the measurement reads the top of the glyphs rather than the line box. The figures win.

It has to clear the continuation running head as well - office symbol 1 inch down (para 2-5a), subject on the next line (2-5b), text on the third line below (2-5c), so 1.767 in. The two agree to within four hundredths of an inch, because the regulation means text to resume at the same height on every page. There was never a conflict to compromise between.

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

569 checks covering the heading offsets, the indent ladder, the tab grid, the flush-left wrap, single- and multiple-address forms, the SEE DISTRIBUTION threshold, suspense dates, continuation-page headings, the four enclosure-listing forms of chapter 4, sentence-spacing normalization, paragraph-depth clamping, State codes and ZIP+4, protocol order, the `.docx`'s own OOXML, and the validator's catch rate.

Appendix D is reproduced block for block: all 22 signature-block figures are test cases whose expected value is what the published figure prints, read off the figure images rather than paraphrased. That is what turned up the rules the code had wrong - a letter drops the branch for *everyone*, not just general officers; USAR replaces "USA" rather than stacking on it; an acting incumbent takes the acting title instead of "Commanding".

```bash
node examples/16_army-memo-agent/verify.js
# AR 25-50 layout verification: 569/569 checks passed.
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

That last sentence is load-bearing, and for a while the code did not honour it: `titlePage` was set only when there was a letterhead. A memorandum without one — every memorandum for record, and any memorandum on plain bond — had no first-page header to separate, so Word applied the *continuation* header to page 1. On a rendered one-page MFR that put the office symbol and subject at the top of the page, directly above the heading that already carries them, and the overflow pushed the text to 1.92 in against the 1 in para 2-5a gives it. The fix is to separate page 1 always and give a letterhead-less memorandum an empty first-page header. An empty header is not a wasted part: it is the thing that keeps the running head off page 1.

The continuation header is now written even when the layout measures one page. Word does its own line breaking and may not agree with the line model; a second page that appears in Word still has to carry its heading.

**Formatting lock.** The user requirement was that nothing may change the font, size, spacing, or format. `settings.xml` gets:

```xml
<w:documentProtection w:formatting="1" w:enforcement="1"/>
```

Text stays fully editable - that is the point of shipping Word - but formatting cannot be changed from inside the application. Adding `w:edit="readOnly"` would lock the text too. This is a deterrent rather than a security control: unpassworded protection is removable from the Review tab, which is the right level for a document a staff officer still has to finish.

**The file has to open before any of this matters.** Word validates each part it reads against ISO/IEC 29500-4. A part that breaks the schema does not render slightly wrong — it produces *"Word found unreadable content"* and an offer to repair, and the memorandum never reaches the page at all. LibreOffice is lenient by design and renders straight through faults Word rejects, so no amount of rendering catches this. `validate-ooxml.py` runs every part of every memorandum type — filled and blank, one page and several — against the schema itself, and `verify.js` gates on it.

That gate is not theoretical. It found the worst bug in the example:

```
FAIL word/document.xml: Element 'undefined': This element is not expected.
```

`ImportedXmlComponent.fromXmlString` returns the **document node**, not the element in it. Its `rootKey` is undefined, so serializing it writes a literal `<undefined>` wrapper around the real element — and every content control in the file shipped inside one. The wrapper is in no namespace and is legal nowhere. LibreOffice descended through it and rendered the slots correctly, which is exactly why eleven rendered-page measurements and a hundred OOXML assertions all passed while the file would not have opened in Word. `importXml()` unwraps it and checks the root name, so it fails loudly instead.

**Schema order is not a style question either.** `w:settings` and `w:sdtPr` are both `xsd:sequence` (ECMA-376 Part 1, paras 17.15.1.78 and 17.5.2.38): every child has exactly one legal position, and LibreOffice accepts any order:

- `w:documentProtection` belongs after `w:doNotTrackFormatting`, which puts it behind the `w:displayBackgroundShape` the generator already writes. It was being spliced in behind the opening tag. `insertSetting()` now places it before the first element that outranks it, so it stays correct as the generator's own settings change.
- `w:sdtPr` is `rPr, alias, tag, id, lock, placeholder, temporary, showingPlcHdr`, then the type. Every content control now emits in that order, with a `w:id` hashed from the prompt — distinct within the document, and identical from one run to the next so the file stays reproducible.

Both are asserted on the XML in `verify.js` as well as through the schema, and every one of these assertions was confirmed by reintroducing the fault and watching it fail — including the schema gate, which reports the part and the line:

```
FAIL word/settings.xml:1: Element 'displayBackgroundShape': This element is not expected.
FAIL word/document.xml:1: Element 'rPr': This element is not expected. Expected is one of ( tag, id, lock, ... )
```

The schemas are not vendored — they are ISO's. Point `MEMO_OOXML_SCHEMAS` at a copy of the ISO/IEC 29500-4 XSDs, or leave it unset and they are looked for where the Claude `docx` skill keeps them. Without them, or without `lxml`, the script exits 3 and `verify.js` reports a skip rather than a pass:

```
  (no ISO/IEC 29500-4 schemas found; set MEMO_OOXML_SCHEMAS - skipping schema validation)
  AR 25-50 layout verification: 551/551 checks passed.
```

A skip that reads as a pass is how a broken file ships, so the count visibly drops.

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

## 15) An independent field template, measured

Everything above is derived from AR 25-50's own figures, which risks a closed loop: the renderer agrees with the figures because both were read by the same pair of eyes. So a real unit memorandum template (HHC/ESB, 9 December 2009) was measured too — from its PDF text-placement coordinates, not from a picture of it.

It agrees on every structural measurement:

| | Template (measured) | In lines | This renderer |
| --- | --- | --- | --- |
| Office symbol → MEMORANDUM FOR | 0.575 in | 3.00 | 3 |
| MEMORANDUM FOR → SUBJECT | 0.384 in | 2.00 | 2 |
| SUBJECT → body | 0.550 in | 2.87 | 3 |
| Between paragraphs | 0.358 in | 1.87 | 2 |
| Within a paragraph | 0.192 in | 1.00 | 1 (13.8 pt) |
| Text → authority line | 0.383 in | 2.00 | 2 |
| Authority line → signature | 0.959 in | 5.00 | 5 |
| Signature → DISTRIBUTION | 0.383 in | 2.00 | 2 |
| **Signature column** | **4.251 in absolute** | | **1.0 + 3.25 = 4.25 in** |
| Subparagraph indent | 1.251 in absolute | | 1.0 + 0.25 |
| Distribution entries | 1.001 in — flush left | | flush left |
| Page number | 1.036 in from the foot | | ~1 in |

The signature column landing on 4.25 in independently is the one worth noting: para 2-4c(2)(a) only says *"the center of the page"*, and this confirms that reading to a hundredth of an inch.

**Where it differs, the regulation wins** — the template predates the 2020 revision by eleven years, and its body face is a serif substitute rather than the sans of the figures:

| Template | Regulation | Kept |
| --- | --- | --- |
| Office symbol at 1.915 in | 1.792 in measured from the figures | The figures. The template carries a `REPLY TO / ATTENTION OF` block at 1.403–1.511 in, which para 1-16b(1) says **is not required**; removing it accounts for the whole difference. |
| Continuation page repeats **office symbol and date** | Paras 2-5a and 2-5b say office symbol and subject; fig 2-2's continuation shows no date | Office symbol and subject. |
| `MSG, US Army` | Fig D-14 shows `MSG, USA` on a memorandum; `U.S. Army` is the letters form (para 6-4f(1)) | `USA`. |
| `John Doe` in mixed case | Para 6-4a(1): capital letters on memorandums | Capitals. |
| Label-to-text gap 0.167 in | Para 1-39b(10) quarter inch; figs 2-1 and 2-6 measure 0.254 and 0.257 in | The quarter-inch grid. |

`verify.js` carries the template's measured coordinates as a fixture and asserts the renderer reproduces every one of its line counts. It is the only test in the suite whose oracle came from outside the regulation.

---

## 16) Type: Arial 12, and only Arial 12

Para 1-19a: *"A font with a point size of 12 is recommended."* Para 1-19 also delegates the choice — *"Army senior leaders will determine the font size and type his or her organization will use"* — so the size of the **body** is the organization's call, and this one sets 12 pt for every line a writer types.

Twelve is the size and the ceiling. `verify.js` asserts both halves: **nothing in the file is above 12 pt**, and **the memorandum's own text is exactly 12 pt** — body, running heads, and every latent style Word ships.

The letterhead is the one thing below it, and that is measured, not chosen. See the next section.

**Getting there took removing two layers of Word's defaults.** `docx-js` ships `Title` at 28 pt and `Heading 1`/`Heading 2` at 16/13 pt in every document, plus footnote and endnote styles at 10 pt. Nothing in a memorandum applied any of them, so the rendered page always looked right — which is exactly why it went unnoticed. But under a formatting lock that deliberately permits text editing, an oversized latent style is a live route to a non-compliant document: one click in the style gallery. All of them are now levelled:

```javascript
title:        {run: {font: TYPE.fontFamily, size: TYPE.maxSizePt * 2}},
heading1:     {run: {font: TYPE.fontFamily, size: TYPE.maxSizePt * 2}},
// ... heading2 through heading6
footnoteText: {run: {font: TYPE.fontFamily, size: TYPE.fontSizePt * 2}},
endnoteText:  {run: {font: TYPE.fontFamily, size: TYPE.fontSizePt * 2}},
```

**The letterhead is 10 pt and 8 pt, and that is a measurement.** This was wrong for a long time, and the reason it stayed wrong is worth recording: the figures were read at ~70 px/inch, at which they genuinely cannot pin a point size closer than ±1.5 pt, so the note said "not a rule" and the letterhead was set to a uniform 12 pt like everything else.

Rasterised at 150 px/inch they can. Calibrating on the seal — a known 0.95 inch square 0.52 inch from the top and left edges, so it is a ruler printed on every letterhead figure — figure 2-1 gives cap heights of 0.106 in for the title and 0.080 in for the three address lines. Arial's cap height is 0.716 em:

| | measured ink | ÷ 0.716 | line pitch | implies |
| --- | --- | --- | --- | --- |
| Title | 0.106 in | 10.7 pt | 0.153 in (11.5 pt line) | **10 pt** |
| Organization block | 0.080 in | 8.1 pt | 0.129 in (9.2 pt line) | **8 pt** |

Two independent measurements — cap height and line pitch — landing on the 2009 field template's 10 and 8 exactly. The two sources were never in conflict; the render was just too coarse to see it. The calibration checks out against a value the regulation *does* state: it puts the left margin at 1.005 in.

This is not the body type and para 1-19 does not govern it. The letterhead is printed stationery; every line a writer types stays at 12 pt. A uniform 12 pt letterhead is still one line away for an office that wants it:

```javascript
renderDocx(memo, {letterhead: UNIFORM_LETTERHEAD_SIZES})
```

— but it costs 0.22 inch of extra height, which pushes the whole block down the page and closes up the gap above the office symbol. That is the next section.

Asking for type above the ceiling is an **error**. The only non-Arial run in any document is the decision memorandum's checkbox glyph, which Word implements in `MS Gothic`.

---

## 16a) The office symbol, and what a derived measurement cost

Para 2-4a(1) says the office symbol goes *"on the second line below the seal"*, and for a while this code took that literally and **derived** the position: the seal's top offset, plus one line for the seal, plus one for each of the four letterhead lines, plus one more. Clean, self-consistent, and wrong — because "line" was taken to be the body's 13.8 pt, and the letterhead's lines are 11.5 pt and 9.2 pt. The derived answer came out **1.670 in** where figure 2-1 shows **1.775 in**: half a line high.

What makes this worth writing down is that *nothing could catch it*. The rendered-page check counted body lines from the last letterhead line and got 2.00 — because the renderer and the check shared the same wrong line height and agreed with each other. A measurement derived from a model can only ever confirm the model.

Both numbers are now measured off the figure and asserted against the figure, in absolute inches from the top edge of the page:

| | figure 2-1 | ours |
| --- | --- | --- |
| Letterhead title | 0.580 in | 0.580 in |
| Organization | 0.733 in | 0.733 in |
| Street address | 0.866 in | 0.860 in |
| City, state, ZIP | 0.992 in | 0.993 in |
| Office symbol | 1.809 in | 1.827 in |

The office symbol's last 0.018 in is the parentheses in figure 2-1's *"OFFICE SYMBOL (ARIMS Record Number)"*, which rise about 0.006 in above cap height; against a line of plain capitals the gap is 0.012 in, a sixteenth of a line.

Two smaller things fell out of fixing it. The seal used to sit in a paragraph of its own, and an empty paragraph still occupies a line even when the image in it is floating — that line was pushing the whole letterhead 0.19 in down the page. It now rides in the first letterhead paragraph. And page 1's body start (1.78 in) and a continuation page's (1.767 in) are now a fifteenth of a line apart instead of half a line, so one section's top margin serves both and the header-overflow trick documented below is no longer load-bearing.

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

## The front end

```bash
node examples/16_army-memo-agent/army-memo-agent.js --serve
```

Node's own `http` module, one page, no framework and no network. It makes the division of labour visible, because the page is laid out along it:

| The page asks for | Who owns it |
| --- | --- |
| **What do you need** | `detectMemoType()` reads the memorandum type out of it (para 2-2). Override it if the guess is wrong; the guess is always shown. |
| **Your words** | Subject and body — the only things a person actually writes. |
| **Matters of record** | Office symbol, ARIMS number, date, letterhead, signature block. |

Everything else — every measurement on the page — is not on the form, because none of it is a choice.

**The matters of record default to placeholders.** Leave a field blank and it comes out as `[OFFICE SYMBOL]`, not as a plausible-looking value. That is the point: a memorandum reading `[OFFICE SYMBOL]` is obviously unfinished, while one reading `ATZB-RC` because that is what the demo used is wrong in a way nobody notices until it has been staffed. The date is normally one of them — para 2-4a(3)(b) puts it on the page *"after the memorandum has been signed"*, so at drafting time it is not knowable.

**You fill them in afterwards, in Word, and nothing moves.** No measurement depends on what any of those fields say, which is exactly why the `.docx` can lock formatting and still be typed into:

```xml
<w:documentProtection w:formatting="1" w:enforcement="1"/>
```

Font, size, spacing, indents and margins are enforced; the text is not. There is no `w:edit="readOnly"`.

**The body syntax is deliberately not a numbering scheme.** A blank line separates paragraphs; indentation is the subdivision level, two spaces per rung. You never type `1.` or `a.` — para 2-4b(4)(b) makes the label the renderer's job, and a hand-typed one would be duplicated by the one the tab grid puts there. Figure 2-1 stops at the third subdivision and `buildParagraphTree()` clamps there.

```
Range 14 closes for maintenance from 3 through 7 August 2026.

Range Control will complete the following work:

  Replace the target lifters on lanes 1 through 12.

  Regrade the access road.
```

becomes `1.`, `2.`, `a.`, `b.` — positioned on the quarter-inch grid, with continuation lines returning to the left margin.

Routes: `GET /` the page, `GET /seal.png`, `GET /health`, `GET /types`; `POST /detect` the type, `POST /draft` the words, `POST /generate` a rendered preview plus cited findings, `POST /docx` the Word file, `POST /spec` the JSON you can re-render later with `--spec`.

---

## The drafting model

`memo-drafter.js` exists because the CLI could afford to load a model, ask it one thing and throw it away, and a server cannot. It owns three things the CLI never had to think about:

**Loaded once.** `getDrafter()` caches the *load promise*, not the loaded model — so requests that arrive during a cold start wait for the first load rather than each starting their own. A failed load is deliberately not cached, or a process that started before the volume mounted could never recover.

**One at a time.** Jobs are serialized through a promise chain. Two concurrent prompts on one llama.cpp sequence interleave their tokens and corrupt both answers. The chain advances on failure as well as success — otherwise one error wedges every request behind it for the life of the process.

**No bleed.** Each job starts from a cleared chat history. *Within* a job the repair passes share it on purpose, because the model needs to see the draft it is being asked to fix; across jobs it would mean one memorandum informing the next, and a context that grows until it overflows — a server that works for an hour and then stops.

The grammar is what makes the arrangement safe:

```javascript
const grammar = await llama.createGrammarForJsonSchema(MEMO_CONTENT_SCHEMA);
return grammar.parse(await session.prompt(prompt, {grammar}));
```

The model is physically unable to emit anything outside the schema, so the parse cannot fail and the layout code never has to defend itself against what the model said. Look at what the schema does **not** contain: no office symbol, no date, no signature block, no letterhead, no numbering, no spacing. Those are matters of record or matters of layout, and a model has no standing to supply either. `verify.js` asserts each absence, because the schema is the only thing standing between a language model and a document of record.

`stubDrafter()` wraps any `(request, feedback) => content` function in the same interface. That is the seam: it is how the loop is tested without a model on disk, and it is where a different backend — a hosted API, a larger local model — would plug in. `createMemoServer({drafter})` takes one, which is why `/draft` is exercised end to end over real HTTP in the checks.

**Without a model, everything else still works.** `/health` reports whether one is present, the page disables the drafting button and says where it looked, and `/draft` answers 503 with the path and what to do about it. The formatter, the validator, the templates, the `.docx` and all 569 checks need no model at all — the parts that must be exactly right are the parts that do not need one.

Configuration is environment-first, so a deployment changes nothing in the source: `MEMO_MODEL_PATH`, `MEMO_CONTEXT_SIZE`, `MEMO_DRAFT_TIMEOUT_MS`, `PORT`, `HOST`. The server binds loopback unless told otherwise — it serves an editable Word deliverable and loads a language model on demand, so reaching it from off-box should be a decision somebody made.

---

One structural note. `army-memo-agent.js` ends in a top-level `await main()`, so nothing it imports may import it back — the entry module's evaluation never completes, the cycle never settles, and `--serve` exits with *"unsettled top-level await"* instead of listening. `memo-intent.js` exists to hold what the CLI and the front end both need. `verify.js` asserts the cycle stays broken.

---

## Scope

This example implements **chapter 2** of AR 25-50 (memorandums), the chapter 1 rules that govern them, the chapter 4 enclosure and tabbing rules, the chapter 5 addressing rules that reach inside the correspondence, the chapter 6 signature blocks and authority lines, and appendices B, D, E and F. All six memorandum forms are covered: standard, THRU, memorandum for record, decision memorandum, MOU, and MOA.

Letters (chapter 3) are **not** built - they differ in every part, not just a few fields: a centered civilian date, an inside address and salutation, indented unnumbered paragraphs, a complimentary close, no authority line, and page numbers at the top. What *is* implemented is the boundary. Para 3-2 reserves a fixed audience to the letter - the President, Congress, the Supreme Court, Governors, mayors, foreign officials, and the public - and addressing a memorandum to any of them raises a `wrong-vehicle` finding rather than a formatted document. `LETTER_AUDIENCES.deltas` carries the chapter 3 differences, and `buildSignature(signer, "letter")` produces the letter form of a signature block. Forms of address are in appendix C, which para C-2a scopes to letters only.

Three places hand formatting authority to something outside this module, and each is reported rather than papered over:

- **Para 1-6 Note and para 2-2 Note.** Memorandums signed by HQDA principal officials, or originating in the Army Secretariat or Army Staff, are governed by DoDM 5110.04 Vol 1 and the HQDA Writing and Product SOP. Neither is public. `supersedingAuthority()` detects both triggers.
- **Appendix F.** Every box it describes is an Acrobat form field created *after* the Word file exists, so a `.docx` cannot be signature-ready. The requirements it adds - a signature and comment box per THRU addressee, one box per signer - are reported with the count the memorandum implies.
- **Chapter 8.** AR 25-50 states no classification marking rule at all; it defers entirely to DoDM 5200.01. Nothing is invented here.

Two judgement calls are flagged in the code rather than hidden:

- **Page numbering.** Para 2-5d states no exception for the first page of a multiple-page memorandum, so the default numbers it. Set `numberFirstPage: false` for the common office practice of numbering continuation pages only.
- **Letterhead geometry.** AR 25-50 requires the APD template but does not publish its point sizes. The values in `LETTERHEAD` are the template's defaults and are labelled as such - they are not quotations from the regulation.
- **`CF: (w/o encls)`.** Para 2-4c(5) spells it `w/o encls`; figure 2-14 prints `wo/encls`. The prose wins, since it states the rule explicitly.
- **The DoD seal is never drawn.** Para 1-16b(1) requires it and para 1-16b(2) forbids substituting any other device, so the renderer uses the official image from the APD template or none at all. See `assets/README.md` - it is a one-time setup, because the seal does not change.
