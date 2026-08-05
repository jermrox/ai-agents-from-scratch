/**
 * HTTP API entry. Re-exports the server implementation and starts it when run
 * directly (`npm run serve`).
 */

import {createMemoServer, serve, parseBody, bodyFromParagraphs, specFromForm} from "../memo-server.js";

export {createMemoServer, serve, parseBody, bodyFromParagraphs, specFromForm};

const isDirectRun = process.argv[1]
    && import.meta.url === new URL(process.argv[1], "file:").href;

if (isDirectRun) {
    const flag = (name) => {
        const i = process.argv.indexOf(name);
        return i >= 0 ? process.argv[i + 1] : undefined;
    };
    await serve({
        port: flag("--port") ? Number(flag("--port")) : Number(process.env.PORT) || undefined,
        host: flag("--host") ?? process.env.HOST,
        seal: flag("--seal"),
        modelPath: flag("--model") ?? process.env.ANTHROPIC_MODEL ?? process.env.MEMO_MODEL_PATH,
    });
}
