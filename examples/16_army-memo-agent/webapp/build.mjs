/**
 * Build the live, self-contained browser version of the memorandum builder.
 *
 * Bundles the repo's own modules - specFromForm(), validateMemo(),
 * renderHtml(), renderDocx(), the same code verify.js's checks stand behind -
 * into one artifact.html with the seal embedded, no server and no network.
 *
 *   npm i --no-save esbuild buffer
 *   node examples/16_army-memo-agent/webapp/build.mjs
 */
import {readFileSync, writeFileSync} from "fs";
import {execSync} from "child_process";
import {fileURLToPath} from "url";
import path from "path";
import {createRequire} from "module";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// The seal ships in assets/; the page carries it as base64 so nothing loads
// over the network (artifact pages block external requests entirely).
const seal = readFileSync(path.join(here, "../assets/dow-seal.png"));
writeFileSync(path.join(here, "seal-data.js"),
    "export const SEAL_BASE64 = " + JSON.stringify(seal.toString("base64")) + ";\n");

const esbuild = path.join(path.dirname(require.resolve("esbuild/package.json")), "bin/esbuild");
const buffer = require.resolve("buffer/index.js");
execSync([
    esbuild, path.join(here, "entry.js"), "--bundle", "--format=iife", "--minify",
    `--alias:fs/promises=${path.join(here, "stub-fs.js")}`,
    `--alias:path=${path.join(here, "stub-path.js")}`,
    `--alias:url=${path.join(here, "stub-url.js")}`,
    `--alias:buffer=${buffer}`,
    `--inject:${path.join(here, "buffer-shim.js")}`,
    '--define:import.meta.url=\'"file:///bundle/"\'',
    `--outfile=${path.join(here, "bundle.js")}`,
].join(" "), {stdio: "inherit"});

// Plain concatenation, never String.replace - a minified bundle contains
// replacement patterns ($&, $') that replace() would expand.
const bundle = readFileSync(path.join(here, "bundle.js"), "utf8").replace(/<\/script/g, "<\\/script");
const head = readFileSync(path.join(here, "head.html"), "utf8");
writeFileSync(path.join(here, "artifact.html"), head + "<script>\n" + bundle + "\n</script>\n");
console.log("webapp/artifact.html built");
