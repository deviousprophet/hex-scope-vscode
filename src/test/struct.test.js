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
const struct_codec_1 = require("../webview/struct-codec");
const state_1 = require("../webview/state");
function resetStructState() {
    state_1.S.structs = [];
    state_1.S.activeStructId = null;
    state_1.S.activeStructAddr = null;
    state_1.S.flatBytes.clear();
    state_1.S.sortedAddrs = [];
}
// ── fieldByteSize ─────────────────────────────────────────────────
suite('fieldByteSize()', () => {
    test('uint8  → 1', () => assert.strictEqual((0, struct_codec_1.fieldByteSize)('uint8'), 1));
    test('int8   → 1', () => assert.strictEqual((0, struct_codec_1.fieldByteSize)('int8'), 1));
    test('uint16 → 2', () => assert.strictEqual((0, struct_codec_1.fieldByteSize)('uint16'), 2));
    test('int16  → 2', () => assert.strictEqual((0, struct_codec_1.fieldByteSize)('int16'), 2));
    test('uint32 → 4', () => assert.strictEqual((0, struct_codec_1.fieldByteSize)('uint32'), 4));
    test('int32  → 4', () => assert.strictEqual((0, struct_codec_1.fieldByteSize)('int32'), 4));
    test('float32→ 4', () => assert.strictEqual((0, struct_codec_1.fieldByteSize)('float32'), 4));
    test('float64→ 8', () => assert.strictEqual((0, struct_codec_1.fieldByteSize)('float64'), 8));
});
// ── structByteSize ────────────────────────────────────────────────
suite('structByteSize()', () => {
    test('empty struct is 0 bytes', () => {
        const def = { id: 'x', name: 'Empty', fields: [] };
        assert.strictEqual((0, struct_codec_1.structByteSize)(def), 0);
    });
    test('single uint32 field is 4 bytes', () => {
        const def = { id: 'x', name: 'S', fields: [
                { name: 'a', type: 'uint32', count: 1, endian: 'inherit' },
            ] };
        assert.strictEqual((0, struct_codec_1.structByteSize)(def), 4);
    });
    test('mixed field types sum correctly', () => {
        const def = { id: 'x', name: 'S', fields: [
                { name: 'a', type: 'uint8', count: 1, endian: 'inherit' }, // 1
                { name: 'b', type: 'uint16', count: 1, endian: 'inherit' }, // 2
                { name: 'c', type: 'uint32', count: 1, endian: 'inherit' }, // 4
            ] };
        assert.strictEqual((0, struct_codec_1.structByteSize)(def), 7);
    });
    test('array field multiplies by count', () => {
        const def = { id: 'x', name: 'S', fields: [
                { name: 'v', type: 'uint32', count: 4, endian: 'inherit' }, // 4 × 4 = 16
            ] };
        assert.strictEqual((0, struct_codec_1.structByteSize)(def), 16);
    });
});
// ── decodeField ───────────────────────────────────────────────────
suite('decodeField()', () => {
    test('uint8 0x42 returns "66  (0x42)"', () => {
        const r = (0, struct_codec_1.decodeField)([0x42], 'uint8', 'le');
        assert.ok(r.startsWith('66'), `got: ${r}`);
        assert.ok(r.includes('0x42'), `got: ${r}`);
    });
    test('uint16 LE 0x0102 → 258', () => {
        const r = (0, struct_codec_1.decodeField)([0x02, 0x01], 'uint16', 'le');
        assert.ok(r.startsWith('258'), `got: ${r}`);
    });
    test('uint16 BE 0x0102 → 258', () => {
        const r = (0, struct_codec_1.decodeField)([0x01, 0x02], 'uint16', 'be');
        assert.ok(r.startsWith('258'), `got: ${r}`);
    });
    test('uint32 LE 0x00000001 → 1', () => {
        const r = (0, struct_codec_1.decodeField)([0x01, 0x00, 0x00, 0x00], 'uint32', 'le');
        assert.ok(r.startsWith('1'), `got: ${r}`);
    });
    test('uint32 LE 0x08000000 shows correct hex in output', () => {
        const r = (0, struct_codec_1.decodeField)([0x00, 0x00, 0x00, 0x08], 'uint32', 'le');
        assert.ok(r.includes('08000000'), `got: ${r}`);
    });
    test('int8 0xFF → -1', () => {
        assert.strictEqual((0, struct_codec_1.decodeField)([0xFF], 'int8', 'le'), '-1');
    });
    test('int16 LE 0xFFFF → -1', () => {
        assert.strictEqual((0, struct_codec_1.decodeField)([0xFF, 0xFF], 'int16', 'le'), '-1');
    });
    test('int32 LE 0xFFFFFFFF → -1', () => {
        assert.strictEqual((0, struct_codec_1.decodeField)([0xFF, 0xFF, 0xFF, 0xFF], 'int32', 'le'), '-1');
    });
    test('float32 LE 1.0 (0x3F800000)', () => {
        // 1.0f LE bytes: 00 00 80 3F
        const r = (0, struct_codec_1.decodeField)([0x00, 0x00, 0x80, 0x3F], 'float32', 'le');
        assert.strictEqual(r, '1');
    });
    test('float64 LE 1.0', () => {
        // 1.0 double LE bytes: 00 00 00 00 00 00 F0 3F
        const r = (0, struct_codec_1.decodeField)([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0x3F], 'float64', 'le');
        assert.strictEqual(r, '1');
    });
    test('returns "??" when a byte is missing (value -1)', () => {
        assert.strictEqual((0, struct_codec_1.decodeField)([-1], 'uint8', 'le'), '??');
    });
    test('returns "??" for partial uint32 (only 2 bytes provided)', () => {
        assert.strictEqual((0, struct_codec_1.decodeField)([0x01, 0x02], 'uint32', 'le'), '??');
    });
});
// ── decodeStruct ──────────────────────────────────────────────────
suite('decodeStruct()', () => {
    setup(() => resetStructState());
    test('produces one row per scalar field', () => {
        const def = { id: 'x', name: 'S', fields: [
                { name: 'a', type: 'uint8', count: 1, endian: 'inherit' },
                { name: 'b', type: 'uint16', count: 1, endian: 'inherit' },
            ] };
        // populate flatBytes at base 0x100
        state_1.S.flatBytes.set(0x100, 0x01);
        state_1.S.flatBytes.set(0x101, 0x02);
        state_1.S.flatBytes.set(0x102, 0x03);
        const rows = (0, struct_codec_1.decodeStruct)(def, 0x100, state_1.S.flatBytes, 'le');
        assert.strictEqual(rows.length, 2);
        assert.strictEqual(rows[0].fieldName, 'a');
        assert.strictEqual(rows[0].byteOffset, 0);
        assert.strictEqual(rows[1].fieldName, 'b');
        assert.strictEqual(rows[1].byteOffset, 1);
    });
    test('array field expands to count rows named field[0], field[1]...', () => {
        const def = { id: 'x', name: 'S', fields: [
                { name: 'v', type: 'uint8', count: 3, endian: 'inherit' },
            ] };
        [0x0A, 0x0B, 0x0C].forEach((v, i) => state_1.S.flatBytes.set(i, v));
        const rows = (0, struct_codec_1.decodeStruct)(def, 0, state_1.S.flatBytes, 'le');
        assert.strictEqual(rows.length, 3);
        assert.strictEqual(rows[0].fieldName, 'v[0]');
        assert.strictEqual(rows[1].fieldName, 'v[1]');
        assert.strictEqual(rows[2].fieldName, 'v[2]');
    });
    test('hasData is false when byte is absent from flatBytes', () => {
        const def = { id: 'x', name: 'S', fields: [
                { name: 'a', type: 'uint8', count: 1, endian: 'inherit' },
            ] };
        // Do NOT populate S.flatBytes
        const rows = (0, struct_codec_1.decodeStruct)(def, 0x200, state_1.S.flatBytes, 'le');
        assert.strictEqual(rows[0].hasData, false);
        assert.strictEqual(rows[0].decoded, '??');
    });
    test('field-level endian "le" overrides global "be"', () => {
        const def = { id: 'x', name: 'S', fields: [
                { name: 'a', type: 'uint16', count: 1, endian: 'le' },
            ] };
        state_1.S.flatBytes.set(0, 0x01);
        state_1.S.flatBytes.set(1, 0x00);
        // LE: 0x0001 = 1, even though global endian is BE
        const rows = (0, struct_codec_1.decodeStruct)(def, 0, state_1.S.flatBytes, 'be');
        assert.ok(rows[0].decoded.startsWith('1'), rows[0].decoded);
    });
    test('field-level endian "be" overrides global "le"', () => {
        const def = { id: 'x', name: 'S', fields: [
                { name: 'a', type: 'uint16', count: 1, endian: 'be' },
            ] };
        state_1.S.flatBytes.set(0, 0x00);
        state_1.S.flatBytes.set(1, 0x01);
        // BE read of 00 01 = 1
        const rows = (0, struct_codec_1.decodeStruct)(def, 0, state_1.S.flatBytes, 'le');
        assert.ok(rows[0].decoded.startsWith('1'), rows[0].decoded);
    });
    test('byte offsets accumulate correctly across mixed-width fields', () => {
        const def = { id: 'x', name: 'S', fields: [
                { name: 'a', type: 'uint8', count: 1, endian: 'inherit' }, // +0, 1 B
                { name: 'b', type: 'uint32', count: 1, endian: 'inherit' }, // +1, 4 B
                { name: 'c', type: 'uint16', count: 1, endian: 'inherit' }, // +5, 2 B
            ] };
        const rows = (0, struct_codec_1.decodeStruct)(def, 0, new Map(), 'le');
        assert.strictEqual(rows[0].byteOffset, 0);
        assert.strictEqual(rows[1].byteOffset, 1);
        assert.strictEqual(rows[2].byteOffset, 5);
    });
    test('bytesHex shows ?? for missing bytes', () => {
        const def = { id: 'x', name: 'S', fields: [
                { name: 'a', type: 'uint16', count: 1, endian: 'inherit' },
            ] };
        state_1.S.flatBytes.set(0, 0xAB); // only first byte present
        const rows = (0, struct_codec_1.decodeStruct)(def, 0, state_1.S.flatBytes, 'le');
        assert.ok(rows[0].bytesHex.includes('??'), rows[0].bytesHex);
    });
});
// ── allStructs ────────────────────────────────────────────────────
suite('allStructs()', () => {
    setup(() => resetStructState());
    test('returns presets when no user structs', () => {
        const all = (0, struct_codec_1.allStructs)();
        assert.strictEqual(all.length, struct_codec_1.STRUCT_PRESETS.length);
    });
    test('user struct appended after presets', () => {
        const custom = { id: 'u1', name: 'Custom', fields: [] };
        state_1.S.structs = [custom];
        const all = (0, struct_codec_1.allStructs)();
        assert.strictEqual(all.length, struct_codec_1.STRUCT_PRESETS.length + 1);
        assert.strictEqual(all[all.length - 1].id, 'u1');
    });
    test('preset ids start with __preset_', () => {
        for (const p of struct_codec_1.STRUCT_PRESETS) {
            assert.ok(p.id.startsWith('__preset_'), `${p.id} does not start with __preset_`);
        }
    });
});
// ── STRUCT_PRESETS sanity ─────────────────────────────────────────
suite('STRUCT_PRESETS', () => {
    test('ARM Cortex-M Vector Table has 16 fields', () => {
        const cm = struct_codec_1.STRUCT_PRESETS.find(p => p.id === '__preset_cm_vtable');
        assert.ok(cm, 'preset not found');
        assert.strictEqual(cm.fields.length, 16);
    });
    test('ARM Cortex-M Vector Table is 64 bytes total', () => {
        const cm = struct_codec_1.STRUCT_PRESETS.find(p => p.id === '__preset_cm_vtable');
        assert.strictEqual((0, struct_codec_1.structByteSize)(cm), 64);
    });
    test('STM32 GPIO Port preset has 7 fields', () => {
        const gp = struct_codec_1.STRUCT_PRESETS.find(p => p.id === '__preset_stm32_gpio');
        assert.ok(gp, 'preset not found');
        assert.strictEqual(gp.fields.length, 7);
    });
    test('STM32 GPIO Port preset is 28 bytes', () => {
        const gp = struct_codec_1.STRUCT_PRESETS.find(p => p.id === '__preset_stm32_gpio');
        assert.strictEqual((0, struct_codec_1.structByteSize)(gp), 28);
    });
    test('all preset fields have a non-empty name', () => {
        for (const p of struct_codec_1.STRUCT_PRESETS) {
            for (const f of p.fields) {
                assert.ok(f.name.trim().length > 0, `empty name in ${p.name}`);
            }
        }
    });
    test('all preset field counts are >= 1', () => {
        for (const p of struct_codec_1.STRUCT_PRESETS) {
            for (const f of p.fields) {
                assert.ok(f.count >= 1, `count < 1 in ${p.name}.${f.name}`);
            }
        }
    });
});
// ── parseStructText() ─────────────────────────────────────────────
suite('parseStructText()', () => {
    test('parses uint32_t scalar field', () => {
        const { fields, errors } = (0, struct_codec_1.parseStructText)('uint32_t handler;');
        assert.deepStrictEqual(fields, [{ name: 'handler', type: 'uint32', count: 1, endian: 'inherit' }]);
        assert.strictEqual(errors.length, 0);
    });
    test('parses uint8_t array field', () => {
        const { fields, errors } = (0, struct_codec_1.parseStructText)('uint8_t data[16];');
        assert.deepStrictEqual(fields, [{ name: 'data', type: 'uint8', count: 16, endian: 'inherit' }]);
        assert.strictEqual(errors.length, 0);
    });
    test('float maps to float32', () => {
        const { fields } = (0, struct_codec_1.parseStructText)('float temp;');
        assert.strictEqual(fields[0].type, 'float32');
    });
    test('double maps to float64', () => {
        const { fields } = (0, struct_codec_1.parseStructText)('double val;');
        assert.strictEqual(fields[0].type, 'float64');
    });
    test('unsigned char maps to uint8', () => {
        const { fields } = (0, struct_codec_1.parseStructText)('unsigned char flag;');
        assert.strictEqual(fields[0].type, 'uint8');
    });
    test('unsigned int maps to uint32', () => {
        const { fields } = (0, struct_codec_1.parseStructText)('unsigned int count;');
        assert.strictEqual(fields[0].type, 'uint32');
    });
    test('int maps to int32', () => {
        const { fields } = (0, struct_codec_1.parseStructText)('int value;');
        assert.strictEqual(fields[0].type, 'int32');
    });
    test('short maps to int16', () => {
        const { fields } = (0, struct_codec_1.parseStructText)('short val;');
        assert.strictEqual(fields[0].type, 'int16');
    });
    test('const qualifier is stripped', () => {
        const { fields, errors } = (0, struct_codec_1.parseStructText)('const uint32_t REG;');
        assert.strictEqual(errors.length, 0);
        assert.strictEqual(fields[0].type, 'uint32');
    });
    test('volatile qualifier is stripped', () => {
        const { fields, errors } = (0, struct_codec_1.parseStructText)('volatile uint32_t REG;');
        assert.strictEqual(errors.length, 0);
        assert.strictEqual(fields[0].type, 'uint32');
    });
    test('endian hint /* be */ sets endian to be', () => {
        const { fields } = (0, struct_codec_1.parseStructText)('uint32_t reg; /* be */');
        assert.strictEqual(fields[0].endian, 'be');
    });
    test('endian hint // le sets endian to le', () => {
        const { fields } = (0, struct_codec_1.parseStructText)('uint32_t reg; // le');
        assert.strictEqual(fields[0].endian, 'le');
    });
    test('endian hint // be sets endian to be', () => {
        const { fields } = (0, struct_codec_1.parseStructText)('uint32_t reg; // be');
        assert.strictEqual(fields[0].endian, 'be');
    });
    test('inherit endian when no hint present', () => {
        const { fields } = (0, struct_codec_1.parseStructText)('uint32_t reg;');
        assert.strictEqual(fields[0].endian, 'inherit');
    });
    test('extracts structName from struct wrapper', () => {
        const { structName, fields } = (0, struct_codec_1.parseStructText)('struct GPIO_t {\n  uint32_t MODER;\n}');
        assert.strictEqual(structName, 'GPIO_t');
        assert.strictEqual(fields.length, 1);
    });
    test('extracts body from typedef struct', () => {
        const { fields, errors } = (0, struct_codec_1.parseStructText)('typedef struct S {\n  uint8_t a;\n  uint16_t b;\n} S_t;');
        assert.strictEqual(errors.length, 0);
        assert.strictEqual(fields.length, 2);
    });
    test('reports error for unknown type', () => {
        const { fields, errors } = (0, struct_codec_1.parseStructText)('foo bar;');
        assert.ok(errors.length > 0);
        assert.strictEqual(fields.length, 0);
    });
    test('ignores line comments and blank lines', () => {
        const { fields } = (0, struct_codec_1.parseStructText)('// header\n\nuint32_t a;\n// done');
        assert.strictEqual(fields.length, 1);
    });
    test('parses multiple fields', () => {
        const { fields, errors } = (0, struct_codec_1.parseStructText)('uint32_t a;\nuint16_t b;\nuint8_t c;');
        assert.strictEqual(fields.length, 3);
        assert.strictEqual(errors.length, 0);
    });
    test('structName is null when no struct wrapper', () => {
        const { structName } = (0, struct_codec_1.parseStructText)('uint32_t x;');
        assert.strictEqual(structName, null);
    });
    test('field without semicolon is still parsed', () => {
        const { fields } = (0, struct_codec_1.parseStructText)('uint32_t x');
        assert.strictEqual(fields[0].name, 'x');
    });
});
// ── fieldsToText() ────────────────────────────────────────────────
suite('fieldsToText()', () => {
    test('empty fields produces empty string', () => {
        assert.strictEqual((0, struct_codec_1.fieldsToText)([]), '');
    });
    test('uint32_t field emits uint32_t keyword', () => {
        const f = [{ name: 'handler', type: 'uint32', count: 1, endian: 'inherit' }];
        assert.ok((0, struct_codec_1.fieldsToText)(f).includes('uint32_t'));
        assert.ok((0, struct_codec_1.fieldsToText)(f).includes('handler;'));
    });
    test('array field has [N] suffix', () => {
        const f = [{ name: 'data', type: 'uint8', count: 8, endian: 'inherit' }];
        assert.ok((0, struct_codec_1.fieldsToText)(f).includes('[8]'));
    });
    test('be endian adds // be comment', () => {
        const f = [{ name: 'reg', type: 'uint32', count: 1, endian: 'be' }];
        assert.ok((0, struct_codec_1.fieldsToText)(f).includes('// be'));
    });
    test('le endian adds // le comment', () => {
        const f = [{ name: 'reg', type: 'uint16', count: 1, endian: 'le' }];
        assert.ok((0, struct_codec_1.fieldsToText)(f).includes('// le'));
    });
    test('inherit endian emits no comment', () => {
        const f = [{ name: 'reg', type: 'uint32', count: 1, endian: 'inherit' }];
        assert.ok(!(0, struct_codec_1.fieldsToText)(f).includes('/*'));
    });
    test('float32 maps to float keyword', () => {
        const f = [{ name: 'temp', type: 'float32', count: 1, endian: 'inherit' }];
        assert.ok((0, struct_codec_1.fieldsToText)(f).startsWith('float '));
    });
    test('float64 maps to double keyword', () => {
        const f = [{ name: 'val', type: 'float64', count: 1, endian: 'inherit' }];
        assert.ok((0, struct_codec_1.fieldsToText)(f).startsWith('double '));
    });
});
// ── parseStructText() round-trip ─────────────────────────────────
suite('parseStructText() round-trip', () => {
    test('fields → text → parse produces identical fields', () => {
        const original = [
            { name: 'sp', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'data', type: 'uint8', count: 16, endian: 'inherit' },
            { name: 'temp', type: 'float32', count: 1, endian: 'be' },
            { name: 'val', type: 'int16', count: 2, endian: 'le' },
        ];
        const text = (0, struct_codec_1.fieldsToText)(original);
        const { fields, errors } = (0, struct_codec_1.parseStructText)(text);
        assert.strictEqual(errors.length, 0, `Unexpected errors: ${errors.join(', ')}`);
        assert.strictEqual(fields.length, original.length);
        for (let i = 0; i < original.length; i++) {
            assert.strictEqual(fields[i].name, original[i].name, `name mismatch at ${i}`);
            assert.strictEqual(fields[i].type, original[i].type, `type mismatch at ${i}`);
            assert.strictEqual(fields[i].count, original[i].count, `count mismatch at ${i}`);
            assert.strictEqual(fields[i].endian, original[i].endian, `endian mismatch at ${i}`);
        }
    });
});
//# sourceMappingURL=struct.test.js.map