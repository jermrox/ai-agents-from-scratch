#!/usr/bin/env node
import {main} from "../src/army-memo-agent.js";

try {
    await main(process.argv.slice(2));
} catch (err) {
    console.error(err?.message ?? String(err));
    process.exit(1);
}
