/*
 * Browser entry: the same modules the Node server runs, bundled.
 *
 * Nothing here reimplements the memorandum. specFromForm(), validateMemo(),
 * renderHtml(), renderDocx() are the repo's own - the ones 929 checks stand
 * behind - imported directly. This file is only the wiring between a DOM
 * form and those functions.
 */
import {Buffer} from "buffer";
globalThis.Buffer = Buffer;

import {specFromForm} from "../memo-form.js";
import {validateMemo} from "../memo-validator.js";
import {renderHtml} from "../memo-formatter.js";
import {renderDocx} from "../memo-docx.js";
import {detectMemoType} from "../memo-intent.js";
import {describeTemplates} from "../templates.js";
import {MEMO_TYPES, formatMemoDate} from "../ar25-50.js";
import {unitFields, memorandumFields, outstandingFields} from "../unit-profile.js";
import {SEAL_BASE64} from "./seal-data.js";

const SEAL_DATA_URI = "data:image/png;base64," + SEAL_BASE64;
const SEAL_BYTES = Buffer.from(SEAL_BASE64, "base64");

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Build the page
// ---------------------------------------------------------------------------

const TYPES = describeTemplates();

const field = (id, label, hint, path = id) =>
  `<div class="field" data-field="${path}"><label for="${id}"><span class="label-text">${label}</span><em>${hint}</em></label><input id="${id}"></div>`;
const area = (id, label, hint, path = id, h = 64) =>
  `<div class="field" data-field="${path}"><label for="${id}"><span class="label-text">${label}</span><em>${hint}</em></label><textarea id="${id}" style="min-height:${h}px"></textarea></div>`;
const plain = (id, label, hint = "") =>
  `<label for="${id}"><span class="label-text">${label}</span>${hint ? `<em>${hint}</em>` : ""}</label><input id="${id}">`;

document.getElementById("app").innerHTML = `
<header class="masthead">
  <p class="kicker">AR 25-50 · Preparing and Managing Correspondence</p>
  <h1>Army Memorandum Builder</h1>
  <p class="sub">Pick the type, say what you need, download the Word file. Anything you skip becomes a click-to-type slot in the document — the formatting is locked to the regulation either way.</p>
</header>
<main>
<form id="f" autocomplete="off" onsubmit="return false">
  <fieldset>
    <legend><span class="step">1</span> What are you writing?</legend>
    <select id="type">
      <option value="">Pick a type — or describe it below</option>
      ${TYPES.map((t) => `<option value="${t.type}">${t.title}</option>`).join("")}
    </select>
    <p class="note" id="detected"></p>
    <label for="request"><span class="label-text">Not sure? Say what you need</span><em>plain words — the right type is picked for you</em></label>
    <textarea id="request" style="min-height:56px" placeholder="I had a staff meeting about the barracks renovation budget and need to document it"></textarea>
  </fieldset>

  <fieldset>
    <legend><span class="step">2</span> Say what it needs to say</legend>
    <label for="subject"><span class="label-text">Subject</span><em>a few words — ten or fewer</em></label>
    <input id="subject" placeholder="Staff Meeting on Barracks Renovation Funding">
    <p class="counter" id="subjectcount"></p>
    <label for="body"><span class="label-text">Your words</span><em>rough is fine — blank line between paragraphs; never type the numbers, the formatter owns them</em></label>
    <textarea id="body" style="min-height:140px" placeholder="met w DPW 30 jul about barracks funding, they owe a revised cost estimate by 15 aug, poc karen blake ATZB-DPW 719-555-0173"></textarea>
    <button type="button" class="secondary inline" id="copyPrompt">Copy AI clean-up prompt</button>
    <p class="note" id="promptnote">Copies your rough words with the tailoring instructions — paste into Claude, then paste the tailored paragraphs back here.</p>
  </fieldset>

  <fieldset id="agreementfields" class="hidden">
    <legend><span class="step">✦</span> Who signs the agreement</legend>
    <p>Two agreeing officials, protocol order. Leave a grade blank for a civilian.</p>
    ${plain("signer1Name", "Signer 1 — junior official — name")}
    ${plain("signer1Grade", "Signer 1 — grade and branch", "blank for a civilian")}
    ${plain("signer1Title", "Signer 1 — title and agency")}
    ${plain("signer2Name", "Signer 2 — senior official — name")}
    ${plain("signer2Grade", "Signer 2 — grade and branch", "blank for a civilian")}
    ${plain("signer2Title", "Signer 2 — title and agency")}
  </fieldset>

  <details class="extra" id="unitfields">
    <summary><span class="sumtitle">Your unit &amp; signature block</span>
      <em>Set once — this browser remembers it. Anything blank becomes a fill-in slot in Word.</em></summary>
    <div class="inner">
    ${field("organization", "Letterhead organization", "as it reads on your letterhead", "letterhead.organization")}
    ${field("streetAddress", "Street address", "", "letterhead.streetAddress")}
    ${field("cityStateZip", "City, State ZIP+4", "two spaces before the ZIP", "letterhead.cityStateZip")}
    ${field("officeSymbol", "Office symbol", "e.g. ATZB-RC")}
    ${field("signerName", "Signer name", "ALL CAPS on the signature block", "signature.name")}
    ${field("signerGrade", "Grade and branch", "e.g. SFC, USA", "signature.gradeAndBranch")}
    ${field("signerTitle", "Duty title", "", "signature.title")}
    <p class="note" id="unitnote"></p>
    <button type="button" class="secondary inline" id="forget">Forget this unit</button>
    </div>
  </details>

  <details class="extra">
    <summary><span class="sumtitle">Addressing, enclosures &amp; options</span>
      <em>All optional — anything blank becomes a fill-in slot in Word.</em></summary>
    <div class="inner">
    ${area("addressees", "Addressees", "one per line")}
    ${area("distribution", "Distribution", "more than five addressees uses this — defaults to the addressee list", "distribution", 48)}
    ${area("parties", "Parties to the agreement", "one per line")}
    ${field("addresseeTitle", "Addressee's title", "the person's duty title")}
    ${field("addresseeAddress", "Addressee's mailing address", "“Exclusive For” only")}
    ${field("toCommanderOf", "Or, addressed to the commander of", "leave blank to address the named person")}
    ${area("thru", "THRU addressees", "one per line, two at most", "thru", 48)}
    <label for="enclosures"><span class="label-text">Enclosures</span><em>only if you attach something — one title per line</em></label>
    <textarea id="enclosures" style="min-height:48px"></textarea>
    <label for="copiesFurnished"><span class="label-text">Copies furnished</span><em>one per line</em></label>
    <textarea id="copiesFurnished" style="min-height:48px"></textarea>
    ${field("date", "Date", "already set to today — " + formatMemoDate())}
    ${field("suspenseDate", "Suspense date", "reply-by date, if any")}
    ${field("authorityLine", "Authority line", "only when signing for the commander")}
    ${field("salutation", "Salutation", "letters only")}
    ${field("addresseeCategory", "Addressee category", "letters only")}
    <div id="digitalSignatureField">
      <label class="checkbox" for="digitalSignature"><input type="checkbox" id="digitalSignature" checked>
      <span class="label-text">Digitally signed</span><em>uncheck for a wet signature</em></label>
    </div>
    <button type="button" class="secondary inline" id="spec">Download spec (JSON)</button>
    </div>
  </details>

  <div class="actionbar">
    <span class="step">3</span>
    <button type="button" id="dl">Download the Word file</button>
    <button type="button" class="secondary" id="newmemo">Start over</button>
  </div>
</form>

<section id="out">
  <div class="viewerbar"><span class="vtitle">The memorandum</span><span id="viewerchips"></span></div>
  <div id="report"><p class="note">Pick a type — the finished example appears here and updates as you type.</p></div>
  <div id="outstanding"></div>
  <div id="preview"></div>
  <footer class="pagefoot">Runs entirely in this page — nothing you type leaves your browser; the Word file is built locally. Same code and checks as the full install (jermrox/ai-agents-from-scratch · examples/16_army-memo-agent).</footer>
</section>
</main>`;

// ---------------------------------------------------------------------------
// The same behaviors as the served page, calling the modules directly
// ---------------------------------------------------------------------------

const UNIT_KEY = "ar2550.unit";
const UNIT_IDS = ["organization", "streetAddress", "cityStateZip", "officeSymbol",
                  "signerName", "signerGrade", "signerTitle"];

function loadUnit() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(UNIT_KEY) || "{}"); } catch (e) {}
  let n = 0;
  for (const id of UNIT_IDS) if (saved[id] && !$(id).value) { $(id).value = saved[id]; n++; }
  $("unitnote").textContent = n ? n + " remembered from last time." : "";
}
function saveUnit() {
  const unit = {};
  for (const id of UNIT_IDS) if ($(id).value.trim()) unit[id] = $(id).value.trim();
  try {
    if (Object.keys(unit).length) localStorage.setItem(UNIT_KEY, JSON.stringify(unit));
    else localStorage.removeItem(UNIT_KEY);
  } catch (e) {}
  return unit;
}
$("forget").addEventListener("click", () => {
  try { localStorage.removeItem(UNIT_KEY); } catch (e) {}
  for (const id of UNIT_IDS) $(id).value = "";
  $("unitnote").textContent = "Forgotten. These come out as slots you fill in in Word.";
});

function formValues() {
  const form = {};
  for (const el of document.querySelectorAll("#f input:not([type=checkbox]), #f textarea, #f select")) {
    if (el.id) form[el.id] = el.value;
  }
  if ($("digitalSignature").checked) form.digitalSignature = "on";
  return form;
}

function currentSpec() {
  const spec = specFromForm(formValues());
  if (spec.letterhead) spec.letterhead = {...spec.letterhead, seal: SEAL_DATA_URI};
  return spec;
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const PLAIN_PAPER = {mou: "para 2-6c(1)", moa: "para 2-6c(1)"};

const humanRule = (rule) => {
  const words = String(rule).replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/*
 * Advisories that only say "this is still blank" duplicate the slots
 * story - a blank is fine by design, it comes out as a click-to-type
 * slot. They stay out of the card list so a fresh page shows the sheet,
 * not a wall of warnings. Real errors and style advisories still show.
 */
const BLANK_RULES = new Set(["not-yet-supplied", "unfilled-placeholder",
  "letterhead-organization", "zip-missing"]);
const isBlankAdvisory = (f) => f.severity === "warning" && BLANK_RULES.has(f.rule);

/*
 * An untouched form has no memorandum yet - specFromForm still has to
 * default *some* type internally (it falls back to "standard"), and
 * rendering that default produces a real sheet full of bracketed
 * [PURPOSE SENTENCE]-style placeholders. That's correct once a type is
 * chosen, but as the very first thing a visitor sees it reads as a
 * broken document, not an empty one. So: nothing is picked yet means no
 * sheet renders at all - a plain invitation instead.
 */
function isUntouched() {
  return !$("type").value && !$("request").value.trim() &&
    !$("subject").value.trim() && !$("body").value.trim();
}

function render() {
  if (isUntouched()) {
    $("viewerchips").innerHTML = "";
    $("report").innerHTML = "";
    $("outstanding").innerHTML = "";
    $("preview").innerHTML = '<p class="emptystate">Pick a type, or describe what you need, and the memorandum appears here.</p>';
    return;
  }

  const spec = currentSpec();
  const result = validateMemo(spec);
  const meta = MEMO_TYPES[spec.type] ?? MEMO_TYPES.standard;

  const errs = result.findings.filter((f) => f.severity === "error").length;
  document.querySelector("#viewerchips").innerHTML =
    '<span class="pill">' + escapeHtml(meta.title) + "</span> " +
    '<span class="pill">' + result.pages + (result.pages === 1 ? " page" : " pages") + "</span>" +
    (errs ? ' <span class="pill err">' + errs + " error" + (errs === 1 ? "" : "s") + "</span>" : "");

  const shown = result.findings.filter((f) => !isBlankAdvisory(f));
  const list = shown.length
    ? '<ul class="findings">' + shown.map((f) =>
        '<li class="' + f.severity + '"><span class="tag">' +
        (f.severity === "error" ? "Error" : "Advisory") + "</span><b>" + escapeHtml(humanRule(f.rule)) + "</b> — " +
        escapeHtml(f.message) + '<span class="cite">' + escapeHtml(f.cite) + "</span></li>").join("") + "</ul>"
    : '<p class="pass">Nothing to fix.</p>';
  $("report").innerHTML =
    (PLAIN_PAPER[spec.type] ? '<p class="note">No letterhead on this type by rule: plain white paper — AR 25-50, ' +
      PLAIN_PAPER[spec.type] + ".</p>" : "") + list;

  // Blanks are safe by design - say so once, quietly, with the list an
  // open-if-you-care fold. Re-renders keep whatever the reader chose.
  const group = (title, fields) => !fields.length ? "" :
    '<p class="grouptitle">' + title + '</p><ul class="findings">' +
    fields.map((f) => '<li><span class="tag">Slot</span><b>' + escapeHtml(f.label) + "</b> — " + escapeHtml(f.hint) +
      '<span class="cite">' + escapeHtml(f.cite) + "</span></li>").join("") + "</ul>";
  const unitBlanks = outstandingFields(spec, "unit");
  const memoBlanks = outstandingFields(spec, "memorandum").filter((f) => !f.optional);
  const nBlanks = unitBlanks.length + memoBlanks.length;
  const wasOpen = !!$("outstanding").querySelector("details[open]");
  $("outstanding").innerHTML = !nBlanks ? "" :
    '<details class="blanks"' + (wasOpen ? " open" : "") + "><summary>" +
    nBlanks + " blank" + (nBlanks === 1 ? "" : "s") +
    " — fine to leave; each comes out as a grey click-to-type slot in the Word file.</summary>" +
    group("Your unit", unitBlanks) + group("This memorandum", memoBlanks) + "</details>";

  $("preview").innerHTML = renderHtml(spec);
  fitPreview();
  applyFields(spec);
}

function fitPreview() {
  const box = $("preview");
  const sheet = box.querySelector(".page");
  if (!sheet) return;
  box.style.zoom = "";
  const natural = sheet.getBoundingClientRect().width;
  if (!natural || !box.clientWidth) return;
  const scale = Math.min(1, box.clientWidth / (natural + 24));
  if (scale < 1) box.style.zoom = String(scale);
}

function applyFields(spec) {
  const known = new Map();
  for (const f of [...unitFields(spec), ...memorandumFields(spec)]) known.set(f.path, f);
  document.querySelectorAll("[data-field]").forEach((el) => {
    const f = known.get(el.dataset.field);
    if (!f && el.dataset.field === "addressees" && spec.seeDistribution) {
      el.classList.remove("hidden");
      return;
    }
    el.classList.toggle("hidden", !f);
    if (!f) return;
    const text = el.querySelector(".label-text");
    if (text) text.textContent = f.label + (f.optional ? " (optional)" : "");
    const em = el.querySelector("em");
    if (em) em.textContent = f.hint;   // the cite stays in the blanks list, not on every input
  });
  const agreement = spec.type === "mou" || spec.type === "moa";
  $("agreementfields").classList.toggle("hidden", !agreement);
  $("digitalSignatureField").classList.toggle("hidden", spec.type === "letter");
  const anyUnit = Array.from(document.querySelectorAll("#unitfields .field[data-field]"))
    .some((el) => !el.classList.contains("hidden"));
  $("unitfields").classList.toggle("hidden", !anyUnit);
}

function updateSubjectCount() {
  const words = $("subject").value.trim().split(/\s+/).filter(Boolean).length;
  const el = $("subjectcount");
  el.textContent = words ? words + " word" + (words === 1 ? "" : "s") : "";
  el.classList.toggle("over", words > 10);
}

const slug = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
function filename(ext) {
  const spec = currentSpec();
  return ([slug(spec.type), slug($("subject").value)].filter(Boolean).join("-") || "memorandum") + "." + ext;
}
function saveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

$("dl").addEventListener("click", async () => {
  $("dl").disabled = true;
  try {
    const spec = specFromForm(formValues());   // no data-URI seal in the file; real bytes below
    const buffer = await renderDocx(spec, {seal: SEAL_BYTES});
    saveBlob(new Blob([buffer], {type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}), filename("docx"));
  } catch (e) {
    $("report").innerHTML = '<p style="color:var(--err)">' + escapeHtml(e.message) + "</p>";
  } finally {
    $("dl").disabled = false;
  }
});
$("spec").addEventListener("click", () => {
  saveBlob(new Blob([JSON.stringify(specFromForm(formValues()), null, 2) + "\n"], {type: "application/json"}), filename("json"));
});

/*
 * The tailoring prompt, word for word what the full install's /draft route
 * sends its model - the user's typed body is the raw material, the
 * instruction is "keep every fact". Copied to the clipboard so the live
 * page's tailoring runs through any AI the user already has, with the
 * result pasted back into the Body.
 */
$("copyPrompt").addEventListener("click", async () => {
  const asked = $("request").value.trim();
  const rawSubject = $("subject").value.trim();
  const rawBody = $("body").value.trim();
  if (!asked && !rawBody) {
    $("promptnote").textContent = "Say what the memorandum needs to do, or type rough words in the Body first.";
    return;
  }
  const prompt = [
    asked || "Prepare this memorandum from the rough words below.",
    rawSubject ? `Working subject: ${rawSubject}` : "",
    rawBody ? "Tailor these rough words into the memorandum's paragraphs - keep every "
        + `fact, correct the wording and tone, and put them in proper form:\n${rawBody}` : "",
    "Return only the subject line and the paragraphs, one paragraph per block, no numbering - the formatter owns the numbers.",
  ].filter(Boolean).join("\n\n");
  try {
    await navigator.clipboard.writeText(prompt);
    $("promptnote").textContent = "Copied. Paste it into Claude, then paste the tailored paragraphs back into the Body.";
  } catch (e) {
    $("promptnote").textContent = prompt;   // clipboard blocked: show it to copy by hand
  }
});

// This memorandum's fields only - the unit's stay, by design.
const MEMO_IDS = ["request", "subject", "body", "addressees", "distribution", "parties",
  "addresseeTitle", "addresseeAddress", "toCommanderOf", "thru", "enclosures",
  "copiesFurnished", "date", "suspenseDate", "authorityLine", "salutation", "addresseeCategory",
  "signer1Name", "signer1Grade", "signer1Title", "signer2Name", "signer2Grade", "signer2Title"];
$("newmemo").addEventListener("click", () => {
  for (const id of MEMO_IDS) $(id).value = "";
  $("type").value = "";
  $("digitalSignature").checked = true;
  $("detected").textContent = "";
  $("promptnote").textContent = "";
  updateSubjectCount();
  render();
});

let autoTimer = 0;
const autoRender = () => { clearTimeout(autoTimer); autoTimer = setTimeout(render, 200); };
$("f").addEventListener("change", autoRender);
$("f").addEventListener("input", (e) => {
  if (e.target.id === "subject") updateSubjectCount();
});
$("type").addEventListener("change", () => {
  // A chosen type is final - say so, and stop echoing a stale detection.
  const chosen = $("type").value;
  const meta = MEMO_TYPES[chosen];
  $("detected").textContent = meta ? "Type set: " + meta.title + " (" + meta.cite + ")" : "";
  render();
});
$("request").addEventListener("blur", () => {
  if (!$("request").value.trim() || $("type").value) return;
  const type = detectMemoType($("request").value);
  const meta = MEMO_TYPES[type] ?? MEMO_TYPES.standard;
  $("detected").textContent = "Reading this as: " + meta.title + " (" + meta.cite + ")";
  render();
});
for (const id of UNIT_IDS) $(id).addEventListener("change", () => {
  const n = Object.keys(saveUnit()).length;
  $("unitnote").textContent = n ? n + " of " + UNIT_IDS.length + " remembered on this browser." : "";
});
window.addEventListener("resize", fitPreview);

loadUnit();
updateSubjectCount();
render();
