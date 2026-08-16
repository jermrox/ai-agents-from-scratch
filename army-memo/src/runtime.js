/**
 * Shared process helpers for CLI and API entrypoints.
 */

/** True when this module file is the process entrypoint. */
export function isDirectRun(metaUrl, argv1 = process.argv[1]) {
    if (!argv1) return false;
    try {
        return metaUrl === new URL(argv1, "file:").href;
    } catch {
        return false;
    }
}

/** Read `--flag value` from argv. */
export function flagValue(argv, name) {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
}

/** Resolve Claude model id from CLI flag and env. */
export function resolveModelId(flagModel) {
    return flagModel
        ?? process.env.ANTHROPIC_MODEL
        ?? process.env.MEMO_MODEL_PATH
        ?? undefined;
}

/** Common serve() options from argv + env. */
export function serveOptionsFromArgv(argv = process.argv) {
    return {
        port: flagValue(argv, "--port")
            ? Number(flagValue(argv, "--port"))
            : (Number(process.env.PORT) || undefined),
        host: flagValue(argv, "--host") ?? process.env.HOST,
        seal: flagValue(argv, "--seal"),
        modelPath: resolveModelId(flagValue(argv, "--model")),
    };
}
