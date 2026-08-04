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
<header>
  <h1>Army memorandum — AR 25-50</h1>
  <p>You write the words; the layout is not editable, because none of it is a choice. Pick a type and the example appears; everything you type replaces it live.</p>
</header>
<main>
<form id="f" autocomplete="off" onsubmit="return false">
  <fieldset>
    <legend>What do you need</legend>
    <p>The memorandum type is read from this. Override it with the dropdown if the guess is wrong.</p>
    <label for="request"><span class="label-text">Say it plainly</span></label>
    <textarea id="request" style="min-height:70px" placeholder="I had a staff meeting about the barracks renovation budget and need to document it"></textarea>
    <label for="type"><span class="label-text">Type</span></label>
    <select id="type">
      <option value="">Detect from the request</option>
      ${TYPES.map((t) => `<option value="${t.type}">${t.title} — ${t.cite}</option>`).join("")}
    </select>
    <p class="note" id="detected"></p>
    <p class="note">Drafting with the local language model runs in the full install (<span class="mono">node army-memo-agent.js --serve</span>); this page formats and checks your words with the same code.</p>
  </fieldset>

  <fieldset>
    <legend>Your words</legend>
    <p>Type what you need in your own words. Blank line between paragraphs; indent (or start with “- ”) for a subparagraph; never type the numbers — the renderer owns them (para 2-4b(4)(b)).</p>
    <label for="subject"><span class="label-text">Subject</span><em>ten words or less, para 2-4a(6)</em></label>
    <input id="subject" placeholder="Staff Meeting on Barracks Renovation Funding">
    <p class="counter" id="subjectcount"></p>
    <label for="body"><span class="label-text">Body</span></label>
    <textarea id="body" style="min-height:120px" placeholder="This memorandum documents a staff meeting on 30 July 2026 concerning the barracks renovation.

My point of contact is Ms. Karen Blake, ATZB-DPW, 719-555-0173."></textarea>
    <button type="button" class="secondary" id="copyPrompt">Copy tailoring prompt</button>
    <p class="note" id="promptnote">Rough words are fine. This copies your request, subject, and body wrapped in the tailoring instruction — paste it into Claude, then paste the tailored paragraphs back into the Body.</p>
    ${area("addressees", "Addressees", "one per line — para 2-4a(5)")}
    ${area("distribution", "Distribution", "more than five addressees uses this — defaults to the addressee list", "distribution", 48)}
    ${area("parties", "Parties to the agreement", "one per line — para 2-6c(2)")}
    ${field("addresseeTitle", "Addressee's title", "the person's duty title — para 2-4a(5)")}
    ${field("addresseeAddress", "Addressee's mailing address", "“Exclusive For” only — para 1-12b(1)")}
    ${field("toCommanderOf", "Or, addressed to the commander of", "leave blank to address the named person — para 1-12b(1)")}
    ${area("thru", "THRU addressees", "one per line, two at most — para 2-4a(5)(d)", "thru", 48)}
    <label for="enclosures"><span class="label-text">Enclosures</span><em>optional — one title per line, chapter 4</em></label>
    <textarea id="enclosures" style="min-height:48px"></textarea>
    <label for="copiesFurnished"><span class="label-text">Copies furnished</span><em>one per line, para 2-4c(5)</em></label>
    <textarea id="copiesFurnished" style="min-height:48px"></textarea>
  </fieldset>

  <fieldset id="agreementfields" class="hidden">
    <legend>Signers</legend>
    <p>Two agreeing officials, in protocol order — para 2-6c(5)(d). Leave a grade blank for a civilian.</p>
    ${plain("signer1Name", "Signer 1 — junior official — name")}
    ${plain("signer1Grade", "Signer 1 — grade and branch", "blank for a civilian")}
    ${plain("signer1Title", "Signer 1 — title and agency")}
    ${plain("signer2Name", "Signer 2 — senior official — name")}
    ${plain("signer2Grade", "Signer 2 — grade and branch", "blank for a civilian")}
    ${plain("signer2Title", "Signer 2 — title and agency")}
  </fieldset>

  <fieldset id="unitfields">
    <legend>Your unit</legend>
    <p>Fill these in once — this browser remembers them. Anything left blank comes out as a click-to-type slot in Word, formatting locked.</p>
    ${field("organization", "Letterhead organization", "paras 1-16b and 1-18", "letterhead.organization")}
    ${field("streetAddress", "Street address", "para 1-18", "letterhead.streetAddress")}
    ${field("cityStateZip", "City, State ZIP+4", "two spaces before the ZIP — para 5-10b", "letterhead.cityStateZip")}
    ${field("officeSymbol", "Office symbol", "para 2-4a(1)")}
    ${field("signerName", "Signer name", "para 6-4c", "signature.name")}
    ${field("signerGrade", "Grade and branch", "paras 6-4f and 6-5c", "signature.gradeAndBranch")}
    ${field("signerTitle", "Duty title", "para 6-4c", "signature.title")}
    <p class="note" id="unitnote"></p>
    <button type="button" class="secondary" id="forget">Forget this unit</button>
  </fieldset>

  <fieldset>
    <legend>This memorandum</legend>
    ${field("date", "Date", "defaults to today — " + formatMemoDate())}
    ${field("suspenseDate", "Suspense date", "optional — para 2-4a(4)")}
    ${field("authorityLine", "Authority line", "only when signing for the commander — para 2-4c(1)")}
    ${field("salutation", "Salutation", "letters only — para 3-6a(4)")}
    ${field("addresseeCategory", "Addressee category", "letters only — appendix C heading")}
    <div id="digitalSignatureField">
      <label class="checkbox" for="digitalSignature"><input type="checkbox" id="digitalSignature" checked>
      <span class="label-text">Digitally signed</span><em>uncheck for a wet signature</em></label>
    </div>
  </fieldset>

  <button type="button" id="dl">Download .docx</button>
  <button type="button" class="secondary" id="spec">Download spec (JSON)</button>
  <button type="button" class="secondary" id="newmemo">New memorandum</button>
  <p class="note">New memorandum clears this memorandum's fields and keeps your unit.</p>
</form>

<section id="out">
  <div id="report"><p class="note">Pick a type or say what you need — the example appears here, and everything you type replaces it live.</p></div>
  <div id="outstanding"></div>
  <div id="preview"></div>
  <p class="note">Runs entirely in this page — nothing you type leaves your browser, and the Word file is built locally. Same code, same checks as the full install (jermrox/ai-agents-from-scratch, examples/16_army-memo-agent).</p>
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

function render() {
  const spec = currentSpec();
  const result = validateMemo(spec);
  const meta = MEMO_TYPES[spec.type] ?? MEMO_TYPES.standard;

  const errs = result.findings.filter((f) => f.severity === "error").length;
  const list = result.findings.length
    ? '<ul class="findings">' + result.findings.map((f) =>
        '<li class="' + f.severity + '"><span class="rule">' + f.rule + '</span> ' +
        escapeHtml(f.message) + '<br><span class="cite">' + escapeHtml(f.cite) + '</span></li>').join("") + "</ul>"
    : '<p class="pass">Compliant. No findings.</p>';
  $("report").innerHTML =
    '<p class="note">Type: <b>' + escapeHtml(meta.title) + '</b> — ' + escapeHtml(meta.cite) +
    ' · ' + result.pages + (result.pages === 1 ? " page" : " pages") +
    (errs ? ' · <span style="color:var(--err)">' + errs + " error" + (errs === 1 ? "" : "s") + "</span>" : "") + "</p>" +
    (PLAIN_PAPER[spec.type] ? '<p class="note">No letterhead on this type by rule: plain white paper — AR 25-50, ' +
      PLAIN_PAPER[spec.type] + ".</p>" : "") + list;

  const group = (title, fields) => !fields.length ? "" :
    '<p class="note"><b>' + title + '</b></p><ul class="findings">' +
    fields.map((f) => '<li><span class="rule">' + escapeHtml(f.label) + "</span> " + escapeHtml(f.hint) +
      '<br><span class="cite">' + escapeHtml(f.cite) + "</span></li>").join("") + "</ul>";
  $("outstanding").innerHTML =
    group("Still to be supplied — your unit", outstandingFields(spec, "unit")) +
    group("Still to be supplied — this memorandum", outstandingFields(spec, "memorandum").filter((f) => !f.optional));

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
    if (em) em.textContent = f.hint + " — " + f.cite;
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
