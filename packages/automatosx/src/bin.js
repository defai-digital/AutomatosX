#!/usr/bin/env node
/**
 * AutomatosX CLI binary wrapper
 *
 * Re-exports the main CLI for backwards compatibility.
 */
import { run } from '@defai.digital/cli';
run(process.argv)
    .then((exitCode) => {
    process.exit(exitCode);
})
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=bin.js.map