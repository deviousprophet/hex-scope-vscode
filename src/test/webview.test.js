"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const utils_1 = require("../webview/utils");
const state_1 = require("../webview/state");
const data_1 = require("../webview/data");
function resetState() {
    state_1.S.parseResult = null;
    state_1.S.labels = [];
    state_1.S.flatBytes.clear();
    state_1.S.sortedAddrs = [];
    state_1.S.memRows = [];
    state_1.S.selStart = null;
    state_1.S.selEnd = null;
    state_1.S.matchAddrs = [];
    state_1.S.matchIdx = -1;
    state_1.S.currentView = 'raw';
    state_1.S.editMode = false;
    state_1.S.edits.clear();
    state_1.S.undoStack.length = 0;
    state_1.S.structs = [];
    state_1.S.activeStructId = null;
    state_1.S.activeStructAddr = null;
    state_1.S.structPins = [];
    state_1.S.sidebarTab = 'inspector';
}
// ── HTML escaping \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
suite('esc()', () => {
    test('plain text is returned unchanged', () => {
        assert.strictEqual((0, utils_1.esc)('Hello, World!'), 'Hello, World!');
    });
    test('empty string is returned unchanged', () => {
        assert.strictEqual((0, utils_1.esc)(''), '');
    });
    test('& is escaped to &amp;', () => {
        assert.strictEqual((0, utils_1.esc)('bread & butter'), 'bread &amp; butter');
    });
    test('< and > are escaped', () => {
        assert.strictEqual((0, utils_1.esc)('<em>'), '&lt;em&gt;');
    });
    test('" is escaped to &quot;', () => {
        assert.strictEqual((0, utils_1.esc)('"quoted"'), '&quot;quoted&quot;');
    });
    test('all special characters together', () => {
        assert.strictEqual((0, utils_1.esc)('<a href="x&y">'), '&lt;a href=&quot;x&amp;y&quot;&gt;');
    });
});
// ── Byte size formatting \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
suite('fmtB()', () => {
    test('0 bytes', () => { assert.strictEqual((0, utils_1.fmtB)(0), '0 B'); });
    test('1 byte', () => { assert.strictEqual((0, utils_1.fmtB)(1), '1 B'); });
    test('1023 bytes stays in B', () => { assert.strictEqual((0, utils_1.fmtB)(1023), '1023 B'); });
    test('1024 bytes is 1.0 KB', () => { assert.strictEqual((0, utils_1.fmtB)(1024), '1.0 KB'); });
    test('1536 bytes is 1.5 KB', () => { assert.strictEqual((0, utils_1.fmtB)(1536), '1.5 KB'); });
    test('1 MB', () => { assert.strictEqual((0, utils_1.fmtB)(1024 * 1024), '1.0 MB'); });
    test('2.5 MB', () => { assert.strictEqual((0, utils_1.fmtB)(1024 * 1024 * 2.5), '2.5 MB'); });
});
// ── Byte CSS class \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
suite('byteClass()', () => {
    test('0x00 \u2192 "bz" (zero)', () => {
        assert.strictEqual((0, utils_1.byteClass)(0x00), 'bz');
    });
    test('0x20 (space) \u2192 "bp" (printable)', () => {
        assert.strictEqual((0, utils_1.byteClass)(0x20), 'bp');
    });
    test('0x41 ("A") \u2192 "bp"', () => {
        assert.strictEqual((0, utils_1.byteClass)(0x41), 'bp');
    });
    test('0x7E ("~") \u2192 "bp"', () => {
        assert.strictEqual((0, utils_1.byteClass)(0x7E), 'bp');
    });
    test('0x7F (DEL) \u2192 "bn" (non-printable)', () => {
        assert.strictEqual((0, utils_1.byteClass)(0x7F), 'bn');
    });
    test('0x01 (control) \u2192 "bn"', () => {
        assert.strictEqual((0, utils_1.byteClass)(0x01), 'bn');
    });
    test('0x80 \u2192 "bh" (high byte)', () => {
        assert.strictEqual((0, utils_1.byteClass)(0x80), 'bh');
    });
    test('0xFF \u2192 "bh"', () => {
        assert.strictEqual((0, utils_1.byteClass)(0xFF), 'bh');
    });
});
// ── State initial values \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
suite('state constants and defaults', () => {
    test('BPR is 16', () => {
        assert.strictEqual(state_1.BPR, 16);
    });
    test('default view is "raw"', () => {
        assert.strictEqual(state_1.S.currentView, 'raw');
    });
    test('default byte order is little-endian', () => {
        assert.strictEqual(state_1.S.endian, 'le');
    });
    test('default search mode is "hex"', () => {
        assert.strictEqual(state_1.S.searchMode, 'hex');
    });
});
// ── initFlatBytes() \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
suite('initFlatBytes()', () => {
    setup(resetState);
    test('clears map when parseResult is null', () => {
        state_1.S.flatBytes.set(0, 0xFF);
        (0, data_1.initFlatBytes)();
        assert.strictEqual(state_1.S.flatBytes.size, 0);
        assert.strictEqual(state_1.S.sortedAddrs.length, 0);
    });
    test('populates flatBytes from a single segment', () => {
        state_1.S.parseResult = {
            records: [],
            segments: [{ startAddress: 0x1000, data: [0xDE, 0xAD, 0xBE, 0xEF] }],
            totalDataBytes: 4, checksumErrors: 0, malformedLines: 0, format: 'ihex',
        };
        (0, data_1.initFlatBytes)();
        assert.strictEqual(state_1.S.flatBytes.get(0x1000), 0xDE);
        assert.strictEqual(state_1.S.flatBytes.get(0x1001), 0xAD);
        assert.strictEqual(state_1.S.flatBytes.get(0x1002), 0xBE);
        assert.strictEqual(state_1.S.flatBytes.get(0x1003), 0xEF);
        assert.strictEqual(state_1.S.flatBytes.size, 4);
    });
    test('populates flatBytes from two non-contiguous segments', () => {
        state_1.S.parseResult = {
            records: [],
            segments: [
                { startAddress: 0x0000, data: [0x01, 0x02] },
                { startAddress: 0x0200, data: [0x03, 0x04] },
            ],
            totalDataBytes: 4, checksumErrors: 0, malformedLines: 0, format: 'ihex',
        };
        (0, data_1.initFlatBytes)();
        assert.strictEqual(state_1.S.flatBytes.size, 4);
        assert.strictEqual(state_1.S.flatBytes.get(0x0000), 0x01);
        assert.strictEqual(state_1.S.flatBytes.get(0x0200), 0x03);
        assert.strictEqual(state_1.S.flatBytes.get(0x0100), undefined);
    });
    test('sortedAddrs is in ascending address order', () => {
        state_1.S.parseResult = {
            records: [],
            segments: [
                { startAddress: 0x0300, data: [0xAA] },
                { startAddress: 0x0100, data: [0xBB] },
            ],
            totalDataBytes: 2, checksumErrors: 0, malformedLines: 0, format: 'ihex',
        };
        (0, data_1.initFlatBytes)();
        assert.deepStrictEqual(state_1.S.sortedAddrs, [0x0100, 0x0300]);
    });
});
// ── buildMemRows() \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
suite('buildMemRows()', () => {
    setup(resetState);
    test('produces no rows when flatBytes is empty', () => {
        (0, data_1.buildMemRows)();
        assert.strictEqual(state_1.S.memRows.length, 0);
    });
    test('a single 16-byte segment produces one data row, no gap', () => {
        state_1.S.parseResult = {
            records: [],
            segments: [{ startAddress: 0x0000, data: new Array(16).fill(0xAA) }],
            totalDataBytes: 16, checksumErrors: 0, malformedLines: 0, format: 'ihex',
        };
        (0, data_1.initFlatBytes)();
        (0, data_1.buildMemRows)();
        assert.strictEqual(state_1.S.memRows.filter(r => r.type === 'data').length, 1);
        assert.strictEqual(state_1.S.memRows.filter(r => r.type === 'gap').length, 0);
    });
    test('data row addresses are BPR-aligned', () => {
        state_1.S.parseResult = {
            records: [],
            segments: [{ startAddress: 0x0007, data: [0x01, 0x02, 0x03] }],
            totalDataBytes: 3, checksumErrors: 0, malformedLines: 0, format: 'ihex',
        };
        (0, data_1.initFlatBytes)();
        (0, data_1.buildMemRows)();
        const row = state_1.S.memRows.find(r => r.type === 'data');
        assert.ok(row && row.type === 'data');
        assert.strictEqual(row.address % state_1.BPR, 0);
    });
    test('two adjacent BPR-rows produce no gap', () => {
        state_1.S.parseResult = {
            records: [],
            segments: [{ startAddress: 0x0000, data: new Array(32).fill(0xFF) }],
            totalDataBytes: 32, checksumErrors: 0, malformedLines: 0, format: 'ihex',
        };
        (0, data_1.initFlatBytes)();
        (0, data_1.buildMemRows)();
        assert.strictEqual(state_1.S.memRows.filter(r => r.type === 'gap').length, 0);
        assert.strictEqual(state_1.S.memRows.filter(r => r.type === 'data').length, 2);
    });
    test('address skip of one BPR row inserts exactly one gap row', () => {
        // row 0x0000 and row 0x0020 with row 0x0010 missing
        state_1.S.parseResult = {
            records: [],
            segments: [
                { startAddress: 0x0000, data: [0x01] },
                { startAddress: 0x0020, data: [0x02] },
            ],
            totalDataBytes: 2, checksumErrors: 0, malformedLines: 0, format: 'ihex',
        };
        (0, data_1.initFlatBytes)();
        (0, data_1.buildMemRows)();
        const gaps = state_1.S.memRows.filter(r => r.type === 'gap');
        assert.strictEqual(gaps.length, 1);
        const g = gaps[0];
        assert.ok(g.type === 'gap');
        assert.strictEqual(g.from, 0x0010);
        assert.strictEqual(g.to, 0x001F);
        assert.strictEqual(g.bytes, 16);
    });
    test('rows are ordered by ascending address regardless of segment order', () => {
        state_1.S.parseResult = {
            records: [],
            segments: [
                { startAddress: 0x0040, data: [0x01] },
                { startAddress: 0x0000, data: [0x02] },
            ],
            totalDataBytes: 2, checksumErrors: 0, malformedLines: 0, format: 'ihex',
        };
        (0, data_1.initFlatBytes)();
        (0, data_1.buildMemRows)();
        const dataRows = state_1.S.memRows.filter(r => r.type === 'data');
        assert.ok(dataRows.length >= 2);
        for (let i = 1; i < dataRows.length; i++) {
            assert.ok(dataRows[i].type === 'data' && dataRows[i - 1].type === 'data');
            assert.ok(dataRows[i].address > dataRows[i - 1].address);
        }
    });
});
//# sourceMappingURL=webview.test.js.map