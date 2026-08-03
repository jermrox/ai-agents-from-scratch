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
import {MEMO_TYPES, formatMemoDate, formatLetterDate} from "./ar25-50.js";
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
        // agreement genuinely have no addressee (fig 2-17, para 2-6c(1)).
        // Blank until told. The label is what the document carries.
        addressees: lines(form.addressees),
        thru: lines(form.thru).length ? lines(form.thru) : (template.thru ?? []),
        enclosures: lines(form.enclosures),
        copiesFurnished: lines(form.copiesFurnished),
        authorityLine: filled(form.authorityLine, null),
        signature: {
            name: filled(form.signerName, record.signature.name),
            gradeAndBranch: filled(form.signerGrade, record.signature.gradeAndBranch),
            title: filled(form.signerTitle, record.signature.title),
        },
        // An MFR is on plain paper with no addressee and no authority line
        // (fig 2-17); so is an agreement (para 2-6c(1)).
        letterhead: type === "record" ? null : (letterheadGiven ? {
            organization: filled(form.organization, record.letterhead.organization),
            streetAddress: filled(form.streetAddress, record.letterhead.streetAddress),
            cityStateZip: filled(form.cityStateZip, record.letterhead.cityStateZip),
        } : record.letterhead),
    };
    if (type === "record") context.authorityLine = null;

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

    // The agreement forms carry structure the standard spec has no field for.
    if (type === "mou" || type === "moa") {
        memo.parties = lines(form.addressees).length ? lines(form.addressees) : template.parties;
        memo.signers = template.signers;
    }
    return memo;
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const TYPES = describeTemplates();

const field = (id, label, hint = "") =>
    `<label for="${id}">${label}${hint ? `<em>${hint}</em>` : ""}</label><input id="${id}" name="${id}">`;

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
    <label for="body">Body</label>
    <textarea id="body" name="body" placeholder="Range 14 closes for maintenance from 3 August 2026 through 7 August 2026.

Range Control will complete the following work:

  Replace the target lifters on lanes 1 through 12.

  Regrade the access road."></textarea>
    <label for="addressees">Addressees <em>one per line</em></label>
    <textarea id="addressees" name="addressees" style="min-height:64px"></textarea>
    <label for="thru">THRU addressees <em>one per line, para 2-4a(5)(d)</em></label>
    <textarea id="thru" name="thru" style="min-height:48px"></textarea>
    <label for="enclosures">Enclosures <em>one per line, chapter 4</em></label>
    <textarea id="enclosures" name="enclosures" style="min-height:48px"></textarea>
    <label for="copiesFurnished">Copies furnished <em>one per line, para 2-4c(5)</em></label>
    <textarea id="copiesFurnished" name="copiesFurnished" style="min-height:48px"></textarea>
  </fieldset>

  <fieldset id="unitfields">
    <legend>Your unit</legend>
    <p>These are the office's own, and they are the same on the next memorandum and the one after that. Fill them in once and this page will remember them on this browser; <b>Forget</b> clears them. Leave any of them blank and it comes out as a click-to-type slot in Word — editable as text, with the formatting locked, so nothing moves when you fill it in.</p>
    ${field("organization", "Letterhead organization", "paras 1-16b and 1-18")}
    ${field("streetAddress", "Street address", "para 1-18")}
    ${field("cityStateZip", "City, State ZIP+4", "two spaces before the ZIP — para 5-10b")}
    ${field("officeSymbol", "Office symbol", "para 2-4a(1)")}
    ${field("signerName", "Signer name", "para 6-4c")}
    ${field("signerGrade", "Grade and branch", "paras 6-4f and 6-5c")}
    ${field("signerTitle", "Duty title", "para 6-4c")}
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

async function post(path, body) {
  const r = await fetch(path, {method:"POST", headers:{"content-type":"application/json"},
                              body: JSON.stringify(body)});
  if (!r.ok) throw new Error(await r.text());
  return r;
}

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
    (errs ? ' · <span style="color:var(--err)">' + errs + ' error' + (errs===1?'':'s') + '</span>' : '') + '</p>' + list;
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
    renderReport(d);
    renderOutstanding(d.outstanding || {unit: [], memorandum: []});
    $("frame").srcdoc = d.html;
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

$("f").addEventListener("submit", (e) => { e.preventDefault(); generate(); });
$("dl").addEventListener("click", () => download("/docx", "memorandum.docx"));
$("spec").addEventListener("click", () => download("/spec", "memorandum.json"));
$("request").addEventListener("blur", async () => {
  if (!$("request").value.trim() || $("type").value) return;
  const d = await (await post("/detect", {request: $("request").value})).json();
  $("detected").textContent = "Reading this as: " + d.title + " (" + d.cite + ")";
});

loadUnit();
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
                return json(res, 200, {
                    type: memo.type,
                    title: meta.title,
                    cite: meta.cite,
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
