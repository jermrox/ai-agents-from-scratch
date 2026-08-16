/**
 * HTTP API entry. Re-exports the server implementation and starts it when run
 * directly (`npm run serve`).
 */

import {createMemoServer, serve, parseBody, bodyFromParagraphs, specFromForm} from "../memo-server.js";
import {isDirectRun, serveOptionsFromArgv} from "../runtime.js";

export {createMemoServer, serve, parseBody, bodyFromParagraphs, specFromForm};

if (isDirectRun(import.meta.url)) {
    await serve(serveOptionsFromArgv());
}
