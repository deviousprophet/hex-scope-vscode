"use strict";
// ── Render callback registry ─────────────────────────────────────
// Breaks circular dependencies between UI modules.
// hexViewer.ts fills these in after wiring all modules together.
Object.defineProperty(exports, "__esModule", { value: true });
exports.rerender = void 0;
exports.rerender = {
    /** Re-render the memory body and re-attach byte listeners. */
    memory: () => { },
    /** Re-render the labels sidebar section. */
    labels: () => { },
    /** Switch to memory view (and re-render). */
    toMemory: () => { },
};
//# sourceMappingURL=render.js.map