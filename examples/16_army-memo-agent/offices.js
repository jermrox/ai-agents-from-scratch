/**
 * The office of record.
 *
 * An office symbol is not something a drafter should be typing per memorandum.
 * Para 2-4a(1) says only what it is - "The office symbol identifies the
 * writer's office (for example, ISES-RM)" - and AR 25-50 publishes no
 * directory of them. Figure B-2 lists the 36 HQDA principal officials, but by
 * *title* and with no symbols attached; it governs who you address and in what
 * order, not what your own symbol is.
 *
 * So the symbol, the ARIMS record number and the letterhead are one thing:
 * facts about an office, held by the organization that owns them. Configure
 * them once and pick the office; do not retype three fields and hope.
 *
 * Point `MEMO_OFFICES_PATH` at a JSON file to supply your own:
 *
 *   [
 *     {
 *       "id": "atzb-rc",
 *       "name": "Range Control, 4th Infantry Division",
 *       "officeSymbol": "ATZB-RC",
 *       "arimsRecordNumber": "25-50a",
 *       "letterhead": {
 *         "organization": "Headquarters, 4th Infantry Division",
 *         "streetAddress": "1633 Mekong Street",
 *         "cityStateZip": "Fort Carson, CO  80913-4321"
 *       }
 *     }
 *   ]
 *
 * Nothing ships as a default. An invented office symbol is worse than a blank
 * one: [OFFICE SYMBOL] is obviously unfinished, ATZB-RC is obviously finished
 * and wrong.
 */

import fs from "fs/promises";
import path from "path";
import {fileURLToPath} from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const OFFICES_PATH = process.env.MEMO_OFFICES_PATH
    ?? path.join(__dirname, "offices.json");

export const OFFICE_CITE = "AR 25-50, paras 2-4a(1), 2-4a(2), and 1-18";

/** An office directory entry, with everything missing left missing. */
export function normalizeOffice(raw = {}, index = 0) {
    const name = String(raw.name ?? raw.officeSymbol ?? `Office ${index + 1}`).trim();
    return {
        id: String(raw.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-|-$/g, ""),
        name,
        officeSymbol: raw.officeSymbol ? String(raw.officeSymbol).trim() : null,
        arimsRecordNumber: raw.arimsRecordNumber ? String(raw.arimsRecordNumber).trim() : null,
        letterhead: raw.letterhead
            ? {
                organization: raw.letterhead.organization ?? null,
                streetAddress: raw.letterhead.streetAddress ?? null,
                cityStateZip: raw.letterhead.cityStateZip ?? null,
            }
            : null,
    };
}

/**
 * Read the directory. A missing file is not an error - it means nobody has
 * configured one yet, and the record fields stay placeholders.
 */
export async function loadOffices(officesPath = OFFICES_PATH) {
    let text;
    try {
        text = await fs.readFile(officesPath, "utf8");
    } catch (err) {
        if (err.code === "ENOENT") return [];
        throw err;
    }

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        throw new Error(`${officesPath} is not valid JSON: ${err.message}`);
    }
    if (!Array.isArray(parsed)) {
        throw new Error(`${officesPath} must hold a JSON array of offices.`);
    }
    return parsed.map(normalizeOffice);
}

/** The office with this id, or null. */
export function findOffice(offices, id) {
    if (!id) return null;
    return offices.find((o) => o.id === id) ?? null;
}

/**
 * The record fields an office supplies. Only what it actually holds - an entry
 * with no letterhead leaves the letterhead alone rather than blanking it.
 */
export function officeRecordFields(office) {
    if (!office) return {};
    const out = {};
    if (office.officeSymbol) out.officeSymbol = office.officeSymbol;
    if (office.arimsRecordNumber) out.arimsRecordNumber = office.arimsRecordNumber;
    if (office.letterhead && Object.values(office.letterhead).some(Boolean)) {
        out.letterhead = office.letterhead;
    }
    return out;
}
