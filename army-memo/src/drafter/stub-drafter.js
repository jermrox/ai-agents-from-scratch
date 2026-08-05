/**
 * A drafter that needs no model.
 *
 * Wrap a plain `(request, feedback) => content` function in the same interface
 * as the Claude drafter so the draft/validate/repair loop is testable offline.
 */

export function stubDrafter(draft) {
    let queue = Promise.resolve();
    return {
        withSession(fn) {
            const run = queue.then(() => fn(draft));
            queue = run.then(() => {}, () => {});
            return run;
        },
        pending: 0,
        info: {modelPath: null, contextSize: null, timeoutMs: null},
        async dispose() {},
    };
}
