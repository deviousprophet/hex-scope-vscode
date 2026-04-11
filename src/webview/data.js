"use strict";
// ── Data processing ───────────────────────────────────────────────
// Builds S.flatBytes / S.sortedAddrs from parse result segments,
// and S.memRows (BPR-aligned row list with gap entries) from flatBytes.
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFlatBytes = initFlatBytes;
exports.buildMemRows = buildMemRows;
const state_1 = require("./state");
/** Populate flatBytes + sortedAddrs from the current parseResult. */
function initFlatBytes() {
    state_1.S.flatBytes.clear();
    if (!state_1.S.parseResult) {
        state_1.S.sortedAddrs = [];
        return;
    }
    for (const seg of state_1.S.parseResult.segments) {
        for (let i = 0; i < seg.data.length; i++) {
            state_1.S.flatBytes.set(seg.startAddress + i, seg.data[i]);
        }
    }
    state_1.S.sortedAddrs = [...state_1.S.flatBytes.keys()].sort((a, b) => a - b);
}
/**
 * Build S.memRows — one `{ type:'data', address }` entry per BPR-aligned
 * row that contains at least one mapped byte, with `{ type:'gap' }` entries
 * inserted between non-adjacent rows.
 */
function buildMemRows() {
    state_1.S.memRows = [];
    if (state_1.S.sortedAddrs.length === 0) {
        return;
    }
    // Collect every BPR-aligned row base that has at least one byte
    const rowSet = new Set();
    for (const a of state_1.S.sortedAddrs) {
        rowSet.add(a - (a % state_1.BPR));
    }
    const rows = [...rowSet].sort((a, b) => a - b);
    for (let i = 0; i < rows.length; i++) {
        if (i > 0) {
            const prev = rows[i - 1];
            const cur = rows[i];
            if (cur - prev > state_1.BPR) {
                state_1.S.memRows.push({ type: 'gap', from: prev + state_1.BPR, to: cur - 1, bytes: cur - prev - state_1.BPR });
            }
        }
        state_1.S.memRows.push({ type: 'data', address: rows[i] });
    }
}
//# sourceMappingURL=data.js.map