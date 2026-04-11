"use strict";
// ── Struct Overlay — pure codec (no DOM / VS Code API dependencies) ──
// Contains field size helpers, decode logic, presets, and allStructs().
// Importable from both the webview runtime and the test runner.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPE_TO_C = exports.STRUCT_PRESETS = exports.FIELD_TYPES = void 0;
exports.fieldByteSize = fieldByteSize;
exports.structByteSize = structByteSize;
exports.decodeField = decodeField;
exports.decodeStruct = decodeStruct;
exports.allStructs = allStructs;
exports.parseStructText = parseStructText;
exports.fieldsToText = fieldsToText;
const state_1 = require("./state");
// ── Constants ─────────────────────────────────────────────────────
exports.FIELD_TYPES = [
    'uint8', 'uint16', 'uint32',
    'int8', 'int16', 'int32',
    'float32', 'float64',
];
function fieldByteSize(type) {
    switch (type) {
        case 'uint8':
        case 'int8': return 1;
        case 'uint16':
        case 'int16': return 2;
        case 'uint32':
        case 'int32':
        case 'float32': return 4;
        case 'float64': return 8;
    }
}
function structByteSize(def) {
    return def.fields.reduce((s, f) => s + fieldByteSize(f.type) * f.count, 0);
}
// ── Built-in Presets ──────────────────────────────────────────────
exports.STRUCT_PRESETS = [
    {
        id: '__preset_cm_vtable',
        name: 'ARM Cortex-M Vector Table',
        fields: [
            { name: 'Initial SP', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'Reset_Handler', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'NMI_Handler', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'HardFault_Handler', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'MemManage_Handler', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'BusFault_Handler', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'UsageFault_Handler', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'Reserved[0]', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'Reserved[1]', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'Reserved[2]', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'Reserved[3]', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'SVC_Handler', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'DebugMon_Handler', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'Reserved[4]', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'PendSV_Handler', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'SysTick_Handler', type: 'uint32', count: 1, endian: 'inherit' },
        ],
    },
    {
        id: '__preset_stm32_gpio',
        name: 'STM32 GPIO Port',
        fields: [
            { name: 'CRL  (Config Low)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'CRH  (Config High)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'IDR  (Input Data)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'ODR  (Output Data)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'BSRR (Bit Set/Reset)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'BRR  (Bit Reset)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'LCKR (Lock)', type: 'uint32', count: 1, endian: 'inherit' },
        ],
    },
    {
        id: '__preset_stm32_rcc',
        name: 'STM32 RCC Registers',
        fields: [
            { name: 'CR       (Clock Ctrl)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'CFGR     (Clock Cfg)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'CIR      (Clock Intr)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'APB2RSTR (APB2 Reset)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'APB1RSTR (APB1 Reset)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'AHBENR   (AHB Enable)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'APB2ENR  (APB2 Enable)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'APB1ENR  (APB1 Enable)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'BDCR     (Backup Dom)', type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'CSR      (Ctrl/Status)', type: 'uint32', count: 1, endian: 'inherit' },
        ],
    },
];
function decodeField(bytes, // exactly fieldByteSize(type) bytes; value < 0 means missing
type, endian) {
    const size = fieldByteSize(type);
    if (bytes.length < size || bytes.some(b => b < 0)) {
        return '??';
    }
    const buf = new ArrayBuffer(size);
    const dv = new DataView(buf);
    const le = endian === 'le';
    bytes.slice(0, size).forEach((b, i) => dv.setUint8(i, b));
    switch (type) {
        case 'uint8': return `${dv.getUint8(0)}  (0x${dv.getUint8(0).toString(16).toUpperCase().padStart(2, '0')})`;
        case 'int8': return `${dv.getInt8(0)}`;
        case 'uint16': {
            const v = dv.getUint16(0, le);
            return `${v}  (0x${v.toString(16).toUpperCase().padStart(4, '0')})`;
        }
        case 'int16': return `${dv.getInt16(0, le)}`;
        case 'uint32': {
            const v = dv.getUint32(0, le);
            return `${v >>> 0}  (0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')})`;
        }
        case 'int32': return `${dv.getInt32(0, le)}`;
        case 'float32': {
            const v = dv.getFloat32(0, le);
            return isNaN(v) ? 'NaN' : !isFinite(v) ? String(v) : parseFloat(v.toPrecision(7)).toString();
        }
        case 'float64': {
            const v = dv.getFloat64(0, le);
            return isNaN(v) ? 'NaN' : !isFinite(v) ? String(v) : parseFloat(v.toPrecision(10)).toString();
        }
    }
}
function decodeStruct(def, baseAddr, flatBytes, globalEndian) {
    const rows = [];
    let offset = 0;
    for (const field of def.fields) {
        const sz = fieldByteSize(field.type);
        const endian = field.endian === 'inherit' ? globalEndian : field.endian;
        for (let idx = 0; idx < field.count; idx++) {
            const raw = [];
            for (let b = 0; b < sz; b++) {
                const v = flatBytes.get(baseAddr + offset + b);
                raw.push(v !== undefined ? v : -1);
            }
            const hasData = raw.every(v => v >= 0);
            const bytesHex = raw.map(v => v >= 0 ? v.toString(16).toUpperCase().padStart(2, '0') : '??').join(' ');
            const decoded = hasData ? decodeField(raw, field.type, endian) : '??';
            const name = field.count > 1 ? `${field.name}[${idx}]` : field.name;
            rows.push({ fieldName: name, type: field.type, arrayIdx: idx, byteOffset: offset, bytesHex, decoded, hasData });
            offset += sz;
        }
    }
    return rows;
}
// ── All visible structs (presets + user-defined) ──────────────────
function allStructs() {
    return [...exports.STRUCT_PRESETS, ...state_1.S.structs];
}
// ── C struct text parser ──────────────────────────────────────────
/**
 * Maps common C type names (including aliases) to our internal StructFieldType.
 * Lookup is case-sensitive first, then case-folded as fallback.
 */
const C_TYPE_MAP = {
    // uint8
    'uint8_t': 'uint8', 'uint8': 'uint8', 'u8': 'uint8',
    'unsigned char': 'uint8', 'byte': 'uint8', 'BYTE': 'uint8',
    // uint16
    'uint16_t': 'uint16', 'uint16': 'uint16', 'u16': 'uint16',
    'unsigned short': 'uint16', 'WORD': 'uint16', 'word': 'uint16',
    // uint32
    'uint32_t': 'uint32', 'uint32': 'uint32', 'u32': 'uint32',
    'unsigned int': 'uint32', 'unsigned long': 'uint32',
    'DWORD': 'uint32', 'dword': 'uint32',
    // int8
    'int8_t': 'int8', 'int8': 'int8', 'i8': 'int8',
    'signed char': 'int8', 'char': 'int8',
    // int16
    'int16_t': 'int16', 'int16': 'int16', 'i16': 'int16',
    'short': 'int16', 'signed short': 'int16',
    // int32
    'int32_t': 'int32', 'int32': 'int32', 'i32': 'int32',
    'int': 'int32', 'long': 'int32', 'signed int': 'int32',
    // float32
    'float': 'float32', 'float32': 'float32',
    // float64
    'double': 'float64', 'float64': 'float64',
};
/** Maps our internal types back to canonical C type names for serialization. */
exports.TYPE_TO_C = {
    uint8: 'uint8_t', uint16: 'uint16_t', uint32: 'uint32_t',
    int8: 'int8_t', int16: 'int16_t', int32: 'int32_t',
    float32: 'float', float64: 'double',
};
/**
 * Parse C-style struct field declarations into StructField[].
 * Accepts bare field declarations OR a full `struct Name { ... }` / `typedef struct Name { ... }`
 * definition pasted directly from a header file.
 *
 * Supported types: uint8_t, uint16_t, uint32_t, int8_t, int16_t, int32_t, float, double,
 * unsigned/signed variants, _t-less aliases, Arduino/CMSIS BYTE/WORD/DWORD.
 * Endian override: add `// be` or `\/* be *\/` after the declaration.
 * Qualifiers `const`, `volatile`, `static`, `register` are silently stripped.
 */
function parseStructText(text) {
    const errors = [];
    const fields = [];
    let structName = null;
    // Strip only MULTI-LINE block comments (preserving single-line `/* be */` hints)
    const cleaned = text.replace(/\/\*[\s\S]*?\*\//g, m => {
        const newlines = (m.match(/\n/g) ?? []).length;
        return newlines === 0 ? m : '\n'.repeat(newlines);
    });
    // Extract struct name from "struct Name {" / "typedef struct Name {"
    const nameMatch = cleaned.match(/(?:typedef\s+)?struct\s+(\w+)\s*\{/);
    if (nameMatch) {
        structName = nameMatch[1];
    }
    // Use body inside braces if present, otherwise treat the whole text as body
    const bodyMatch = cleaned.match(/\{([\s\S]*)\}/);
    const body = bodyMatch ? bodyMatch[1] : cleaned;
    for (const rawLine of body.split('\n')) {
        // Extract endian hint from EITHER a trailing `// hint` OR an inline `/* hint */`
        // before stripping, so both notations round-trip correctly.
        const blockComMatch = rawLine.match(/\/\*([^*\n]*)\*\//);
        const blockComment = blockComMatch ? blockComMatch[1].trim() : '';
        const noBlock = rawLine.replace(/\/\*[^*\n]*\*\//g, '');
        const slashIdx = noBlock.indexOf('//');
        const lineComment = slashIdx >= 0 ? noBlock.slice(slashIdx + 2).trim() : '';
        const line = (slashIdx >= 0 ? noBlock.slice(0, slashIdx) : noBlock).trim();
        const comment = lineComment || blockComment;
        // Strip trailing semicolon; skip structural / empty lines
        const stripped = line.replace(/;$/, '').trim();
        if (!stripped || stripped === '{' || stripped === '}'
            || /^(?:typedef|struct|union)\b/.test(stripped)) {
            continue;
        }
        // Strip leading type qualifiers
        const unqual = stripped.replace(/^(?:(?:const|volatile|static|register)\s+)+/, '');
        // Match: TYPE FIELD_NAME [ARRAY]
        // TYPE supports two-word forms like "unsigned short" or single tokens like "uint32_t"
        const m = unqual.match(/^((?:unsigned|signed)\s+\w+|\w+)\s+(\w+)\s*(?:\[(\d+)\])?$/);
        if (!m) {
            if (unqual) {
                errors.push(`Cannot parse: "${stripped}"`);
            }
            continue;
        }
        const rawType = m[1].replace(/\s+/g, ' ');
        const fieldName = m[2];
        const count = m[3] ? Math.max(1, parseInt(m[3], 10)) : 1;
        const mapped = C_TYPE_MAP[rawType] ?? C_TYPE_MAP[rawType.toLowerCase()];
        if (!mapped) {
            errors.push(`Unknown type "${rawType}" for field "${fieldName}"`);
            continue;
        }
        // Endian override from comment: "be" / "BE" / "le" / "LE"
        let endian = 'inherit';
        if (/\bbe\b/i.test(comment)) {
            endian = 'be';
        }
        else if (/\ble\b/i.test(comment)) {
            endian = 'le';
        }
        fields.push({ name: fieldName, type: mapped, count, endian });
    }
    return { structName, fields, errors };
}
/**
 * Serialize StructField[] back to C-style field declarations.
 * Type names are padded to align field identifiers.
 * Endian overrides are emitted as `\/* be *\/` / `\/* le *\/` comments.
 */
function fieldsToText(fields) {
    if (fields.length === 0) {
        return '';
    }
    const maxTypeLen = Math.max(...fields.map(f => exports.TYPE_TO_C[f.type].length));
    return fields.map(f => {
        const cType = exports.TYPE_TO_C[f.type].padEnd(maxTypeLen);
        const arr = f.count > 1 ? `[${f.count}]` : '';
        const hint = f.endian !== 'inherit' ? `  // ${f.endian}` : '';
        return `${cType} ${f.name}${arr};${hint}`;
    }).join('\n');
}
//# sourceMappingURL=struct-codec.js.map