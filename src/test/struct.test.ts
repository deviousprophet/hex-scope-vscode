import * as assert from 'assert';

import {
    fieldByteSize, structByteSize, decodeField, decodeStruct,
    allStructs, STRUCT_PRESETS,
} from '../webview/struct-codec';
import { S } from '../webview/state';
import type { StructDef, StructField } from '../webview/types';

function resetStructState(): void {
    S.structs           = [];
    S.activeStructId    = null;
    S.activeStructAddr  = null;
    S.flatBytes.clear();
    S.sortedAddrs       = [];
}

// ── fieldByteSize ─────────────────────────────────────────────────

suite('fieldByteSize()', () => {
    test('uint8  → 1', () => assert.strictEqual(fieldByteSize('uint8'),   1));
    test('int8   → 1', () => assert.strictEqual(fieldByteSize('int8'),    1));
    test('uint16 → 2', () => assert.strictEqual(fieldByteSize('uint16'),  2));
    test('int16  → 2', () => assert.strictEqual(fieldByteSize('int16'),   2));
    test('uint32 → 4', () => assert.strictEqual(fieldByteSize('uint32'),  4));
    test('int32  → 4', () => assert.strictEqual(fieldByteSize('int32'),   4));
    test('float32→ 4', () => assert.strictEqual(fieldByteSize('float32'), 4));
    test('float64→ 8', () => assert.strictEqual(fieldByteSize('float64'), 8));
});

// ── structByteSize ────────────────────────────────────────────────

suite('structByteSize()', () => {
    test('empty struct is 0 bytes', () => {
        const def: StructDef = { id: 'x', name: 'Empty', fields: [] };
        assert.strictEqual(structByteSize(def), 0);
    });

    test('single uint32 field is 4 bytes', () => {
        const def: StructDef = { id: 'x', name: 'S', fields: [
            { name: 'a', type: 'uint32', count: 1, endian: 'inherit' },
        ]};
        assert.strictEqual(structByteSize(def), 4);
    });

    test('mixed field types sum correctly', () => {
        const def: StructDef = { id: 'x', name: 'S', fields: [
            { name: 'a', type: 'uint8',  count: 1, endian: 'inherit' },  // 1
            { name: 'b', type: 'uint16', count: 1, endian: 'inherit' },  // 2
            { name: 'c', type: 'uint32', count: 1, endian: 'inherit' },  // 4
        ]};
        assert.strictEqual(structByteSize(def), 7);
    });

    test('array field multiplies by count', () => {
        const def: StructDef = { id: 'x', name: 'S', fields: [
            { name: 'v', type: 'uint32', count: 4, endian: 'inherit' },  // 4 × 4 = 16
        ]};
        assert.strictEqual(structByteSize(def), 16);
    });
});

// ── decodeField ───────────────────────────────────────────────────

suite('decodeField()', () => {

    test('uint8 0x42 returns "66  (0x42)"', () => {
        const r = decodeField([0x42], 'uint8', 'le');
        assert.ok(r.startsWith('66'), `got: ${r}`);
        assert.ok(r.includes('0x42'), `got: ${r}`);
    });

    test('uint16 LE 0x0102 → 258', () => {
        const r = decodeField([0x02, 0x01], 'uint16', 'le');
        assert.ok(r.startsWith('258'), `got: ${r}`);
    });

    test('uint16 BE 0x0102 → 258', () => {
        const r = decodeField([0x01, 0x02], 'uint16', 'be');
        assert.ok(r.startsWith('258'), `got: ${r}`);
    });

    test('uint32 LE 0x00000001 → 1', () => {
        const r = decodeField([0x01, 0x00, 0x00, 0x00], 'uint32', 'le');
        assert.ok(r.startsWith('1'), `got: ${r}`);
    });

    test('uint32 LE 0x08000000 shows correct hex in output', () => {
        const r = decodeField([0x00, 0x00, 0x00, 0x08], 'uint32', 'le');
        assert.ok(r.includes('08000000'), `got: ${r}`);
    });

    test('int8 0xFF → -1', () => {
        assert.strictEqual(decodeField([0xFF], 'int8', 'le'), '-1');
    });

    test('int16 LE 0xFFFF → -1', () => {
        assert.strictEqual(decodeField([0xFF, 0xFF], 'int16', 'le'), '-1');
    });

    test('int32 LE 0xFFFFFFFF → -1', () => {
        assert.strictEqual(decodeField([0xFF, 0xFF, 0xFF, 0xFF], 'int32', 'le'), '-1');
    });

    test('float32 LE 1.0 (0x3F800000)', () => {
        // 1.0f LE bytes: 00 00 80 3F
        const r = decodeField([0x00, 0x00, 0x80, 0x3F], 'float32', 'le');
        assert.strictEqual(r, '1');
    });

    test('float64 LE 1.0', () => {
        // 1.0 double LE bytes: 00 00 00 00 00 00 F0 3F
        const r = decodeField([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0x3F], 'float64', 'le');
        assert.strictEqual(r, '1');
    });

    test('returns "??" when a byte is missing (value -1)', () => {
        assert.strictEqual(decodeField([-1], 'uint8', 'le'), '??');
    });

    test('returns "??" for partial uint32 (only 2 bytes provided)', () => {
        assert.strictEqual(decodeField([0x01, 0x02], 'uint32', 'le'), '??');
    });
});

// ── decodeStruct ──────────────────────────────────────────────────

suite('decodeStruct()', () => {
    setup(() => resetStructState());

    test('produces one row per scalar field', () => {
        const def: StructDef = { id: 'x', name: 'S', fields: [
            { name: 'a', type: 'uint8',  count: 1, endian: 'inherit' },
            { name: 'b', type: 'uint16', count: 1, endian: 'inherit' },
        ]};
        // populate flatBytes at base 0x100
        S.flatBytes.set(0x100, 0x01);
        S.flatBytes.set(0x101, 0x02);
        S.flatBytes.set(0x102, 0x03);

        const rows = decodeStruct(def, 0x100, S.flatBytes, 'le');
        assert.strictEqual(rows.length, 2);
        assert.strictEqual(rows[0].fieldName, 'a');
        assert.strictEqual(rows[0].byteOffset, 0);
        assert.strictEqual(rows[1].fieldName, 'b');
        assert.strictEqual(rows[1].byteOffset, 1);
    });

    test('array field expands to count rows named field[0], field[1]...', () => {
        const def: StructDef = { id: 'x', name: 'S', fields: [
            { name: 'v', type: 'uint8', count: 3, endian: 'inherit' },
        ]};
        [0x0A, 0x0B, 0x0C].forEach((v, i) => S.flatBytes.set(i, v));

        const rows = decodeStruct(def, 0, S.flatBytes, 'le');
        assert.strictEqual(rows.length, 3);
        assert.strictEqual(rows[0].fieldName, 'v[0]');
        assert.strictEqual(rows[1].fieldName, 'v[1]');
        assert.strictEqual(rows[2].fieldName, 'v[2]');
    });

    test('hasData is false when byte is absent from flatBytes', () => {
        const def: StructDef = { id: 'x', name: 'S', fields: [
            { name: 'a', type: 'uint8', count: 1, endian: 'inherit' },
        ]};
        // Do NOT populate S.flatBytes
        const rows = decodeStruct(def, 0x200, S.flatBytes, 'le');
        assert.strictEqual(rows[0].hasData, false);
        assert.strictEqual(rows[0].decoded, '??');
    });

    test('field-level endian "le" overrides global "be"', () => {
        const def: StructDef = { id: 'x', name: 'S', fields: [
            { name: 'a', type: 'uint16', count: 1, endian: 'le' },
        ]};
        S.flatBytes.set(0, 0x01); S.flatBytes.set(1, 0x00);
        // LE: 0x0001 = 1, even though global endian is BE
        const rows = decodeStruct(def, 0, S.flatBytes, 'be');
        assert.ok(rows[0].decoded.startsWith('1'), rows[0].decoded);
    });

    test('field-level endian "be" overrides global "le"', () => {
        const def: StructDef = { id: 'x', name: 'S', fields: [
            { name: 'a', type: 'uint16', count: 1, endian: 'be' },
        ]};
        S.flatBytes.set(0, 0x00); S.flatBytes.set(1, 0x01);
        // BE read of 00 01 = 1
        const rows = decodeStruct(def, 0, S.flatBytes, 'le');
        assert.ok(rows[0].decoded.startsWith('1'), rows[0].decoded);
    });

    test('byte offsets accumulate correctly across mixed-width fields', () => {
        const def: StructDef = { id: 'x', name: 'S', fields: [
            { name: 'a', type: 'uint8',  count: 1, endian: 'inherit' },  // +0, 1 B
            { name: 'b', type: 'uint32', count: 1, endian: 'inherit' },  // +1, 4 B
            { name: 'c', type: 'uint16', count: 1, endian: 'inherit' },  // +5, 2 B
        ]};
        const rows = decodeStruct(def, 0, new Map(), 'le');
        assert.strictEqual(rows[0].byteOffset, 0);
        assert.strictEqual(rows[1].byteOffset, 1);
        assert.strictEqual(rows[2].byteOffset, 5);
    });

    test('bytesHex shows ?? for missing bytes', () => {
        const def: StructDef = { id: 'x', name: 'S', fields: [
            { name: 'a', type: 'uint16', count: 1, endian: 'inherit' },
        ]};
        S.flatBytes.set(0, 0xAB); // only first byte present
        const rows = decodeStruct(def, 0, S.flatBytes, 'le');
        assert.ok(rows[0].bytesHex.includes('??'), rows[0].bytesHex);
    });
});

// ── allStructs ────────────────────────────────────────────────────

suite('allStructs()', () => {
    setup(() => resetStructState());

    test('returns presets when no user structs', () => {
        const all = allStructs();
        assert.strictEqual(all.length, STRUCT_PRESETS.length);
    });

    test('user struct appended after presets', () => {
        const custom: StructDef = { id: 'u1', name: 'Custom', fields: [] };
        S.structs = [custom];
        const all = allStructs();
        assert.strictEqual(all.length, STRUCT_PRESETS.length + 1);
        assert.strictEqual(all[all.length - 1].id, 'u1');
    });

    test('preset ids start with __preset_', () => {
        for (const p of STRUCT_PRESETS) {
            assert.ok(p.id.startsWith('__preset_'), `${p.id} does not start with __preset_`);
        }
    });
});

// ── STRUCT_PRESETS sanity ─────────────────────────────────────────

suite('STRUCT_PRESETS', () => {
    test('ARM Cortex-M Vector Table has 16 fields', () => {
        const cm = STRUCT_PRESETS.find(p => p.id === '__preset_cm_vtable')!;
        assert.ok(cm, 'preset not found');
        assert.strictEqual(cm.fields.length, 16);
    });

    test('ARM Cortex-M Vector Table is 64 bytes total', () => {
        const cm = STRUCT_PRESETS.find(p => p.id === '__preset_cm_vtable')!;
        assert.strictEqual(structByteSize(cm), 64);
    });

    test('STM32 GPIO Port preset has 7 fields', () => {
        const gp = STRUCT_PRESETS.find(p => p.id === '__preset_stm32_gpio')!;
        assert.ok(gp, 'preset not found');
        assert.strictEqual(gp.fields.length, 7);
    });

    test('STM32 GPIO Port preset is 28 bytes', () => {
        const gp = STRUCT_PRESETS.find(p => p.id === '__preset_stm32_gpio')!;
        assert.strictEqual(structByteSize(gp), 28);
    });

    test('all preset fields have a non-empty name', () => {
        for (const p of STRUCT_PRESETS) {
            for (const f of p.fields) {
                assert.ok(f.name.trim().length > 0, `empty name in ${p.name}`);
            }
        }
    });

    test('all preset field counts are >= 1', () => {
        for (const p of STRUCT_PRESETS) {
            for (const f of p.fields) {
                assert.ok(f.count >= 1, `count < 1 in ${p.name}.${f.name}`);
            }
        }
    });
});
