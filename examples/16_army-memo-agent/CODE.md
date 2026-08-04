# Code explanation: `army-memo-agent.js`

Fourteen files, each with one job:

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
| `unit-profile.js` | Which fields belong to the *unit* and which to the memorandum, so an office is asked for its own details once. |
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
| `--template <type>` | Start from an editable skeleton: `letter`, `standard`, `thru`, `record`, `decision`, `mou`, `moa` |
| `--spec <file.json>` | Render a spec you have already filled in |
| `--emit-spec <file.json>` | Write the spec out so you can edit it |
| `--docx <path>` | Word deliverable |
| `--html <path>` / `--text <path>` | Previews |
| `--seal <path>` | The DoD seal image, once (see `assets/README.md`) |
| `--serve` | Open the front end on http://localhost:4250 (`--port`, `--host` to change) |
| `--model <path>` | A GGUF to draft with; `MEMO_MODEL_PATH` does the same |
| `--offline` | Skip the model |
| `--unit <file.json>` | Apply a saved unit profile - organization block, office symbol, signature block |
| `--save-unit <file.json>` | Write this memorandum's unit details out for reuse |

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

That grid is what the **indents** sit on: `a.` a quarter inch in, `(1)` a half, both stated outright in figure 2-1, and it is the grid a writer's own tab key lands on (`w:defaultTabStop`). `verify.js` asserts each of these.

The gap between a number and its own text is a separate question, and it is now **one space** rather than the grid — see [15b](#15b-one-space-after-the-paragraph-number) for the measurement that says otherwise and why it was set this way anyway.

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

924 checks covering the heading offsets, the indent ladder, the tab grid, the flush-left wrap, single- and multiple-address forms, the SEE DISTRIBUTION threshold, suspense dates, continuation-page headings, the four enclosure-listing forms of chapter 4, sentence-spacing normalization, paragraph-depth clamping, State codes and ZIP+4, protocol order, the `.docx`'s own OOXML, the validator's catch rate, and the front end's own per-type field visibility and functional wiring (§16e, §16f).

Appendix D is reproduced block for block: all 22 signature-block figures are test cases whose expected value is what the published figure prints, read off the figure images rather than paraphrased. That is what turned up the rules the code had wrong - a letter drops the branch for *everyone*, not just general officers; USAR replaces "USA" rather than stacking on it; an acting incumbent takes the acting title instead of "Commanding".

```bash
node examples/16_army-memo-agent/verify.js
# AR 25-50 layout verification: 924/924 checks passed.
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

## 13a) The letter — chapter 3

The memorandum is not the only correspondence vehicle in AR 25-50. Chapter 3 defines the **letter**, and para 3-2 fixes its audience: the President or Vice President, the White House staff, Members of Congress, Justices of the Supreme Court, heads of departments and agencies, State Governors, mayors, foreign government officials, and the public.

For a long time the validator could *diagnose* this and nothing more — address a memorandum to a State Governor and it reported `wrong-vehicle`, "an audience the letter is used for, not the memorandum". It could tell you the vehicle was wrong and could not hand you the right one. Now it can.

The letter is not a memorandum with different words. Nearly every structural element differs:

| | Memorandum | Letter |
| --- | --- | --- |
| Date | `3 January 2020`, flush right beside the office symbol | `January 3, 2020`, **centred** two lines below the letterhead — 3-6a(1) |
| Office symbol | first line of the heading | **none**; record numbers are not used — 3-5d |
| Address | after `MEMORANDUM FOR` | stands in the body of the page, five lines below the date — 3-6a(3) |
| Salutation | — | second line below the address — 3-6a(4) |
| Paragraphs | numbered, flush left | **indented ¼ inch, never numbered** — 3-6b(5) |
| Subparagraphs | `a.`, `(1)`, `(a)`, four levels | `a`–`d` only, **four at most**; a lone one takes a hyphen — 3-6b(5) |
| Closing | authority line, left margin | **complimentary close** at the page centre — 3-6c(1) |
| Signature | `NAME` in capitals, grade and branch | mixed case, grade **spelled out**, `U.S. Army` not the branch — 3-4, 3-6c(2)(c) |
| Digital signature | normal | **forbidden** — 3-6c(2)(b) |
| Enclosures | numbered and listed (chapter 4) | the word `Enclosure` alone, no count, no list — 3-6c(3) |
| Copies | `CF:` | `cc:` — 3-6c(4) |
| Continuation | office symbol and subject at the top | `-2-` centred an inch down, text on the 5th line below — 3-6b(3), (4) |

Every position is measured off figure 3-1, rasterised at 150 px/in and calibrated on the seal — the same 0.95 in square 0.52 in from the corner that calibrates the memorandum figures. The calibration puts figure 3-1's left margin at 1.00 in, a value the regulation states, so it checks out:

| | figure 3-1 | ours |
| --- | --- | --- |
| Date below letterhead | 1.96 lines | 1.94 |
| Date centre | 4.29 in | 4.26 |
| Address below date | 4.99 lines | 5.00 |
| Salutation below address | 2.02 lines | 2.00 |
| Text below salutation | 1.99 lines | 2.00 |
| Paragraph indent | 0.243–0.249 in | 0.250 |
| Signature column | 4.32 in | 4.25 |

One thing the letter needed that the memorandum did not: its own top margin. A memorandum's body starts at the measured office-symbol position, which has a deliberate gap above it; a letter's date is two lines below the letterhead and nothing else intervenes, so `LETTER.bodyTopIn` is **derived** from the letterhead's own metrics — 1.093 in. That is the right way round: the office symbol's position is a measurement because the regulation gives no relationship for it, and the letter's is a relationship because the regulation states one.

---

## 13b) Appendix C — the salutation is not free text

A letter that gets the layout right and the salutation wrong is still wrong, and until this section nothing checked the salutation at all — `checkLetterHeading` only asked "is something there," the same test it applies to every other blank. Para 3-5e says *"See appendix C for proper addressing of letters"*, and appendix C's eleven tables prescribe the form outright: `"Dear Governor (surname):"` for a Governor is not a matter of taste.

`APPENDIX_C` transcribes all eleven tables — the address lines, salutation, and complimentary close, in the regulation's own placeholder wording. Ten of the eleven are stored as literal rows, because that is what they are: short, and each one distinct. Table C-4, *Military Personnel*, is the exception and needed a different shape. It runs to roughly fifty rows, and nearly all of them repeat one pattern — `"(full rank) (full name), (Service abbreviation)"` over `"(Address)"`, then `"Sincerely,"` — differing only in one word: the salutation's rank title, and that word is itself a many-to-one collapse (`GEN` through `BG` all become `"General"`; `MSG` through `SGT` all become `"Sergeant"`). Storing fifty near-identical rows would not carry any information the reader could not get from one row and the collapse map, so that is what is stored: `APPENDIX_C.militaryPersonnel.bySer`, one small object per service, plus `militarySalutation(service, grade)` to read it — warrant officers return the courtesy-title form the table itself gives them (`"Dear Mr./Miss/Ms./Mrs. (last name):"`), because appendix C assigns them no rank word at all.

The Army column of that table is not a fresh transcription — it reuses the same grade abbreviations `signature-blocks.js` already carries for table 6-1 (`GRADE_ABBREVIATIONS`), because appendix C's Army rows and chapter 6's are the same set of grades described for two different purposes. `verify.js` asserts they still agree, key for key, with the one legitimate exception recorded rather than silently allowed: Sergeant Major of the Army is a real addressee in table C-4 and is absent from table 6-1's signature grades, because a signature block and a salutation are not the same question.

Wiring: a letter carries an optional `addresseeCategory` naming a row (`"Governor of a State"`, any of the eleven tables' own headings). Once it is set, the validator does three things instead of one — reports an unrecognized category rather than ignoring it, reports a supplied salutation that does not match the table's form as an **error**, citing the exact table, and folds the correct form into the "not yet supplied" message when the salutation is still blank. Leave the category unset and nothing is checked beyond presence, same as before; every path is exercised in `verify.js`, including a deliberately mistranscribed entry that was confirmed to fail before being put back.

---

## 13c) What chapters 5, 7, and 8 turned out to be

A full pass through chapters 5 through 8 confirmed most of what applies was already built — table 5-3's State codes, the ZIP-spacing rule, the APO/FPO overseas codes, and para 5-9b's addressee-name form all had citations pointing at chapter 5 before this pass started. What is left in chapter 5 - envelope size, folding, sealing, postage weight - and the whole of chapters 7 and 8 - routing slips, DA Form 200, DA Labels 87/113/115, SF 703/704/705 classified cover sheets - describe physical or separate artifacts that accompany a memorandum rather than elements of the memorandum itself. That is the same relationship appendix F turned out to have to the `.docx`: this generator produces the correspondence, not the envelope it travels in, the label stapled to its cover, or the routing slip clipped behind it.

## 13d) What chapter 6 was still missing

Chapter 6 section II is dense - almost every sentence is a distinct signature-block rule - and `signature-blocks.js` already had general officers, warrant officers, GS/IG, Joint command, chaplains, retirees, reservists, and ARNG all correctly built before this pass. Reading the section straight through end to end turned up four sentences nothing was checking:

- **Para 6-8c.** *"Abbreviations reflecting professional degrees may be used in civilian signature blocks when dealing with foreign and high-level officials outside DoD [or in] Army teaching institutions... Do not use these abbreviations in routine correspondence."* A civilian block carrying `Ph.D.` or `B.S.` with neither exception flagged (`foreignOrHighLevelOfficial`, `academicInstitution`) is now reported.
- **Para 6-3d.** *"For 'THRU' correspondence, when no comment has been made, the signer will line through the appropriate address and initial and date the line through."* This is the wet-signature counterpart to appendix F's digital box - an action taken with a pen on the printed page, not something a Word template renders - and it needed its own check because it fires on the *opposite* condition from the digital-box guidance (`digitalSignature: false`, not `true`).
- **Para 6-2d, Note.** *"All SECARMY delegations will be copy furnished to the AASA."* A memorandum using `BY ORDER OF THE SECRETARY OF THE ARMY:` with no AASA in its copy-furnished list is now flagged - a routing requirement, not a layout one, so it is reported rather than rendered.
- **Para 6-4a, Note 2.** *"Civilians will not use 'DAC' (Department of the Army Civilian) on a signature block unless they are attached to or are serving within a multi-Service organization."* Checked across the whole block, because the mistake shows up in the title as often as the name.

## 13e) Appendix B's footnotes, and a bug they exposed

`PROTOCOL_HQDA` and `PROTOCOL_OSD` - the two ordered lists figures B-2 and B-1 print - both existed and were both correctly transcribed. Reading the rest of appendix B turned up two things.

The first is a real bug. `checkProtocol()` in the validator checked addressees against `PROTOCOL_HQDA` only; `PROTOCOL_OSD` was data nothing ever read. A memorandum addressed to the Office of the Secretary of Defense out of protocol order raised nothing, because the function that would have caught it was never being called with that list. Both are checked now - safely, because `checkProtocolOrder` already ignores names outside the sequence it is given, so running the OSD list against an HQDA-addressed memorandum costs nothing.

The second is genuinely new material. Figure B-1 carries eight footnotes and figure B-2 carries one, and seven of those nine give an explicit order for naming some but not all of one category - either the fixed order the footnote states (the three Secretaries of the Military Departments, six Under Secretaries of Defense, four Chiefs of the Military Services) or alphabetical order among the members it names (thirteen Assistant Secretaries of Defense, nineteen Directors of Defense Agencies, eight Directors of DoD Field Activities, five Assistant Secretaries of the Army). `PROTOCOL_OSD_DETAIL` and `PROTOCOL_HQDA_DETAIL` hold all nine, `checkProtocolDetailOrder()` checks a supplied list against any one of them, and the validator runs all nine automatically as `protocol-detail-order`. The eighth OSD footnote - *"refer to the most recent DoD Order of Precedence memorandum"* - names no list AR 25-50 gives, so nothing is invented for it; the fact recorded is that none exists here.

## 13f) Para 1-8b — the memorandum's excluded audiences

Para 1-8b draws its own boundary, one sentence long: *"Do not use the memorandum format when corresponding with the Families of military personnel or private businesses."* This is not `LETTER_AUDIENCES` again — para 3-2 does not name either of these two as a letter audience, so the finding is not "wrong vehicle, use a letter," it is "no memorandum reaches this addressee at all." AR 25-50 offers the letter as the practical way to reach both (para 3-2's "letters of welcome, appreciation, commendation, and condolence" covers a Family; "the public" covers a business), which is why the message still points there, but the rule itself is narrower and stricter than chapter 3's — an **error**, not a warning, because no reformatting fixes it.

`MEMORANDUM_PROHIBITED_AUDIENCES` in `ar25-50.js` holds two patterns, and the second one took a false positive to get right. The obvious first attempt matched `Company`/`Co` as business suffixes — and immediately misreported the codebase's own standard test addressee, `"Commander, Company C, 2d Battalion, 5th Cavalry Regiment"`, as a private business, because "Company C" is an ordinary Army sub-unit designation, not a corporate name. The fix drops `Company`/`Co` entirely and matches only suffixes with no military reading (`Inc`, `LLC`, `Corp`/`Corporation`). `verify.js` keeps the regression as a named check — the exact addressee that broke it, asserted clean — not just a passing test for the fixed pattern.

`checkCorrespondenceVehicle` runs `memorandumProhibitedAudiences()` alongside the existing letter-audience check, guarded the same way (`isLetter(memo)` skips both — the rule is about what a *memorandum* may not do). Both the pattern-design fix and the validator wiring were confirmed by deliberate fault reintroduction: restoring the old business regex made the "Company C" check fail as expected, and removing the validator's loop made both fire-conditions fail as expected, before either was put back.

---

## 13g) The rest of chapter 1

A paragraph-by-paragraph read of what remained of chapter 1 turned up three kinds of sentence: some already implemented under a different paragraph's citation, some genuinely new and checkable, and some that hand authority to a source outside these PDFs the same way appendix F and chapter 8 do.

**Already covered, now cited twice.** Para 1-15a — *"General officers will use their full military grades on all correspondence"* — restates the rule `GENERAL_OFFICER_CITE` already enforced under paras 6-4f(3) and 6-5c(1). It is the general statement the chapter 6 paragraphs specialize for signature blocks, so the constant now cites all three rather than leaving the chapter 1 source unlinked.

**Genuinely new, and checkable:**

- **Para 1-30.** *"List references in the first paragraph of the correspondence"* with eight named forms for citing a publication, a piece of correspondence, an email or fax, a public law, and so on. Five of the forms are sentence templates, and each is one function in the new `REFERENCES` object in `ar25-50.js`, tested against the literal example string the regulation prints for it — the same oracle the layout figures serve, applied to a paragraph that governs sentences instead of positions. The sixth form is a rule, not a template: *"you may use... 'SAB'... You cannot do so in letters."* `usesSameSubjectShorthand()` detects it, and `checkSameSubjectShorthand()` reports it as an error, but only when `isLetter(memo)` — a memorandum using "SAB" is exactly what the paragraph permits.
- **Para 1-34.** *"Attachments to enclosures are referred to as enclosures to enclosures (for example, enclosure 3 to enclosure 2)."* A different fact from `TABBING.secondaryLabel` (para 4-3's `ENCL 1 TO TAB B`, a physical tab color in a signature package) — this one is a running-text convention, lowercase and numeric on both sides, and `enclosureToEnclosureLabel()` is the one-line function for it.
- **Para 1-37.** *"In accordance with AR 25-400-2, delegations of signature authority must be created and maintained using the record number 25-50a."* The same shape as the appendix E mass-mailing review and the appendix F signature boxes — an obligation the file itself cannot carry, so it is reported. Nothing in an ordinary spec says a memorandum delegates signature authority (many memorandums carry an authority line without being one), so it is asked for directly: a `delegatesSignatureAuthority` flag the drafter sets, checked by the new `checkRecordkeeping()`.

**Out of scope, confirmed rather than assumed.** Four paragraphs turned out to defer entirely to material outside these PDFs, the same relationship chapter 8 has to DoDM 5200.01:

- **Para 1-22**, classified and special handling correspondence, defers to DoDM 5200.01 for marking and to AR 25-55 for FOUO — chapter 8's conclusion again, from a different paragraph.
- **Para 1-28**, addressing, points at AR 25-51 and this regulation's own chapter 5 — chapter 5 is already implemented; AR 25-51 is a different regulation.
- **Para 1-31**, page and paragraph numbering, is a pure cross-reference to paras 2-4, 2-5, and 3-6 — all three already implemented under their own citations.
- **Para 1-33**, distribution formulas, states one substantive rule — *"Do not use internal distribution formulas for correspondence external to your command or installation"* — but "distribution formula" here means the coded, standing distribution lists AR 25-51 defines, not the `SEE DISTRIBUTION`/`DISTRIBUTION:` addressee-listing forms this module already renders. Those are two different things sharing one English word.
- **Para 1-36**, NATO correspondence, is one sentence deferring wholly to *"applicable NATO directives,"* named but not supplied.

---

## 13h) Past chapter 1 — one more sweep, three more paragraphs

Chapter 1's citations are complete, but the same paragraph-by-paragraph read extended into chapters 3 through 8 to confirm the rest of the regulation is either implemented or genuinely out of scope, not merely unread. It turned up three more real, checkable rules and confirmed the remaining silence is correct.

- **Para 3-3.** *"Do not use phrases such as 'The Secretary has requested that I reply,' 'The Secretary desires that I reply,' or 'On behalf of the (name)' unless the SECARMY has specifically directed using such a phrase."* The opposite shape from `MANDATORY_PHRASES` (para 6-2b) — there, a phrase's presence *excuses* a requirement; here, a phrase's presence *is* the violation, unless `memo.secarmyDirectedResponsePhrase` says otherwise. `RESPONSE_PHRASES` and `checkResponsePhrases()` are letter-only — a memorandum using the same words is not a violation of this paragraph at all.
- **Para 5-11.** *"Certain official correspondence cannot be addressed directly to the individual because it requires the attention of his or her commanding officer... indicate the individual's military grade, full name, and last known unit address of assignment."* `commanderOfAddressForm()` is the one-line function for table 5-4's form, tested against the table's own example: `COMMANDER OF PFC [Name]` over the individual's unit address, unchanged.
- **Para 6-1b(1).** A written delegation of signature authority "should address or contain" two statements — that the delegating official can cancel it at any time, and that a change of command puts every delegation up for review. This is not detected in body text the way `bodyMentionsEnclosure()` detects a named enclosure: there is no fixed string to match free-form legal boilerplate against, only a paraphrasable idea. So `DELEGATION_REQUIRED_STATEMENTS` is surfaced as a reminder, unconditionally, alongside the para 1-37 recordkeeping note whenever `delegatesSignatureAuthority` is set — the same restraint chapter 4's `SEPARATE_COVER.note` and para 1-12's `EXCLUSIVE_FOR.envelopeNote` already show for obligations a formatter cannot verify.
- **Para 1-39b(6).** Back in chapter 1, and missed the first time through because para 1-39 already carried five citations under its other subparagraphs. *"Use 'I,' 'you,' and 'we' as subjects of sentences instead of this office, this headquarters, this command, all individuals, and so forth."* The mechanical twin of the already-implemented 1-39b(8) check for sentences opening "It is," "There is," or "There are" — same paragraph, same sentence-initial-phrase shape, added next to it in `checkSentenceLength()`.

**Confirmed already covered.** Para 1-15a's general-officer rule (§13g) was one example of a paragraph restating a rule enforced under a different citation; three more turned up this round: para 6-9 (*"Delegate signature authority to subordinates according to paragraph 6-1"*) is a pure cross-reference to 6-1, and para 6-2's authority-line machinery, para 6-3's signature and THRU rules, and para 6-4's signature-block rules were all confirmed against this pass with nothing left uncited.

**Out of scope, confirmed rather than assumed.** Para 6-10, auto-pen signatures, governs a physical stamping device and when its use is prohibited (sworn declarations, court-martial documents, property transactions) — a mechanical choice made when the document is executed, not a fact a `.docx` spec carries, the same relationship appendix F's Acrobat boxes have to the file. Chapters 7 and 8 (§13c) hold up under the closer read: every remaining paragraph in both names a specific form, label, or cover sheet — OF 41, DA Form 1222/5/200/209, DA Labels 87/113/115, SF 703/704/705 — external artifacts the regulation identifies by number rather than content this module could render.

---

## 13i) Making the MFR bulletproof

Every measurement in figure 2-17 already had a check — office symbol to `MEMORANDUM FOR RECORD` on the third line, `SUBJECT:` on the second, text on the third below that, the signature block on the fifth line below the text, `Encl` beside the name, the digital-signature-box position, the abbreviated form down to the `.docx` itself. Re-measuring the figure directly (rasterised at 200 dpi from the source PDF, the same discipline as the seal) confirmed all of it, including the one gap the figure itself leaves: no line count appears between its steps 7 and 8, which is the figure choosing not to re-annotate an ordinary paragraph gap rather than a rule of any kind.

What was not yet bulletproof was everything upstream of the layout - whether a real request actually *reaches* that layout as a memorandum for record at all.

**Intent detection missed half its own cases.** `detectMemoType()`'s record rule matched a verb then a noun in that order - `document ... call` - which is exactly backwards from how people as often say it: "I had a meeting... need to document it" names the event first. Four of six natural phrasings tested came back `standard` silently. Rewritten as two lookaheads, `(?=.*record-verb)(?=.*record-event)`, order stops mattering - each lookahead only asserts its half is present *somewhere*, not where - and `memo for record` (not the regulation's full name) was added as a literal alternative. Precision held: a record verb with no named event, or a meeting mentioned with no record verb, still falls through to `standard`, checked explicitly in `verify.js` alongside six corrected true positives.

**Getting the type right was not enough - the assembly still let the wrong fields through.** `army-memo-agent.js` and `memo-server.js` each independently remembered to null `letterhead` and `authorityLine` for a detected `"record"` type; neither remembered `addressees` or `thru`. Reproduced directly: a request that resolves to `"record"` but is answered with content or a stale form field carrying an addressee came out *addressed* - `MEMORANDUM FOR RECORD` at the top of the page and a real addressee below it, a memorandum fig 2-17 does not describe and the validator correctly refused as `mfr-addressee`. The fix moves the guarantee into `assembleMemo()` itself - the one function both callers already route through - so it holds regardless of what drafted content or a caller's context supplies, and holds for every future caller too, rather than being one more thing each new call site has to remember to duplicate. That duplication is exactly how the gap got in the first place.

Both fixes were confirmed the same way as everything else in this file: verified against the reintroduced fault before being put back, with the specific failing phrasing kept as a named test rather than folded into a passing average.

---

## 14a) The unit's fields, and the memorandum's

AR 25-50 is one regulation, but a memorandum written under it is not interchangeable between offices. Two different lifetimes are mixed together in a spec:

| | Fields | Lifetime |
| --- | --- | --- |
| **The unit's** | organization, street address, city/State/ZIP, office symbol, signer name, grade and branch, duty title | the same on the next memorandum, and the one after |
| **The memorandum's** | subject, MEMORANDUM FOR, MEMORANDUM THRU, date | different every time |

`unit-profile.js` is the one place that knows the difference. Nothing in it is a rule about *format* — the layout is identical whatever these say, which is the entire point of the slots — so what it encodes is **who each field belongs to**, with the paragraph that puts it on the page.

It also knows which questions do not apply. An MFR is on plain white paper (fig 2-17), so it is never asked for a letterhead; it has no addressee either. An MOU carries no office symbol (para 2-6c). The abbreviated MFR of note 7 omits the office symbol *and* the subject. Asking for a field a memorandum does not have is its own kind of wrong.

**A placeholder counts as outstanding.** `[FULL NAME]` is what a template puts where a name goes — a blank wearing a disguise — so it is asked for, and `profileFrom()` refuses to save one. A profile that stored the regulation's own example text would hand the next memorandum a field that looks filled in and is not.

**A profile fills blanks; it never overwrites.** One office sometimes signs for another, and the memorandum in hand is the more specific statement.

Three ways to supply them, and they agree because they read the same list:

```bash
# once
node army-memo-agent.js --template standard --save-unit unit.json
# thereafter
node army-memo-agent.js --unit unit.json --docx memo.docx "..."
```

- the **CLI**, with `--unit` / `--save-unit`
- the **front end**, which splits the form into *Your unit* and *This memorandum*, remembers the first on the browser, and has a **Forget** button
- **Word itself** — every field left blank is a click-to-type content control, editable as text with the formatting locked (§15 and §16)

The check worth having is the negative one. `verify.js` asserts that the page's remembered list is exactly the unit-scoped fields, and names `subject`, `addressees`, `thru`, `date` and the rest individually to assert they are *not* remembered. A subject carried over from the last memorandum and quietly filled into the next is how the wrong office receives something that looks right.

---

## 15a) The closing: what a memorandum carries and what the figure only points at

Two things came off the page here, both because a figure's *annotation* had been read as a figure's *content*.

**`[place digital signature block here]` is not text.** Figures 2-1, 2-14 and 2-17 all print it on the third line below the authority line, and it had been rendered literally — so every generated memorandum carried an instruction to the typist into a signed document. It is the regulation pointing at the space a digital signature occupies. That space is already there: para 2-4c(2)(a) begins the signature block on the fifth line, so a signature applied over it lands exactly where the figures put the annotation. Nothing needs to be emitted to reserve it.

The figures caption themselves in more than one place — figure 2-11 also carries `[insert text box here]` and `[insert digital signature box here]` on the THRU line, pointing at the boxes appendix F describes. `verify.js` now sweeps every type for all three, because the failure mode is silent: the page still lays out correctly, it just has an instruction printed on it.

**Appendix F turned out to be out of scope for a .docx generator, and the regulation says so itself.** Para 1-17 introduces it: *"The Army will replace analog or 'wet,' signatures with digital and electronic signatures... See appendix F for instruction on creating **Adobe .pdf files** and placing the digital signature box and text boxes for date and comment as required."* Appendix F is instructions for a human converting a finished document to PDF in Acrobat and placing form fields there — it is not a Word layout the memorandum's own template should draw.

That reframes what "supporting appendix F" means for this renderer. Its job stops at getting the office to that conversion step with the right document: the date already sits flush right on the office symbol line, exactly where para F-2e's date box goes (`F-2e: "Top of the document, on the office symbol line, right edge aligned with the right margin"`); the signature block's three blank lines above the name are exactly the space a signature box goes into, per addressee for a THRU chain (F-2i) and per signer for a multi-signature memorandum (F-2h — the MOU/MOA path already gives each signer an overscored rule and a `(Date)` line of their own). Drawing an actual bordered rectangle in the `.docx` would be inventing Word content the regulation never asks the Word document to carry — the box belongs to the PDF, made in the PDF.

The appendix's own figures (F-1 onward) were not available to check this against directly: the uploaded pages run to printed page 100, still inside appendix D at that point. What is confirmed is the paragraph text itself (para 1-17's cross-reference, and the F-2 paragraph citations already carried in `ar25-50.js`), and that the sweep above already guards the one thing that *would* go wrong in a Word template — printing the figure's bracketed instruction as if it were the memorandum's own text.

**The authority line is conditional, not default.** Para 2-4c(1): *"The authority line is used by individuals properly designated as having the authority to sign for the commander or head of an office."* If the signer is the commander, there is no authority line — and figure 2-17 note 6 says of the MFR outright: **"Do not use an authority line."** The templates no longer ship `FOR THE COMMANDER:`; a memorandum that needs one supplies it, and the five lines are then counted from it instead of from the last line of text, which para 2-4c(2)(a) spells out as two separate cases.

---

## 15c) The decision memorandum's approval line

Figures 2-18 and 2-19 are the same memorandum in two forms, and they differ in one place:

| | Mark |
| --- | --- |
| Figure 2-18, signed by hand | `APPROVED` then an **underlined X** — the rule is the blank the approver strikes |
| Figure 2-19, signed digitally | `APPROVED` then a **checkbox** the approver clicks |

Both are emitted; `digitalSignature: false` selects the first. The underline was missing at first — a bare `X` sitting on nothing, which reads as a decision already taken rather than a space to mark. The figure prints the rule at 150 px/in and the source now carries `_X_`, the same underscore convention the decision memorandum's own underlined headings use.

---

## 15b) One space after the paragraph number

Para 1-39b(10) reads *"Space ¼ inch to the right of the parenthesis when numbering subparagraphs"*, and the figures bear the quarter inch out: across figures 2-3, 2-4, 2-7, 2-10, 2-11, 2-12 and 2-14 — 37 numbered paragraphs — the text starts a median **0.251 in** from the left margin.

It is nevertheless set to **one space**, on instruction, and `LAYOUT.labelSpaces` records that it is a departure and what it departs from. The reading is defensible: 1-39b(10) is about where a *subparagraph* begins, and figure 2-17 note 3 uses *"one space after the colon"* for the subject line, so one space after a number is the same convention. Set `labelSpaces` to `null` and the quarter-inch grid comes back.

The *indents* are untouched — `a.` at a quarter inch, `(1)` at a half, both stated outright in figure 2-1. Only the gap between a number and its own text changed.

One implementation note: the number and its space are a single run, `"1. "`, not a run plus a tab. A tab needs a stop, and a stop one space wide is not a grid position — change the label's width and Word advances to the next stop instead of holding the space.

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

## 16b) Every template's own editing surface was never actually a slot

Asked to confirm the templates are genuinely ready to select and fill in — the same standard §14a and §16a were built to — running `createTemplate()` straight through to a `.docx` and inspecting the actual XML found that none of it was true. A fresh template rendered **zero** content controls, anywhere, for any type.

The cause was a mismatch nobody had reason to notice from either side alone. `slot(value, prompt)` decides "real content or click-to-type slot" by asking whether `value` is truthy - and `createTemplate()`'s own defaults are never empty, they are self-documenting bracketed text: `officeSymbol: "[OFFICE SYMBOL]"`, `signature.name: "[FULL NAME]"`. Truthy, so `slot()` printed it as plain text. `recordFieldPlaceholders()` (genuinely empty strings) produces real slots and is what the front end's blank-form path happens to use - which is why the bug was invisible there - but the CLI's `--template` flag, and anyone calling `createTemplate()` directly, got a document that looked identical to a filled-in one, with nothing to click.

Three call sites shared the pattern, and all three needed the same fix - recognizing a `[BRACKETED]` value as "not yet supplied," the same test `findPlaceholders()` already uses everywhere else in this codebase, just missing from the one place the `.docx` gets built:

- `slot()` itself, fixed once, which covers office symbol, date, and subject automatically wherever it's called.
- `letterheadHeader()`'s `upper()` helper, which decided the organization/street/city-state-zip lines by truthiness the same way.
- `signatureBlockLines()`'s all-or-nothing gate (`!resolved.name && !resolved.gradeAndBranch && ...`), which needed the same substitution per field.

**A fourth site turned up doing the same audit on the MOU/MOA agreement templates**, which sign through a `signers` array instead of the single `signature` object and go through a completely separate renderer (`agreementClosingParagraphs()`) - never touched by the fix above, and never covered by the validator's `checkPlaceholders()` either, which didn't scan `memo.signers` at all. Fixing the rendering side turned up a second bug in the same code: giving both signer columns the same slot prompt ("NAME") produced two content controls with the *same* `w:id`, since a slot's id is a hash of its prompt text. Word requires distinct ids. The fix disambiguates by column - `JUNIOR OFFICIAL NAME` / `SENIOR OFFICIAL NAME`, matching the labels the template itself already uses - and a civilian signer's `gradeAndBranch` being genuinely *absent* (not blank, not a placeholder) still correctly omits the line entirely rather than forcing an unwanted slot onto a two-line civilian block (para 6-4a, Note 2).

Every template now renders real content controls for exactly its own matters of record and nothing else: an MFR gets none for a letterhead it doesn't have (fig 2-17), an MOU/MOA gets none for an office symbol it doesn't have (para 2-6c(1)), and a fully-supplied real memo still renders as ordinary text, confirmed the same way it always was. `checkPlaceholders()` now sweeps `signers` alongside `signature`, so an unfilled MOU/MOA is reported the same as an unfilled standard memo. Every fix was confirmed by reverting it individually and watching the specific check it was for fail, including the duplicate-id case, before being put back.

---

## 16c) Three memorandum types with nowhere to select them

The same pass asked a broader question: does every type AR 25-50 defines actually have a template, so a user can select it at all? `MEMO_TYPES` in `ar25-50.js` names nine memorandum types, plus the letter - `exclusiveFor`, `appreciation`, and `commendation` among the nine, each with real support already built into the formatter (para 1-12b(1)'s distinct `Memorandum Exclusive For` keyword, the personal-address exception of para 2-4a(5)) and the validator (`PERSONAL_ADDRESS_TYPES`). But `TEMPLATES` in `templates.js` only ever built six of the nine, plus the letter - `createTemplate("exclusiveFor")` threw `Unknown memorandum type`. Neither the CLI's `--template` flag nor the front end's type selector could ever produce one; the type existed only for a spec somebody built by hand.

All three share one shape - a standard memorandum in every respect except who it is addressed to, a name and title rather than an office (the same exception "Exclusive For" correspondence and recognition memorandums both get from para 2-4a(5)) - so `exclusiveFor()` and a shared `recognition("appreciation"|"commendation")` builder both call the same `base()` every other memorandum type uses, overriding only `addressees`, and fields the formatter already knew how to read but no template had ever supplied: `addresseeTitle`, and - for "Exclusive For" only - `addresseeAddress`.

That split is deliberate, not an oversight, and it was wrong the first time this was written. Para 1-12b(1) spells "Exclusive For" out as three elements - `Memorandum Exclusive For [Full Name], [Title], [Mailing Address]` - but para 2-4a(5)'s exception for appreciation and commendation names only two: *"address the memorandum to the name and title of the addressee."* No mailing address. The first version of `recognition()` templated one anyway, copying the three-element shape from "Exclusive For" without checking whether para 2-4a(5) actually asked for it - caught on a second pass back through the source PDF rather than by re-deriving from the codebase's own existing (and in this one case, wrong) `addresseeAddress` handling. Fixed by dropping the field from `recognition()` entirely; the formatter still honors one if a caller supplies it; nothing prompts for it.

Wiring three new templates in exposed two more places that hadn't reached `addresseeTitle`/`addresseeAddress` at all:

- **`checkPlaceholders()`** didn't scan either field - the same class of gap `signers` had in §16b - so a template's own `[TITLE]` would never be reported as unfilled.
- **The front end** (`specFromForm()`, `assembleMemo()`) had no path for either field at all - not missing a fallback, missing entirely - so even with the template fixed, selecting one of these three types on the page would drop both fields on the floor. Fixed the same way `thru` already falls back to the template's own placeholder when the form leaves it blank.

Auditing that fallback turned up a third, older bug in the same code while it was open: the comment beside `addressees` said an unsupplied one "falls back to the template's placeholder rather than to nothing," but the code next to it (`lines(form.addressees)`, no fallback) never did that for *any* type - not just the three new ones. Fixed to match what the comment already promised. The one visible consequence: a blank addressee is now reported as `unfilled-placeholder`, the same way office symbol and signature already are, rather than `not-yet-supplied` - moved to match, not something anyone should have to remember, so a small correctness fix and a scope-completion pass turned out to be the same commit.

All three types are exercised everywhere the existing six already were - font-size ceiling, "raises no errors," content-control presence, the front end's own render - plus their own checks for the personal-address heading construction, including a negative check that appreciation and commendation raise no `addresseeAddress` finding at all, since they have no such field. `node army-memo-agent.js --list-types` now lists all ten, aligned; the column width used to be a fixed 9 characters, too narrow for `exclusiveFor`.

---

## 16d) The MFR as the backbone: five requests, not one

Everything upstream of layout - `detectMemoType()`, `assembleMemo()`, the draft/validate/repair loop in `runMemoAgent()` - is the same machinery every memorandum type routes through. The MFR is where it has been proven hardest twice already this session, which made it the natural place to ask a broader question: is this actually solid enough to be the pattern the rest of the application relies on, or does it just happen to survive the one demo it has always been run against?

`OFFLINE_CONTENT` is one canned example - a range closure, phrased one way. Five distinct requests were built instead, each carrying its own drafted content the way a model's answer would (no live model is available in this environment, so simulated content stands in for it, exercising the exact seam `runMemoAgent()` takes a real model through), covering every use para 2-7a actually names for an MFR:

| Request | Para 2-7a's use |
| --- | --- |
| "I need to document the basis for approving SGT Ramirez's emergency leave" | "the authority or basis for an action taken" |
| "I had a staff meeting about the barracks renovation budget and need to document it" | "informal meetings... when official business was conducted" |
| "I had a phone call with the range safety officer and need to write it up" | "telephone conversations when official business was conducted" |
| "capture the decision reached at today's planning meeting" | official business, a decision |
| "document our site visit to inspect the fire extinguishers in Building 4400" | official business, an inspection |

Running all five end to end - intent detection, assembly, validation, and a real rendered `.docx`, not just the layout math - found two real gaps neither of the previous MFR passes had exercised:

- **"Write it up."** The trigger list matched the literal phrase `write up`; natural speech puts the object in the middle - "write *it* up," "write *this* up." Fixed by making the pronoun optional between the two halves.
- **"The basis for an action."** Para 2-7a names this *first*, before meetings or calls, and nothing in the trigger list covered it at all - a request that used the regulation's own vocabulary for an MFR's oldest, plainest use still fell through to `standard`.

Chasing the second one down turned up a third, broader gap while the pattern was open: every verb in the trigger list matched only its bare form - `document` but not `documenting`, `record` but not `recorded` - because `\bdocument\b` does not match inside `documenting` (no word boundary between "t" and "i"). Fixed with bounded per-stem suffixes (`document(?:s|ed|ing)?`, and so on) rather than a `\w*` wildcard, which would have been the easy fix and the wrong one - `\blog\w*\b` matches "logistics" too. A dedicated check keeps that regression named: "logistics" alongside an unrelated "meeting" must not select the MFR.

Both fixes confirmed by reverting them and watching the specific checks fail - the two backbone scenarios' own intent-detection checks among them, not just the narrower unit tests written to isolate each cause. All five scenarios are asserted end to end twice: once with a saved unit profile (office symbol, date, signature all real values), confirming a returning user gets a memorandum with nothing left to click into; once with none (a first-time user), confirming the same five still produce real content-control slots rather than a half-finished document. 795 -> 827 checks.

---

## 16e) A form that shows only the fields the type in hand actually has

`unit-profile.js`'s `FIELDS` array already answered "does this field apply to this memorandum type" - it is what `/fields`, the "still to be supplied" list, and `outstandingFields()` are all built from. What it never reached was the page itself: every input was hardcoded, shown for every type regardless of whether that type carries the field at all. A standard memorandum's form and an MOU's were the same 20-odd inputs, most of them meaningless for whichever one you had picked - the office symbol on an agreement that has none (para 2-6c), an authority line on an MFR that fig 2-17 forbids one on.

Reading the served page directly - not just the backend logic - turned up three gaps the earlier passes hadn't reached:

- **`addresseeTitle` and `addresseeAddress` had no input at all.** `specFromForm()` already read them (added while wiring the three new templates in §16b/16c); the page had nowhere to type them. An "Exclusive For" memorandum's title and mailing address (para 2-4a(5), para 1-12b(1)) were reachable only through the raw JSON spec, never through the form built to produce one.
- **MOU/MOA signers were hardcoded to the template's placeholders.** `specFromForm()`'s agreement branch set `memo.signers = template.signers` unconditionally - there was no form field a real signer's name could reach, and "Addressees" was silently repurposed as the agreement's party list under a label that said something else.
- **Every field showed regardless of type.** No structural problem, but the opposite of "not sloppy": filling in an office symbol for an agreement that will never render it is exactly the kind of thing that makes a form feel unreliable.

The fix extends the existing single source of truth rather than duplicating its judgment in the page's own markup, which is what made the earlier CLI/server letterhead-clearing bug (§13i) possible in the first place - two copies of one rule, one of them stale. `field()` now wraps every input `FIELDS` knows about in `<div class="field" data-field="<path>">`; a new `fetchFields()` in the page's own script calls `POST /fields` with the current form state - on load, on the type `<select>`'s `change`, and after `/detect` resolves on request blur - and shows or hides each container by whether its path came back, rewriting the label and hint from the answer so a letter's "Grade and component" and a memorandum's "Grade and branch" are never both on screen under the same input. Hidden fields keep whatever was typed in them: switching the type to check something and back does not lose it, and the render path was already proven safe for this in §16b - `memo-docx.js` gates `addresseeTitle`/`addresseeAddress` on `PERSONAL_ADDRESS_TYPES.includes(memo.type)` at the point of use, so a stale value in a hidden field is inert, not wrong.

Two things `FIELDS` cannot model got handled separately rather than forced into the same lookup:

- **The MOU/MOA signer columns** are an array of two objects, not a single path - `plainField()` (the pre-existing behavior, no `data-field` wrapper) is used for `signer1Name/Grade/Title` and `signer2Name/Grade/Title`, and the whole "Signers" fieldset is toggled by `data.type === "mou" || data.type === "moa"` instead. A field wrapped in a `data-field` container keyed to its own id would never appear in a `/fields` answer and would stay hidden forever - `verify.js` asserts none of the six carry one.
- **"Your unit" going empty.** An agreement clears every unit-scoped field at once - no letterhead, no office symbol, no lone signature block (para 2-6c) - which left a fieldset holding nothing but its intro paragraph and a Forget button. Hidden as a whole when none of its fields are visible; "Your words" and "This memorandum" are never emptied out this way (the body and the date are never gated), so the check is applied only to `#unitfields`, not generically.

Two new `FIELDS` entries - `authorityLine` and `suspenseDate` - had existed only as hardcoded, ungated inputs before this pass; both are now genuinely typed fields with `when()` predicates (present on a standard memorandum, absent from an MFR, an agreement, and a letter) rather than static markup that happened to be right for most types and silently wrong for the rest.

Verified against a live server over real HTTP, not just against the template string: every distinct `FIELDS` path (all but `subject`, which stays on the page unconditionally - para 3-6a(2) makes a letter's subject optional "if used," not absent, and the validator accepts one either way) has a container on the served page; `/fields` for `mou`/`exclusiveFor`/`standard`/`letter` returns exactly the paths each type's own `when()` predicates say it should; a filled MOU form round-trips through `specFromForm()` into the actual `.docx` XML - signer names, grades, titles, and the party list all present, not the template's placeholders. Confirmed with Playwright against the running server across five types (standard, MOU, "Exclusive For", MFR, letter): screenshots at each step, zero console errors, and the downloaded MOU's `document.xml` inspected directly for the typed signer names. Each of the three gaps above was fault-reintroduced and confirmed to fail its own new check before being fixed for good. 827 -> 877 checks.

---

## 16f) Tightening: what the page still could not say, and what it said wrong

A second pass over the front end, this time hunting the seams between what the *validator* can express and what the *form* can - every rule the validator enforces that the page gave no way to satisfy is a dead end where the only fix is editing raw JSON.

**Four fields the backend understood and the page could not reach:**

- **`distribution` / `seeDistribution`.** Para 2-4a(5)(c): more than five addressees is a SEE DISTRIBUTION memorandum carrying a `DISTRIBUTION:` listing. The validator enforced both halves (`see-distribution-required`, `distribution-list-missing`) and the form could satisfy neither - a sixth addressee produced an error whose only cure was the spec editor. Now `specFromForm()` sets the flag automatically past the threshold and defaults the listing to the addressees already typed - the office types the recipients once, and the format follows the count. A Distribution textarea (a new gated `FIELDS` entry) appears only once it applies, for the office that wants the listing to read differently.
- **`digitalSignature`.** The spec carried it, `checkDigitalSignature()` keyed real advisories off it (the para 6-3d wet-signature line-through for THRU chains, appendix F's Acrobat boxes), and fig 2-18/2-19 switch the decision approval line on it - and the form pinned it `true` with no way to say otherwise. Now a checkbox, defaulting to checked; a checkbox submits only when checked, so `specFromForm()` reads *absence from the form* - not a blank - as unchecked. Hidden for letters by id rather than through `FIELDS` (a checkbox is never "still to be supplied," so the outstanding-fields model is the wrong lookup for it): "digital signatures will not be used on letters" - para 3-6c(2)(b) - is not the author's choice to make.
- **`toCommanderOf`.** Para 1-12b(1)'s second "Exclusive For" form - addressed to the commander of an organization rather than a named person, with its own keyword. Rendered by both renderers, tested, and unreachable from the page. Now a gated field for `exclusiveFor` only. Deliberately *no* template placeholder: unlike `addresseeTitle`, blank here is an answer ("the named person above"), not a question still open.
- **The subject word count.** Para 2-4a(6) is checked by the validator, but only after Generate - the page said "ten words or less" and made you count them yourself. A live counter under the input now shows the count as you type and turns amber past ten; advisory, not blocking, because the regulation itself says "if possible."

**Two things the page said that were wrong, found by *looking at the screenshots* rather than the assertions:**

- **A dishonest label.** Switching to "Exclusive For" showed the addressee textarea labeled "MEMORANDUM FOR - the office expected to complete the action. One per line." - all three claims false for a type that names one person, no office, no list, and no MEMORANDUM FOR keyword (para 1-12b(1) has its own). The `FIELDS` entry split in two: the multi-recipient wording for the types that have a list, "Addressee's name - the person this is for" for the three personal-address types. `specFromForm()` also trims stray extra lines to the one name these types ever render, so a list left over from switching types cannot trip the multi-recipient checks over data that would never print.
- **A field that vanished mid-edit.** Once a sixth addressee crossed the threshold, "addressees" dropped out of `/fields`' answer (SEE DISTRIBUTION replaces the heading, so as a *question* it is gone) - and the page, faithfully applying the answer, hid the textarea the user was typing in. `/fields` now also reports `seeDistribution` itself, and the page keeps the field visible with its label rewritten to say what the list now is: the default distribution.

**And one the user hit before any check did: the MFR preview cut off mid-page.** The preview iframe was a fixed `74vh` box scrolling its own content, nested inside `#out` - which *also* scrolls (it is sticky, so a finding stays on screen beside the line it is about). Two independently scrolling regions nested in each other meant the signature block of anything longer than a short memo sat out of view inside a box only partly visible inside another box, reachable by no single scroll gesture. `resizeFrame()` now reads the loaded document's real height and grows the iframe to match, collapsing the two scrolls into the one that already existed. (A `srcdoc` iframe's `contentDocument` is same-origin-accessible from its parent even though its opaque origin blocks resource *loading* - the seal workaround and this read are different operations, which is why one needed a served URL and the other just works.)

The download buttons also stopped naming every file `memorandum.docx`: the filename is now the type and subject slugged (`record-staff-meeting-on-barracks-renovation-funding.docx`), so five downloads in a row stop overwriting each other.

One more served-source bug class got a permanent check: the page's script lives inside a JavaScript template literal, where `\s` is not an escape sequence - the outer literal silently drops the backslash at build time, and the *served* regex matches literal `s`, not whitespace. The word counter shipped broken exactly this way (its count was the number of `s`-separated fragments); the fix is `\\s` in the source, and the check asserts the served HTML contains the backslash intact, because the file on disk can read correctly and still serve the wrong thing.

All verified the same way as §16e - live server, real HTTP, Playwright across the affected types with zero console errors, each fix fault-reintroduced and its check watched to fail - plus, for the preview fix, the user's own reproduction re-run and screenshotted: one scroll from heading to signature block. 877 -> 911 checks.

**The preview's second cut, and the general fix.** The height fix above was half a fix, and the user caught the other half: the memorandum is a fixed 8.5-inch sheet - 816 CSS pixels that may not reflow, because every measurement on it is the regulation's - so on any pane narrower than that (a laptop window, a split screen, a phone) the sheet overflowed the iframe sideways and the right half of the document was gone. Technically it sat behind the iframe's own horizontal scrollbar; with the iframe now grown to full content height, that scrollbar was at the bottom of a frame several screens tall - reachable in principle, invisible in practice.

A document with fixed geometry gets the PDF-viewer treatment: `fitPreview()` measures the sheet's natural width against the pane's, scales the whole document down to fit (CSS `zoom` rather than `transform: scale()`, because zoom participates in layout - `scrollHeight` then simply reports the scaled size, and the iframe height needs no manual scaled-box arithmetic that could drift), never scales *up* past natural size on wide panes, and re-fits on window resize, coalesced to one measurement per animation frame. Verified live at five window widths - 1720px (natural size, centered), 1400px, 1100px with a two-page memorandum (both pages covered), 1000px (the reported failure case), 950px reached by *resizing after* Generate, and 480px single-column mobile - asserting at each that the document's scroll extent fits the frame in both axes, with screenshots and zero console errors.

The first attempt at the fault-reintroduction check here is itself worth recording: the check asserted the served page contains a `.zoom =` assignment - which also matches the *reset* line (`zoom = ""`), so deleting the actual scaling left the check green. The check now pins the applying line (`zoom = String(scale)`) specifically, and was watched to fail against the reintroduced fault before the fix went back. A check that cannot fail is not a check. 911 -> 913.

---

## 16g) The MFR goes out on letterhead: an owner decision, recorded as one

The owner directed that an MFR is never prepared without the seal and the DEPARTMENT OF THE ARMY letterhead - reading para 2-7 as the governing text (its 2-7b(1) heading spec names the office symbol, date, and subject, and says nothing against letterhead) and fig 2-17's plain-paper example as illustrative of the informal-meeting use, not a prohibition. The code had read fig 2-17 ¶1 ("Type the MFR on plain white paper") as binding; the owner's reading now governs, and the deviation is recorded here rather than papered over.

What changed, in every layer that had forced plain paper:

- `templates.js`: the record template no longer overrides `base()`'s letterhead - an MFR template ships with the same letterhead placeholders as a standard memorandum's.
- `memo-intent.js` `assembleMemo()`: the `isRecord` guarantee still clears addressees, THRU, and the authority line (undisputed - fig 2-17 step 6, and MEMORANDUM FOR RECORD is the whole heading), but no longer nulls the letterhead.
- `memo-server.js` `specFromForm()`: the record special-case on letterhead is gone; an MFR's letterhead comes from the form or falls back to slots, same as any memorandum. The /generate plain-paper note now names only the agreements.
- `memo-formatter.js` `usesLetterhead()` and `unit-profile.js`'s own `usesLetterhead()`: the record short-circuit removed - the page asks an MFR for its letterhead fields, and both renderers draw the seal and header.
- `memo-validator.js`: the `mfr-letterhead` error is deleted; letterhead on an MFR is the required state, not a finding. `mfr-authority-line` and `mfr-addressee` stay.

Every check that had pinned plain paper was flipped to pin the new behavior instead, cited "para 2-7 as directed" so a future reader can tell the owner-directed rules from the regulation-quoted ones: the .docx first-page header must now carry the seal (`<w:drawing>`) and DEPARTMENT OF THE ARMY; an MFR's page 1 starts where a standard memorandum's does; /fields asks an MFR for its letterhead; letterhead on an MFR raises no finding; and the five backbone scenarios assert the letterhead is present. Verified live: the preview shows the seal (image loaded, not a placeholder), and the downloaded .docx's header part contains the drawing, the department line, and the unit's three lines, with no authority line. 913 -> 919 checks.

**Two follow-on owner directions, same session.** The date now defaults to today in military style on every generated memorandum - a memorandum generated today is dated today in the owner's workflow; typing a date still overrides, and para 2-4a(3)(b)'s sign-then-date practice remains available by typing the signing date. This is the one deliberate exception to the blank-not-plausible rule for matters of record, and the exemption is commented at the check that enforces the rule for everything else.

And the example now leads: selecting a type - by the dropdown or by the request being read - renders that type's templated example immediately, and every committed field edit (headers, signature block, enclosures) re-renders the preview with the typed value in place of the template's, debounced, no Generate press needed. Enclosures were confirmed never forced - no Encl line exists until a title is typed, and one typed title is placed beside the signature block - now pinned by checks. The full flow was verified live in the browser: select MFR -> example with seal, letterhead, and today's date appears on selection alone; each field typed replaced its templated counterpart on blur; the enclosure title appeared only after being supplied. 919 -> 924 checks.

---

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

**Without a model, everything else still works.** `/health` reports whether one is present, the page disables the drafting button and says where it looked, and `/draft` answers 503 with the path and what to do about it. The formatter, the validator, the templates, the `.docx` and all 924 checks need no model at all — the parts that must be exactly right are the parts that do not need one.

Configuration is environment-first, so a deployment changes nothing in the source: `MEMO_MODEL_PATH`, `MEMO_CONTEXT_SIZE`, `MEMO_DRAFT_TIMEOUT_MS`, `PORT`, `HOST`. The server binds loopback unless told otherwise — it serves an editable Word deliverable and loads a language model on demand, so reaching it from off-box should be a decision somebody made.

---

One structural note. `army-memo-agent.js` ends in a top-level `await main()`, so nothing it imports may import it back — the entry module's evaluation never completes, the cycle never settles, and `--serve` exits with *"unsettled top-level await"* instead of listening. `memo-intent.js` exists to hold what the CLI and the front end both need. `verify.js` asserts the cycle stays broken.

---

## Scope

This example implements **chapter 2** of AR 25-50 (memorandums) and **chapter 3** (letters), the chapter 1 rules that govern both, the chapter 4 enclosure and tabbing rules, the chapter 5 addressing rules that reach inside the correspondence, the chapter 6 signature blocks and authority lines, and appendices B, C, D, E and F. All nine memorandum forms `MEMO_TYPES` names are covered: standard, THRU, memorandum for record, decision memorandum, MOU, MOA, "Exclusive For" correspondence, memorandum of appreciation, and memorandum of commendation - plus the letter, the other correspondence vehicle chapter 3 governs and para 3-2 reserves a fixed audience to (the President, Congress, the Supreme Court, Governors, mayors, foreign officials, and the public). Addressing a *memorandum* to any of them raises a `wrong-vehicle` finding rather than a formatted document; `LETTER_AUDIENCES.deltas` carries the chapter 3 differences a letter needs instead - a centered civilian date, an inside address and salutation, indented unnumbered paragraphs, a complimentary close, no authority line, and page numbers at the top - and `buildSignature(signer, "letter")` produces the letter form of a signature block. Forms of address are in appendix C, which para C-2a scopes to letters only.

Three places hand formatting authority to something outside this module, and each is reported rather than papered over:

- **Para 1-6 Note and para 2-2 Note.** Memorandums signed by HQDA principal officials, or originating in the Army Secretariat or Army Staff, are governed by DoDM 5110.04 Vol 1 and the HQDA Writing and Product SOP. Neither is public. `supersedingAuthority()` detects both triggers.
- **Appendix F.** Every box it describes is an Acrobat form field created *after* the Word file exists, so a `.docx` cannot be signature-ready. The requirements it adds - a signature and comment box per THRU addressee, one box per signer - are reported with the count the memorandum implies.
- **Chapter 8.** AR 25-50 states no classification marking rule at all; it defers entirely to DoDM 5200.01. Nothing is invented here.

Two judgement calls are flagged in the code rather than hidden:

- **Page numbering.** Para 2-5d states no exception for the first page of a multiple-page memorandum, so the default numbers it. Set `numberFirstPage: false` for the common office practice of numbering continuation pages only.
- **Letterhead geometry.** AR 25-50 requires the APD template but does not publish its point sizes. The values in `LETTERHEAD` are the template's defaults and are labelled as such - they are not quotations from the regulation.
- **`CF: (w/o encls)`.** Para 2-4c(5) spells it `w/o encls`; figure 2-14 prints `wo/encls`. The prose wins, since it states the rule explicitly.
- **The DoD seal is never drawn.** Para 1-16b(1) requires it and para 1-16b(2) forbids substituting any other device, so the renderer uses the official image from the APD template or none at all. See `assets/README.md` - it is a one-time setup, because the seal does not change.
