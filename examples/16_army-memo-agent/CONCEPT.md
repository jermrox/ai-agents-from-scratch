## Specification-bound generation: the Army memorandum agent

**Idea:** When the output has a written specification, do not ask the model to satisfy it. Give the model the part that is genuinely language - the words - and give the specification to code that can be tested against it. The agent's job is to route findings back to whichever half owns them.

This example builds memorandums that comply with **AR 25-50 (Preparing and Managing Correspondence)**, the Army regulation that governs how a memo is laid out down to the line: *"Type 'MEMORANDUM FOR' on the third line below the office symbol"* (para 2-4a(5)).

---

### Why not just prompt for it?

The obvious approach is to paste the regulation into the system prompt and ask for a memo. It produces something that looks right, and it is wrong in ways nobody catches until a staff action comes back.

The failure is structural, not a matter of a better prompt:

- **Layout is not in the token stream.** "The fifth line below the authority line" is a property of a rendered page. A model emitting text has no representation of a line count it can check; it pattern-matches on memos it saw in training, most of which were themselves non-compliant.
- **The rules interact.** Whether a paragraph is numbered depends on how many paragraphs exist (para 2-4b(4)(a)). Whether the address block sits on the `MEMORANDUM FOR` line depends on how many addressees there are (paras 2-4a(5)(a)-(c)). Whether the closing may start a page depends on how many lines of the last paragraph precede it (para 2-5c(4)). Each conditional multiplies the ways a single pass can go wrong.
- **It is unverifiable.** If the model emits a memo as prose, the only way to check the spacing is to re-derive the layout from the text - which is the work you were trying to avoid.
- **The regulation changes.** The 4 October 2024 revision reversed the sentence-spacing rule from one space back to two (para 1-39b(9)). A prompt-based system has that rule spread across an instruction, the examples, and the model's priors. A codified system has it in one constant.

---

### The split

```text
request  ──▶ LLM ──▶ memo content (JSON, grammar-constrained)
                          │
             context ─────┤   office symbol, ARIMS number, date,
        (facts of record) │   letterhead, signature block
                          ▼
                    memo spec
                          │
                          ▼
                 layoutMemo()  ── AR 25-50 line counts and inch measurements
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        renderText()            renderHtml()          ← two backends, one line model
              │                       │
              └───────────┬───────────┘
                          ▼
                  validateMemo()  ── every finding cites a paragraph
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      content findings         format findings
      (back to the LLM)     (a bug in the renderer)
```

The model never emits `MEMORANDUM FOR`, a date, a signature block, or a paragraph number. It emits a subject, a list of addressees, and paragraphs tagged with a subdivision level. It **cannot** get the spacing wrong, because it never touches the spacing.

---

### What each half owns

| Owned by code | Owned by the model |
| --- | --- |
| Line counts between every element | Whether the first sentence states the purpose |
| Paragraph labels, indents, tab stops | Whether the subject fits in ten words |
| Two spaces after ending punctuation | Whether the voice is active |
| Single vs. multiple vs. SEE DISTRIBUTION addressing | Whether a point of contact is present |
| Page breaks and continuation headings | Whether "Soldier" is capitalized |
| `Encl` vs. `4 Encls` | Whether the paragraph is under ten lines |

The validator tags every finding with which column it belongs to. Only the right-hand column is fed back to the model - sending it a layout complaint would invite it to hand-format the output, which is exactly the failure being engineered out.

---

### Constrained decoding is the enforcement mechanism

`llama.createGrammarForJsonSchema()` compiles the content schema into a grammar that the sampler enforces token by token. The model cannot emit a key that is not in the schema or a paragraph without a `level`. This is stronger than "respond in JSON" in a prompt: it is not an instruction the model may ignore under distribution shift, it is a constraint on which tokens are sampleable at all.

Paragraphs arrive **flat**, each with a `level` from 0 to 3, and `buildParagraphTree()` reassembles the hierarchy. Two reasons:

1. A flat array is far easier to constrain than a recursive schema.
2. Reassembly is where invalid structure gets repaired. AR 25-50 (fig 2-1) forbids subdividing past the third subdivision, so a `level: 7` is clamped, and a level that skips a rung is pulled back to a real parent. The model's mistake never reaches the page.

---

### Measuring in inches, not characters

Every horizontal measurement in AR 25-50 is an inch: 1-inch margins (para 2-3c), quarter- and half-inch subparagraph indents (fig 2-1), *"space ¼ inch to the right of the parenthesis"* (para 1-39b(10)). Meanwhile para 1-19 recommends a 12-point font, which in practice means a proportional face.

Breaking lines by character count would only be correct for a monospace font. So `text-metrics.js` carries the Helvetica advance-width table - Arial is metrically compatible, which is why Word substitutes one for the other without reflowing - and lines break in inches against real type. The plain-text renderer then scales those breaks onto a character grid. It is a preview of the real document rather than a second, different layout, which is why its lines vary in character count: a proportional face fits more lowercase than uppercase in 6.5 inches.

This also fixes a subtle bug worth knowing about. A naive wrapper does `text.split(/\s+/).join(" ")`, which silently destroys the two spaces after a sentence that para 1-39b(9) requires. `tokenize()` keeps each token's preceding whitespace so the spacing survives the break.

---

### The deliverable is Word, and that constrains the design

A PDF would be easier to make exact and would be the wrong answer. What gets staffed is a `.docx`, and it has to survive somebody opening it and editing a sentence.

That rules out the obvious shortcut. The previews render pre-broken lines - one regulation line at a time - which is perfect for verification and useless as a document: edit any sentence and the frozen line breaks shatter. So the Word renderer emits **whole paragraphs** carrying the exact geometry (first-line indent, quarter-inch tab stops, single spacing, `keepLines`, `widowControl`) and lets Word break the lines itself.

The two agree because both measure Arial identically - the layout engine uses the Helvetica advance widths Arial was built to match. The same fact that makes verification possible makes the editable document possible.

The formatting itself is then locked in `settings.xml`:

```xml
<w:documentProtection w:formatting="1" w:enforcement="1"/>
```

Text stays editable; font, size, spacing, indents, and margins cannot be changed from inside Word. AR 25-50 fixes all of those, and a reviewer tidying up the spacing is the most common way a compliant memorandum stops being one.

---

### Templates are the editing surface

Each memorandum type ships as a skeleton with `[BRACKETED]` placeholders. That gives two ways to edit the same document, neither of which can damage the layout: fill the JSON spec and re-render, or type over the placeholders in the locked Word file. The validator reports every placeholder still unfilled, so a memorandum that says `[FULL NAME]` cannot quietly reach a staffing folder.

This is the same separation as the LLM split, applied to a human: **give the editor the content and keep the format out of reach.**

---

### The regulation ships its own test suite

Figures 2-1 through 2-5 of AR 25-50 print their line counts in the left margin - literally the numbers 1, 2, 3 running down the side of each example memo. Those numbers are a test oracle.

`verify.js` rebuilds each figure as a memo spec and asserts that the distance between every pair of landmarks matches the count the figure shows. When it says

```
fig 2-1: signature block is the 5th line below the authority line
```

that is checking the renderer against the regulation, not against itself. This is the payoff of moving format out of the model: the spacing is now a property you can regress-test.

Assertions run against `doc.flow` - the document before pagination - because the regulation's counts describe the document's flow, not a particular page. A page break must not be able to change the answer.

---

### The repair loop, and when to stop

```javascript
let best = {memo, result: validateMemo(memo)};
for (let pass = 1; pass < maxPasses; pass++) {
    const instructions = repairInstructions(best.result);   // content findings only
    if (instructions.length === 0) break;
    const candidate = /* re-draft, re-assemble, re-validate */;
    if (score(candidate) >= score(best.result)) break;      // keep the better draft
    best = candidate;
}
```

Two details that matter more than they look:

- **Keep the best draft, not the last one.** A repair pass can trade one advisory for two. Naively overwriting means the loop can hand back something worse than what it started with.
- **Stop on non-improvement, not just on success.** Some findings are not fixable by re-drafting - a two-page memo (para 1-39b(7) prefers one) may genuinely need two pages. Without the non-improvement exit the agent burns its whole budget re-generating the same text.

---

### Failure modes

1. **The model refuses the frame.** Smaller models sometimes emit `"1. Range 14 closes..."` with the number baked into the text, producing `1.  1. Range 14 closes...`. The validator's `manual-numbering` check catches it; the grammar cannot, because a leading digit is a legal string.
2. **Advisory fatigue.** The passive-voice and sentence-length checks (paras 1-38, 1-39b(2)) are heuristics against a style standard, not hard rules. Wire them to a hard gate and the agent will loop forever chasing an advisory the regulation itself hedges with *"with few exceptions"*.
3. **Pagination is an estimate.** Lines per page derive from a 13.8 pt line height (Word's single spacing for 12 pt Arial) and an assumed letterhead height. A different letterhead template moves the first page's capacity, which is why it is an option rather than a constant.
4. **The seal is never drawn.** Para 1-16b(1) requires the DoD seal and para 1-16b(2) forbids substituting any other device, so the renderer uses the official image from the APD letterhead template or none at all, and the validator raises `seal-missing` until you supply it. The seal does not change, so this is a one-time setup - see `assets/README.md`. Drawing an approximation would produce a document that looks official and is not.
5. **Intent detection is shallow on purpose.** `detectMemoType()` matches the phrases that name a type in AR 25-50 and prints back what it chose. A wrong guess is cheap to correct with `--template`; a wrong guess made silently would not be.
6. **Check the regulation before calling something a judgement call.** The office symbol's position on page 1 was written up as a derived measurement when para 2-4a(1) states it outright - *"the second line below the seal"* - and ten figures measure it. Codifying a standard means the standard usually has the answer; reaching for a default is the reflex to distrust.
7. **Word decides the real page breaks.** The layout engine's pagination drives the previews and the decision to number pages; `keepLines` and `widowControl` carry the para 2-5c rules into Word. On a page that is close to full, Word's break and the engine's can differ by a line.

---

### Where this generalizes

The pattern is not about memorandums. It applies whenever the output is governed by a document someone else wrote: invoices under a tax authority's layout rules, court filings under local rules, HL7 messages, MISRA-constrained C, a house citation style.

The test is: **can a reviewer point at a rule and say the output violates it?** If yes, that rule belongs in code with the citation attached, and the model's job shrinks to the part that is actually language.
