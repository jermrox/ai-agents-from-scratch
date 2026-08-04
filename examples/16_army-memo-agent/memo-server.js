/**
 * The front end.
 *
 * Say what you need. It picks the memorandum type, lays the memorandum out to
 * AR 25-50, checks it against the regulation, and hands back a Word file.
 *
 * The division of labour is the same one the rest of this example is built on,
 * and the page makes it visible:
 *
 *   the request     -> which of the nine memorandum types this is (para 2-2)
 *   your words      -> subject and body, the only things a person writes
 *   the code        -> every measurement on the page, none of it editable here
 *   matters of record -> office symbol, ARIMS number, date, letterhead,
 *                        signature block. These are placeholders by default and
 *                        stay placeholders until somebody who knows fills them
 *                        in. The date in particular is not knowable at drafting
 *                        time: para 2-4a(3)(b) puts it on the page "after the
 *                        memorandum has been signed."
 *
 * Filling those in later cannot move anything, because no measurement depends
 * on their contents - which is the whole reason the .docx can be locked for
 * formatting (para 1-19, para 2-3) and still be typed into.
 *
 * No framework and no network: Node's own http module, and the same modules the
 * CLI uses. Run it with `--serve`, or `node memo-server.js`.
 */

import http from "http";
import fs from "fs/promises";
import {fileURLToPath} from "url";
import path from "path";

import {renderText, renderHtmlDocument, DEFAULT_SEAL_PATH} from "./memo-formatter.js";
import {validateMemo} from "./memo-validator.js";
import {renderDocx} from "./memo-docx.js";
import {MEMO_TYPES, formatMemoDate, formatLetterDate, ADDRESS_LIMITS, PERSONAL_ADDRESS_TYPES} from "./ar25-50.js";
import {createTemplate, describeTemplates, recordFieldPlaceholders, RECORD_FIELDS} from "./templates.js";
import {detectMemoType, assembleMemo, runMemoAgent} from "./memo-intent.js";
import {getDrafter, disposeDrafter, modelAvailable, DEFAULT_MODEL_PATH} from "./memo-drafter.js";
import {outstandingFields, unitFields, memorandumFields} from "./unit-profile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Assembling a memo from what the page sends
// ---------------------------------------------------------------------------

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
        date: filled(form.date, record.date),
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
        // An MFR is on plain paper with no addressee and no authority line
        // (fig 2-17); so is an agreement (para 2-6c(1)).
        letterhead: type === "record" ? null : (letterheadGiven ? {
            organization: filled(form.organization, record.letterhead.organization),
            streetAddress: filled(form.streetAddress, record.letterhead.streetAddress),
            cityStateZip: filled(form.cityStateZip, record.letterhead.cityStateZip),
        } : record.letterhead),
    };
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

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const TYPES = describeTemplates();

/*
 * `field()` wraps every input that unit-profile.js's FIELDS array knows about
 * in a `data-field="<path>"` container, so the same client-side script that
 * fetches /fields can show or hide it and rewrite its label and hint - one
 * source of truth for "does this apply to this memorandum type" instead of a
 * second copy of that judgment sitting in the page's own markup.
 *
 * `path` defaults to `id` because most fields are named after their spec path
 * already; the few that are not (signerGrade -> signature.gradeAndBranch, and
 * so on) pass it explicitly. `plainField()` is the escape hatch for inputs
 * FIELDS does not model at all - the MOU/MOA signer columns, which are an
 * array of two objects rather than a single path - so they are never hidden
 * by a path lookup that could never match one.
 */
const plainField = (id, label, hint = "") =>
    `<label for="${id}"><span class="label-text">${label}</span>${hint ? `<em>${hint}</em>` : ""}</label><input id="${id}" name="${id}">`;

const field = (id, label, hint = "", path = id) =>
    `<div class="field" data-field="${path}">${plainField(id, label, hint)}</div>`;

/*
 * digitalSignature is a yes/no, not a blank to fill in - FIELDS models "what
 * still needs a value," and a checkbox is never blank, it is only ever
 * checked or not. Left out of that lookup for the same reason the signer
 * columns are; hidden for a letter by id instead, since "digital signatures
 * will not be used on letters" (para 3-6c(2)(b)) is not the office's choice.
 */
const checkboxField = (id, label, hint = "") =>
    `<label class="checkbox" for="${id}"><input type="checkbox" id="${id}" name="${id}" checked> ` +
    `<span class="label-text">${label}</span>${hint ? `<em>${hint}</em>` : ""}</label>`;

const page = () => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AR 25-50 memorandum</title>
<style>
  :root { --ink:#16181d; --dim:#5b616e; --line:#d7dae0; --bg:#f6f7f9; --panel:#fff;
          --err:#a3121b; --warn:#7a5200; --ok:#1d6b3f; --accent:#26456b; }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#e8eaee; --dim:#9aa1ae; --line:#333842; --bg:#15171b; --panel:#1c1f25;
            --err:#ff9a9f; --warn:#e5bf6a; --ok:#7fd6a2; --accent:#9dc0ee; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font:15px/1.5 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif; }
  header { padding:20px 24px; border-bottom:1px solid var(--line); background:var(--panel); }
  h1 { margin:0; font-size:17px; letter-spacing:.01em; }
  header p { margin:4px 0 0; color:var(--dim); font-size:13px; }
  main { display:grid; grid-template-columns:minmax(340px,420px) 1fr; gap:0; align-items:start; }
  @media (max-width:900px) { main { grid-template-columns:1fr; } }
  form { padding:20px 24px 40px; border-right:1px solid var(--line); }
  fieldset { border:0; border-top:1px solid var(--line); margin:22px 0 0; padding:16px 0 0; }
  fieldset:first-of-type { border-top:0; margin-top:0; padding-top:0; }
  legend { padding:0; font-weight:600; font-size:13px; text-transform:uppercase;
           letter-spacing:.06em; color:var(--dim); }
  legend + p { margin:6px 0 14px; color:var(--dim); font-size:13px; }
  label { display:block; margin:12px 0 4px; font-size:13px; font-weight:600; }
  label em { display:block; font-weight:400; font-style:normal; color:var(--dim); font-size:12px; }
  input, textarea, select { width:100%; padding:8px 10px; border:1px solid var(--line);
    border-radius:6px; background:var(--panel); color:var(--ink); font:inherit; }
  textarea { min-height:120px; resize:vertical; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }
  input::placeholder, textarea::placeholder { color:var(--dim); opacity:.75; }
  label.checkbox { display:flex; flex-wrap:wrap; align-items:center; gap:6px 8px; }
  label.checkbox input[type=checkbox] { width:auto; }
  label.checkbox em { flex-basis:100%; margin-left:22px; }
  .counter { margin:4px 0 0; font-size:12px; color:var(--dim); text-align:right; }
  .counter.over { color:var(--warn); font-weight:600; }
  button { margin-top:18px; width:100%; padding:11px; border:0; border-radius:6px;
    background:var(--accent); color:#fff; font:inherit; font-weight:600; cursor:pointer; }
  @media (prefers-color-scheme: dark) { button { color:#12141a; } }
  button.secondary { background:transparent; color:var(--accent); border:1px solid var(--line); margin-top:8px; }
  button[disabled] { opacity:.55; cursor:progress; }
  /* The page stays in view while the form scrolls past it, so a finding and
     the line it is about are on screen together. */
  #out { padding:20px 24px 40px; min-width:0; position:sticky; top:0; max-height:100vh; overflow:auto; }
  @media (max-width:900px) { #out { position:static; max-height:none; } }
  #frame { width:100%; height:74vh; border:1px solid var(--line); border-radius:6px; background:#fff; }
  .detected { margin:10px 0 0; font-size:13px; color:var(--dim); }
  .detected b { color:var(--ink); }
  ul.findings { list-style:none; margin:0 0 16px; padding:0; }
  ul.findings li { padding:7px 0 7px 12px; border-left:3px solid var(--line); margin-bottom:6px; font-size:13px; }
  li.error { border-left-color:var(--err); } li.warning { border-left-color:var(--warn); }
  .rule { font-family:ui-monospace,Menlo,monospace; font-size:12px; }
  li.error .rule { color:var(--err); } li.warning .rule { color:var(--warn); }
  .cite { color:var(--dim); font-size:12px; }
  .pass { color:var(--ok); font-weight:600; }
  .empty { color:var(--dim); }
  /* Fields unit-profile.js says do not apply to the selected type - MOU/MOA
     has no office symbol, an MFR has no addressee, and so on. Hidden, not
     removed: switching the type back does not lose what was typed. */
  .field.hidden, fieldset.hidden, #digitalSignatureField.hidden { display:none; }
</style></head>
<body>
<header>
  <h1>Army memorandum</h1>
  <p>AR 25-50. You write the words; the layout is not editable here, because none of it is a choice.</p>
</header>
<main>
<form id="f" autocomplete="off">
  <fieldset>
    <legend>What do you need</legend>
    <p>The memorandum type is read from this. Override it if the guess is wrong.</p>
    <label for="request">Say it plainly</label>
    <textarea id="request" name="request" style="min-height:74px"
      placeholder="Tell the battalions Range 14 closes for maintenance 3-7 August."></textarea>
    <label for="type">Type</label>
    <select id="type" name="type">
      <option value="">Detect from the request</option>
      ${TYPES.map((t) => `<option value="${t.type}">${t.title} — ${t.cite}</option>`).join("")}
    </select>
    <p class="detected" id="detected"></p>
    <button type="button" class="secondary" id="draft">Draft the words with the model</button>
    <p class="detected" id="draftnote"></p>
  </fieldset>

  <fieldset>
    <legend>Your words</legend>
    <p>Blank line between paragraphs. Indent a paragraph, or start it with “- ”, to make it a subparagraph. Never type the numbers — para 2-4b(4)(b) makes them the renderer's job.</p>
    <label for="subject">Subject <em>ten words or less, para 2-4a(6)</em></label>
    <input id="subject" name="subject" placeholder="Range 14 Closure for Scheduled Maintenance">
    <p class="counter" id="subjectcount"></p>
    <label for="body">Body</label>
    <textarea id="body" name="body" placeholder="Range 14 closes for maintenance from 3 August 2026 through 7 August 2026.

Range Control will complete the following work:

  Replace the target lifters on lanes 1 through 12.

  Regrade the access road."></textarea>
    <div class="field" data-field="addressees">
      <label for="addressees"><span class="label-text">Addressees</span><em>one per line</em></label>
      <textarea id="addressees" name="addressees" style="min-height:64px"></textarea>
    </div>
    <div class="field" data-field="distribution">
      <label for="distribution"><span class="label-text">Distribution</span><em>more than five addressees uses this instead — one per line, defaults to the addressee list</em></label>
      <textarea id="distribution" name="distribution" style="min-height:48px"></textarea>
    </div>
    <div class="field" data-field="parties">
      <label for="parties"><span class="label-text">Parties to the agreement</span><em>one per line, para 2-6c(2)</em></label>
      <textarea id="parties" name="parties" style="min-height:64px"></textarea>
    </div>
    ${field("addresseeTitle", "Addressee's title", "the person's duty title, not their organization — para 2-4a(5)", "addresseeTitle")}
    ${field("addresseeAddress", "Addressee's mailing address", "only “Exclusive For” correspondence names one — para 1-12b(1)", "addresseeAddress")}
    ${field("toCommanderOf", "Or, addressed to the commander of", "leave blank to address the named person above — para 1-12b(1)", "toCommanderOf")}
    <div class="field" data-field="thru">
      <label for="thru"><span class="label-text">THRU addressees</span><em>one per line, para 2-4a(5)(d)</em></label>
      <textarea id="thru" name="thru" style="min-height:48px"></textarea>
    </div>
    <label for="enclosures">Enclosures <em>one per line, chapter 4</em></label>
    <textarea id="enclosures" name="enclosures" style="min-height:48px"></textarea>
    <label for="copiesFurnished">Copies furnished <em>one per line, para 2-4c(5)</em></label>
    <textarea id="copiesFurnished" name="copiesFurnished" style="min-height:48px"></textarea>
  </fieldset>

  <fieldset id="agreementfields" class="hidden">
    <legend>Signers</legend>
    <p>Two agreeing officials, in protocol order — para 2-6c(5)(d). Leave a grade blank for a civilian; only the title is shown for one.</p>
    ${plainField("signer1Name", "Signer 1 — junior official — name")}
    ${plainField("signer1Grade", "Signer 1 — grade and branch", "blank for a civilian")}
    ${plainField("signer1Title", "Signer 1 — title and agency")}
    ${plainField("signer2Name", "Signer 2 — senior official — name")}
    ${plainField("signer2Grade", "Signer 2 — grade and branch", "blank for a civilian")}
    ${plainField("signer2Title", "Signer 2 — title and agency")}
  </fieldset>

  <fieldset id="unitfields">
    <legend>Your unit</legend>
    <p>These are the office's own, and they are the same on the next memorandum and the one after that. Fill them in once and this page will remember them on this browser; <b>Forget</b> clears them. Leave any of them blank and it comes out as a click-to-type slot in Word — editable as text, with the formatting locked, so nothing moves when you fill it in.</p>
    ${field("organization", "Letterhead organization", "paras 1-16b and 1-18", "letterhead.organization")}
    ${field("streetAddress", "Street address", "para 1-18", "letterhead.streetAddress")}
    ${field("cityStateZip", "City, State ZIP+4", "two spaces before the ZIP — para 5-10b", "letterhead.cityStateZip")}
    ${field("officeSymbol", "Office symbol", "para 2-4a(1)")}
    ${field("signerName", "Signer name", "para 6-4c", "signature.name")}
    ${field("signerGrade", "Grade and branch", "paras 6-4f and 6-5c", "signature.gradeAndBranch")}
    ${field("signerTitle", "Duty title", "para 6-4c", "signature.title")}
    <p class="detected" id="unitnote"></p>
    <button type="button" class="secondary" id="forget">Forget this unit</button>
  </fieldset>

  <fieldset>
    <legend>This memorandum</legend>
    <p>These change every time, so they are never remembered. The date is normally left blank: para 2-4a(3)(b) puts it on <em style="display:inline">after</em> the memorandum has been signed.</p>
    ${field("date", "Date", `para 2-4a(3)(b) — today is ${formatMemoDate()}`)}
    ${field("suspenseDate", "Suspense date", "optional, para 2-4a(4)")}
    ${field("authorityLine", "Authority line", "only when signing for the commander — para 2-4c(1)")}
    ${field("salutation", "Salutation", "letters only — para 3-6a(4)")}
    ${field("addresseeCategory", "Addressee category", "optional, letters only — a table C-1 through C-11 heading, e.g. \"Governor of a State\"; checks the salutation against appendix C")}
    <div id="digitalSignatureField">
      ${checkboxField("digitalSignature", "Digitally signed",
        "uncheck for a wet signature — changes the decision approval line and adds the THRU endorsement instruction")}
    </div>
  </fieldset>

  <button type="submit" id="go">Generate</button>
  <button type="button" class="secondary" id="dl">Download .docx</button>
  <button type="button" class="secondary" id="spec">Download spec (JSON)</button>
</form>

<section id="out">
  <div id="report"><p class="empty">Fill in what you have and press Generate. Everything you leave blank comes out as a click-to-type slot in Word.</p></div>
  <div id="outstanding"></div>
  <iframe id="frame" title="Memorandum preview"></iframe>
</section>
</main>

<script>
const $ = (id) => document.getElementById(id);
const formData = () => Object.fromEntries(new FormData($("f")).entries());

/*
 * The unit's own details, kept on this browser.
 *
 * AR 25-50 is one regulation but a memorandum is not interchangeable between
 * offices: the organization block, the office symbol and the signature block
 * belong to the unit and repeat on every memorandum it writes. The subject,
 * the addressee and the date do not, and are deliberately never stored.
 */
const UNIT_KEY = "ar2550.unit";
const UNIT_IDS = ["organization", "streetAddress", "cityStateZip", "officeSymbol",
                  "signerName", "signerGrade", "signerTitle"];

function loadUnit() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(UNIT_KEY) || "{}"); } catch (e) { saved = {}; }
  let filled = 0;
  for (const id of UNIT_IDS) {
    if (saved[id] && !$(id).value) { $(id).value = saved[id]; filled++; }
  }
  noteUnit(filled ? filled + " remembered from last time." : "");
}

function saveUnit() {
  const unit = {};
  for (const id of UNIT_IDS) if ($(id).value.trim()) unit[id] = $(id).value.trim();
  try {
    if (Object.keys(unit).length) localStorage.setItem(UNIT_KEY, JSON.stringify(unit));
    else localStorage.removeItem(UNIT_KEY);
  } catch (e) { /* private browsing - the memorandum still works */ }
  return unit;
}

function noteUnit(text) { $("unitnote").textContent = text; }

$("forget").addEventListener("click", () => {
  try { localStorage.removeItem(UNIT_KEY); } catch (e) {}
  for (const id of UNIT_IDS) $(id).value = "";
  noteUnit("Forgotten. These will come out as slots you fill in in Word.");
});
for (const id of UNIT_IDS) {
  window.addEventListener("DOMContentLoaded", () => $(id).addEventListener("change", () => {
    const n = Object.keys(saveUnit()).length;
    noteUnit(n ? n + " of " + UNIT_IDS.length + " remembered on this browser." : "");
  }));
}

/*
 * Which fields belong on the page at all, for the type currently selected.
 * unit-profile.js's FIELDS array already knows this - an MFR has no
 * addressee, an MOU/MOA has no office symbol, a letter has no THRU chain -
 * and /fields is that same judgment, already used to build the "still to be
 * supplied" list, read again here so the form itself does not carry a second,
 * driftable copy of it. Hidden fields keep their values: switching the type
 * to check something and back must not lose what was typed.
 */
function applyFields(data) {
  const known = new Map();
  for (const f of [...(data.unit || []), ...(data.memorandum || [])]) known.set(f.path, f);

  document.querySelectorAll("[data-field]").forEach((el) => {
    const f = known.get(el.dataset.field);
    /*
     * "addressees" drops out of /fields' own lists once there are more than
     * five - the heading reads SEE DISTRIBUTION instead of listing them
     * (para 2-4a(5)(c)) - but the textarea is what the Distribution field
     * defaults from, so it stays on the page and relabels rather than
     * disappearing out from under whoever is mid-edit in it.
     */
    if (!f && el.dataset.field === "addressees" && data.seeDistribution) {
      el.classList.remove("hidden");
      const label = el.querySelector("label");
      const text = label && label.querySelector(".label-text");
      if (text) text.textContent = "Addressees";
      const em = label && label.querySelector("em");
      if (em) em.textContent = "More than five - this is now the default Distribution list below, unless overridden there.";
      return;
    }
    el.classList.toggle("hidden", !f);
    if (!f) return;
    const label = el.querySelector("label");
    const text = label && label.querySelector(".label-text");
    if (text) text.textContent = f.label + (f.optional ? " (optional)" : "");
    let em = label && label.querySelector("em");
    if (label && !em) { em = document.createElement("em"); label.appendChild(em); }
    if (em) em.textContent = f.hint + " — " + f.cite;
  });

  const agreement = data.type === "mou" || data.type === "moa";
  $("agreementfields").classList.toggle("hidden", !agreement);

  // "Digital signatures will not be used on letters" - para 3-6c(2)(b) - so
  // there is nothing to ask a letter's author to decide.
  $("digitalSignatureField").classList.toggle("hidden", data.type === "letter");

  // An agreement has no letterhead, no office symbol and no lone signature
  // block (para 2-6c) - every field "Your unit" holds is gone at once, and a
  // box with nothing in it but an intro paragraph and a Forget button is
  // clutter, not a fieldset. "Your words" and "This memorandum" never empty
  // out this way - each always keeps something ungated (the body, the date) -
  // so this check is only ever applied here, not generically.
  const unitfields = $("unitfields");
  const anyUnitVisible = Array.from(unitfields.querySelectorAll(".field[data-field]"))
    .some((el) => !el.classList.contains("hidden"));
  unitfields.classList.toggle("hidden", !anyUnitVisible);
}

async function fetchFields() {
  try {
    applyFields(await (await post("/fields", formData())).json());
  } catch (e) { /* the static form still works without live field metadata */ }
}

async function post(path, body) {
  const r = await fetch(path, {method:"POST", headers:{"content-type":"application/json"},
                              body: JSON.stringify(body)});
  if (!r.ok) throw new Error(await r.text());
  return r;
}

/*
 * The memorandum is a fixed 8.5-inch sheet - every measurement on it is the
 * regulation's, in inches, and none of it may reflow - so the preview gets
 * the PDF-viewer treatment: scale the whole sheet down until its width fits
 * the pane it is actually in, keep the aspect ratio, and grow the iframe to
 * the scaled content's full height so the one outer scroll reaches all of it.
 *
 * Both cuts this replaces were real: a fixed 74vh iframe scrolling inside
 * "#out" (which also scrolls - it is sticky so a finding stays beside the
 * line it is about) hid the bottom of the memo behind two nested
 * scrollbars, and any pane narrower than the sheet's 816px hid the right
 * half of it behind a horizontal scrollbar sitting at the bottom of a very
 * tall frame - reachable in principle, invisible in practice.
 *
 * CSS zoom rather than transform scale() because zoom participates in
 * layout: scrollHeight and scrollWidth report the zoomed size, so the
 * height the iframe needs is simply what the document says it is - no
 * manual scaled-box arithmetic to drift out of sync. A srcdoc iframe's
 * contentDocument is same-origin-accessible from its parent even though
 * its opaque origin blocks resource loading (that is what withServedSeal()
 * works around) - reading it here is a different operation.
 */
function fitPreview() {
  const frame = $("frame");
  let doc;
  try { doc = frame.contentDocument; } catch (e) { return; }
  const page = doc && doc.querySelector ? doc.querySelector(".ar25-50-memo .page") : null;
  if (!page) return;
  doc.body.style.zoom = "";
  const natural = page.getBoundingClientRect().width;
  if (!natural || !frame.clientWidth) return;
  // A small gutter keeps the sheet's drop shadow inside the frame.
  const scale = Math.min(1, frame.clientWidth / (natural + 24));
  if (scale < 1) doc.body.style.zoom = String(scale);
  frame.style.height = Math.max(300, doc.documentElement.scrollHeight + 4) + "px";
}

function resizeFrame(html) {
  const frame = $("frame");
  frame.onload = fitPreview;
  frame.srcdoc = html;
}

// The pane's width changes with the window; the sheet's never does. Re-fit
// on resize, coalesced to one measurement per frame.
let refit = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(refit);
  refit = requestAnimationFrame(fitPreview);
});

function renderReport(d) {
  const list = d.findings.length
    ? '<ul class="findings">' + d.findings.map((f) =>
        '<li class="' + f.severity + '"><span class="rule">' + f.rule + '</span> ' +
        escapeHtml(f.message) + '<br><span class="cite">' + escapeHtml(f.cite) + '</span></li>').join("") + "</ul>"
    : '<p class="pass">Compliant. No findings.</p>';
  const errs = d.findings.filter((f) => f.severity === "error").length;
  $("report").innerHTML =
    '<p class="detected">Type: <b>' + escapeHtml(d.title) + '</b> — ' + escapeHtml(d.cite) +
    ' · ' + d.pages + (d.pages === 1 ? " page" : " pages") +
    (errs ? ' · <span style="color:var(--err)">' + errs + ' error' + (errs===1?'':'s') + '</span>' : '') + '</p>' +
    (d.plainPaper ? '<p class="detected">No letterhead and no seal on this one by rule: this type is typed on ' +
      '<b>plain white paper</b> — AR 25-50, ' + escapeHtml(d.plainPaper) + '.</p>' : '') + list;
}

/*
 * What is still to be supplied, asked rather than complained about. Every one
 * is a click-to-type slot in the .docx: fill it in here or fill it in in Word,
 * and either way the formatting is locked so the page cannot move.
 */
function renderOutstanding(o) {
  const group = (title, fields, tail) => !fields.length ? "" :
    '<p class="detected"><b>' + title + '</b></p><ul class="findings">' +
    fields.map((f) => '<li class="advisory"><span class="rule">' + escapeHtml(f.label) +
      "</span> " + escapeHtml(f.hint) + '<br><span class="cite">' + escapeHtml(f.cite) +
      "</span></li>").join("") + "</ul>" + (tail || "");
  $("outstanding").innerHTML =
    group("Still to be supplied \u2014 your unit", o.unit,
          '<p class="detected">Fill these in above and this browser will remember them.</p>') +
    group("Still to be supplied \u2014 this memorandum", o.memorandum, "");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}

async function generate() {
  $("go").disabled = true;
  try {
    const d = await (await post("/generate", formData())).json();
    $("detected").textContent = "Reading this as: " + d.title;
    lastType = d.type;
    renderReport(d);
    renderOutstanding(d.outstanding || {unit: [], memorandum: []});
    resizeFrame(d.html);
    fetchFields();
  } catch (e) {
    $("report").innerHTML = '<p style="color:var(--err)">' + escapeHtml(e.message) + "</p>";
  } finally {
    $("go").disabled = false;
  }
}

async function download(path, filename) {
  const blob = await (await post(path, formData())).blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

$("draft").addEventListener("click", async () => {
  const btn = $("draft");
  if (!$("request").value.trim()) { $("draftnote").textContent = "Say what it needs to do first."; return; }
  btn.disabled = true;
  btn.textContent = "Drafting\u2026";
  $("draftnote").textContent = "Loading the model on first use; this takes a moment.";
  try {
    const r = await fetch("/draft", {method:"POST", headers:{"content-type":"application/json"},
                                     body: JSON.stringify(formData())});
    const d = await r.json();
    if (!r.ok) { $("draftnote").textContent = d.error; return; }
    $("subject").value = d.subject;
    $("body").value = d.body;
    if (d.addressees && !$("addressees").value.trim()) $("addressees").value = d.addressees;
    $("draftnote").textContent = "Drafted in " + d.passes + " pass" + (d.passes === 1 ? "" : "es") +
      ". Edit anything, then Generate.";
    generate();
  } catch (e) {
    $("draftnote").textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Draft the words with the model";
  }
});

// The button is only useful if a model is actually there; say so if not.
fetch("/health").then((r) => r.json()).then((h) => {
  if (h.model.available) return;
  $("draft").disabled = true;
  $("draftnote").innerHTML = "No drafting model at <span class='rule'>" +
    escapeHtml(h.model.path) + "</span>. Write the words yourself \u2014 everything else works.";
}).catch(() => {});

/*
 * The subject line's own limit - para 2-4a(6), ten words or less - counted as
 * you type rather than only after Generate. The validator's own wording
 * ("if possible") is why this only warns rather than blocking the field.
 */
const SUBJECT_MAX_WORDS = 10;
function updateSubjectCount() {
  const words = $("subject").value.trim().split(/\\s+/).filter(Boolean).length;
  const el = $("subjectcount");
  el.textContent = words ? words + " word" + (words === 1 ? "" : "s") : "";
  el.classList.toggle("over", words > SUBJECT_MAX_WORDS);
}
$("subject").addEventListener("input", updateSubjectCount);

/*
 * A downloaded file named for what it actually is, not for the last person
 * who ran the demo: type and subject, not "memorandum.docx" every time, so
 * five memorandums downloaded in a row do not overwrite each other.
 */
let lastType = "";
function slug(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
function downloadFilename(ext) {
  const type = lastType || $("type").value;
  const name = [slug(type), slug($("subject").value)].filter(Boolean).join("-");
  return (name || "memorandum") + "." + ext;
}

$("f").addEventListener("submit", (e) => { e.preventDefault(); generate(); });
$("dl").addEventListener("click", () => download("/docx", downloadFilename("docx")));
$("spec").addEventListener("click", () => download("/spec", downloadFilename("json")));
$("request").addEventListener("blur", async () => {
  if (!$("request").value.trim() || $("type").value) return;
  const d = await (await post("/detect", {request: $("request").value})).json();
  $("detected").textContent = "Reading this as: " + d.title + " (" + d.cite + ")";
  lastType = d.type;
  fetchFields();
});
$("type").addEventListener("change", fetchFields);
// Addressee count is the one other thing besides type that changes what
// /fields answers - past five it is a SEE DISTRIBUTION memorandum (para
// 2-4a(5)(c)) and the Distribution field appears, before Generate has to
// be clicked to find that out.
$("addressees").addEventListener("change", fetchFields);

loadUnit();
fetchFields();
updateSubjectCount();
</script>
</body></html>`;

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const readJson = (req) => new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
        body += c;
        if (body.length > 1e6) { reject(new Error("Request too large")); req.destroy(); }
    });
    req.on("end", () => {
        try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
});

const send = (res, status, type, body) => {
    res.writeHead(status, {"content-type": type, "cache-control": "no-store"});
    res.end(body);
};

const json = (res, status, value) => send(res, status, "application/json", JSON.stringify(value));

/**
 * The preview is rendered into an iframe's srcdoc, which has an opaque origin:
 * a filesystem path or a relative URL cannot load there, so the seal would come
 * out as a broken image. Para 1-16b(1) requires the seal and 1-16b(2) forbids
 * substituting any other device, so a broken image is not a cosmetic problem -
 * it is the one element of the letterhead that may not be improvised.
 *
 * Pointing it at the server's own absolute URL fixes it and lets the browser
 * cache the image instead of re-sending 1.2 MB with every keystroke's preview.
 */
function withServedSeal(memo, host) {
    if (!memo.letterhead || !host) return memo;
    return {...memo, letterhead: {...memo.letterhead, seal: `http://${host}/seal.png`}};
}

/**
 * @param {object}  [options]
 * @param {string}  [options.seal]       Override the shipped seal image.
 * @param {string}  [options.modelPath]  Where the drafting model lives.
 * @param {object}  [options.drafter]    A drafter to use instead of loading one.
 *   Anything with `withSession(fn)` works - see stubDrafter() in
 *   memo-drafter.js. This is the seam a different backend plugs into, and it
 *   is what lets the drafting route be tested without a model on disk.
 */
export function createMemoServer({seal, modelPath, drafter: injected} = {}) {
    return http.createServer(async (req, res) => {
        try {
            if (req.method === "GET" && (req.url === "/" || req.url.startsWith("/?"))) {
                return send(res, 200, "text/html; charset=utf-8", page());
            }
            // Browsers ask for this unprompted; answering keeps a 404 out of
            // every console that opens the page.
            if (req.method === "GET" && req.url === "/favicon.ico") {
                res.writeHead(204); return res.end();
            }
            if (req.method === "GET" && req.url === "/health") {
                return json(res, 200, {
                    ok: true,
                    model: {
                        path: modelPath ?? DEFAULT_MODEL_PATH,
                        available: Boolean(injected) || await modelAvailable(modelPath ?? DEFAULT_MODEL_PATH),
                    },
                    types: TYPES.length,
                });
            }
            if (req.method === "GET" && req.url === "/types") {
                return json(res, 200, TYPES);
            }
            if (req.method === "GET" && req.url === "/seal.png") {
                const png = await fs.readFile(seal ?? DEFAULT_SEAL_PATH);
                res.writeHead(200, {"content-type": "image/png",
                                    "cache-control": "public, max-age=86400"});
                return res.end(png);
            }
            if (req.method !== "POST") return json(res, 404, {error: "Not found"});

            const form = await readJson(req);

            /*
             * The model writes the words, and only the words. It gets the
             * request and the findings from the previous pass, and returns
             * subject + paragraphs; the matters of record and every
             * measurement stay where they were. One job holds the model for
             * the whole draft/validate/repair loop, so a repair pass sees the
             * draft it is fixing.
             */
            if (req.url === "/draft") {
                const request = String(form.request ?? "").trim();
                if (!request) return json(res, 400, {error: "Say what the memorandum needs to do."});

                let drafter = injected;
                if (!drafter) {
                    try {
                        drafter = await getDrafter(modelPath ? {modelPath} : undefined);
                    } catch (err) {
                        return json(res, 503, {error: err.message, modelPath: modelPath ?? DEFAULT_MODEL_PATH});
                    }
                }

                const type = detectMemoType(form.type && MEMO_TYPES[form.type] ? form.type : request);
                const context = {...specFromForm({...form, body: "", subject: ""}), type};
                let passes = 0;

                const {memo: drafted, result} = await drafter.withSession((draft) => runMemoAgent({
                    request, context, draft,
                    onPass: () => { passes += 1; },
                }));

                // Handed back as form values, not as a finished document: the
                // page is still yours to edit before anything is rendered.
                return json(res, 200, {
                    type,
                    subject: drafted.subject,
                    body: bodyFromParagraphs(drafted.paragraphs),
                    addressees: (drafted.addressees ?? []).join("\n"),
                    passes,
                    findings: result.contentFindings.map(({severity, rule, message, cite}) =>
                        ({severity, rule, message, cite})),
                });
            }

            if (req.url === "/detect") {
                const type = detectMemoType(form.request ?? "");
                const meta = MEMO_TYPES[type] ?? MEMO_TYPES.standard;
                return json(res, 200, {type, title: meta.title, cite: meta.cite});
            }

            const memo = specFromForm(form);
            const meta = MEMO_TYPES[memo.type] ?? MEMO_TYPES.standard;

            if (req.url === "/generate") {
                const result = validateMemo(memo);
                /*
                 * What is still to be supplied, split by whose it is. The
                 * unit's own details repeat on every memorandum it writes and
                 * are worth remembering; this memorandum's do not. Neither is
                 * a fault - a memorandum with all of them blank is a template,
                 * and each one is a click-to-type slot in the .docx.
                 */
                const field = ({label, hint, cite, prompt, optional}) =>
                    ({label, hint, cite, prompt, optional: Boolean(optional)});
                /*
                 * A type that is *required* to have no letterhead looks, to
                 * anyone who has just seen a standard memorandum, like a
                 * rendering bug: no seal, no DEPARTMENT OF THE ARMY. Say why
                 * in the report line, with the paragraph that says so, so
                 * the absence reads as the rule it is rather than a defect.
                 */
                const PLAIN_PAPER = {
                    record: "fig 2-17",
                    mou: "para 2-6c(1)",
                    moa: "para 2-6c(1)",
                };
                return json(res, 200, {
                    type: memo.type,
                    title: meta.title,
                    cite: meta.cite,
                    // Keyed off the type, not the spec's letterhead field: an
                    // agreement's spec may carry a letterhead object the
                    // renderer never draws (para 2-6c(1) overrides it), and
                    // the note is about the rule, not the leftover data.
                    plainPaper: PLAIN_PAPER[memo.type] ?? null,
                    pages: result.pages,
                    findings: result.findings.map(({severity, rule, message, cite}) =>
                        ({severity, rule, message, cite})),
                    outstanding: {
                        unit: outstandingFields(memo, "unit").map(field),
                        memorandum: outstandingFields(memo, "memorandum")
                            .filter((f) => !f.optional).map(field),
                    },
                    html: renderHtmlDocument(withServedSeal(memo, req.headers.host)),
                    text: renderText(memo),
                });
            }
            if (req.url === "/fields") {
                // The whole question list for a type, whether or not it is
                // answered - so a caller can build its own form.
                return json(res, 200, {
                    type: memo.type,
                    // Not one of FIELDS' own paths - it is the reason
                    // "addressees" itself drops out of the two lists below
                    // once it is true, which the page needs to know to keep
                    // showing that field rather than hiding it out from
                    // under whoever is mid-edit in it.
                    seeDistribution: Boolean(memo.seeDistribution),
                    unit: unitFields(memo).map(({when, ...f}) => f),
                    memorandum: memorandumFields(memo).map(({when, ...f}) => f),
                    outstanding: {
                        unit: outstandingFields(memo, "unit"),
                        memorandum: outstandingFields(memo, "memorandum"),
                    },
                });
            }
            if (req.url === "/spec") {
                return send(res, 200, "application/json",
                    JSON.stringify(memo, null, 2) + "\n");
            }
            if (req.url === "/docx") {
                const buffer = await renderDocx(memo, seal ? {seal} : {});
                return send(res, 200,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    buffer);
            }
            return json(res, 404, {error: "Not found"});
        } catch (err) {
            return json(res, 500, {error: err.message});
        }
    });
}

/**
 * Listen, and shut down cleanly.
 *
 * The host defaults to loopback on purpose. This serves an editable Word
 * deliverable and loads a language model on demand; binding it to every
 * interface should be something somebody chose, not something they got.
 */
export async function serve({port = 4250, host = "127.0.0.1", seal, modelPath} = {}) {
    const server = createMemoServer({seal, modelPath});

    // Requests in flight keep the process alive; new ones stop being accepted.
    // Without this a restart drops whatever memorandum was mid-render.
    let closing = false;
    const shutdown = async (signal) => {
        if (closing) return;
        closing = true;
        console.log(`\n${signal}: finishing in-flight requests.`);
        server.close(() => {});
        await disposeDrafter();
        process.exit(0);
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
    });

    const {port: actual} = server.address();
    const model = modelPath ?? DEFAULT_MODEL_PATH;
    console.log(`AR 25-50 memorandum front end: http://${host}:${actual}`);
    console.log("Matters of record default to placeholders you fill in afterwards.");
    console.log(await modelAvailable(model)
        ? `Drafting model: ${model}`
        : `No drafting model at ${model} - you write the words, everything else still works.`);
    return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const flag = (name) => {
        const i = process.argv.indexOf(name);
        return i >= 0 ? process.argv[i + 1] : undefined;
    };
    await serve({
        port: flag("--port") ? Number(flag("--port")) : Number(process.env.PORT) || undefined,
        host: flag("--host") ?? process.env.HOST,
        seal: flag("--seal"),
        modelPath: flag("--model"),
    });
}
