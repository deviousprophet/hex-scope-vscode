"use strict";
// ── Pure utility functions ────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.esc = esc;
exports.fmtB = fmtB;
exports.byteClass = byteClass;
function esc(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function fmtB(b) {
    if (b < 1024) {
        return `${b} B`;
    }
    if (b < 1_048_576) {
        return `${(b / 1024).toFixed(1)} KB`;
    }
    return `${(b / 1_048_576).toFixed(1)} MB`;
}
/** CSS class for a hex byte cell based on its value. */
function byteClass(v) {
    if (v === 0) {
        return 'bz';
    } // zero  → dim
    if (v >= 0x20 && v < 0x7F) {
        return 'bp';
    } // print → warm
    if (v >= 0x80) {
        return 'bh';
    } // high  → cool
    return 'bn'; // control → default
}
//# sourceMappingURL=utils.js.map