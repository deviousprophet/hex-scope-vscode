"use strict";
// ── Shared mutable state ─────────────────────────────────────────
// All modules import this object and mutate it directly.
Object.defineProperty(exports, "__esModule", { value: true });
exports.S = exports.BPR = void 0;
exports.BPR = 16; // bytes per memory row
exports.S = {
    parseResult: null,
    labels: [],
    flatBytes: new Map(),
    sortedAddrs: [],
    currentView: 'raw', // raw until file validity is known
    rawSource: '',
    selStart: null,
    selEnd: null,
    endian: 'le',
    searchMode: 'hex',
    matchAddrs: [],
    matchIdx: -1,
    memRows: [],
    editMode: false,
    edits: new Map(), // addr → new value (pending saves)
    undoStack: [], // stack of [addr, prevVal] transactions
    structs: [], // user-defined struct definitions
    activeStructId: null, // id of currently selected struct
    activeStructAddr: null, // base address for struct decode
    structPins: [], // saved (structId, addr) overlay instances
    sidebarTab: 'inspector', // active sidebar tab
};
//# sourceMappingURL=state.js.map