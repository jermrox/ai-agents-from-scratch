/**
 * Load golden memorandum fixtures from datasets/.
 *
 * Fixtures pair Claude-shaped content JSON with matters-of-record context.
 * They power --offline, --fixture, smoke tests, and SDK harnesses without a key.
 */

import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import {fileURLToPath} from "url";

export const DATASETS_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), "..", "datasets");

function readJsonSync(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function readJson(filePath) {
    return JSON.parse(await fsPromises.readFile(filePath, "utf8"));
}

let indexCache = null;

/** Catalog from datasets/index.json. */
export function loadDatasetIndexSync() {
    indexCache ??= readJsonSync(path.join(DATASETS_ROOT, "index.json"));
    return indexCache;
}

export async function loadDatasetIndex() {
    return loadDatasetIndexSync();
}

/** List fixture ids (and metadata) for CLI/API discovery. */
export function listFixtures() {
    const index = loadDatasetIndexSync();
    return Object.entries(index.fixtures).map(([id, meta]) => ({
        id,
        type: meta.type,
        request: meta.request,
        default: id === index.defaultFixture,
    }));
}

function materialize(id, meta, content, context) {
    return {
        id,
        type: meta.type,
        request: meta.request,
        content,
        context: {...context, type: meta.type},
    };
}

/** Load one fixture by id (sync; fixtures are local JSON). */
export function loadFixtureSync(id) {
    const index = loadDatasetIndexSync();
    const meta = index.fixtures[id];
    if (!meta) {
        const known = Object.keys(index.fixtures).join(", ");
        throw new Error(`Unknown fixture "${id}". Known: ${known}`);
    }
    const content = readJsonSync(path.join(DATASETS_ROOT, meta.content));
    const context = readJsonSync(path.join(DATASETS_ROOT, meta.context));
    return materialize(id, meta, content, context);
}

export async function loadFixture(id) {
    return loadFixtureSync(id);
}

/** Default offline fixture (range-closure). */
export function loadDefaultFixtureSync() {
    const index = loadDatasetIndexSync();
    return loadFixtureSync(index.defaultFixture);
}

export async function loadDefaultFixture() {
    return loadDefaultFixtureSync();
}

const defaultFixture = loadDefaultFixtureSync();

/** Classic names for verify.js / CLI offline path. */
export const OFFLINE_CONTENT = defaultFixture.content;
export const OFFLINE_CONTEXT = (() => {
    const {type, ...rest} = defaultFixture.context;
    return rest;
})();

/** Validate every fixture file in the catalog is readable and shaped. */
export async function auditDatasets() {
    const index = await loadDatasetIndex();
    const report = [];
    for (const id of Object.keys(index.fixtures)) {
        const fixture = await loadFixture(id);
        const issues = [];
        // Letters may omit a subject (para 3-6a(2) "if used").
        if (fixture.type !== "letter" && !fixture.content?.subject) issues.push("missing subject");
        if (!Array.isArray(fixture.content?.paragraphs) || !fixture.content.paragraphs.length) {
            issues.push("missing paragraphs");
        }
        if (!fixture.type) issues.push("missing type");
        if (!fixture.request) issues.push("missing request");
        report.push({id, type: fixture.type, ok: issues.length === 0, issues});
    }
    return report;
}
