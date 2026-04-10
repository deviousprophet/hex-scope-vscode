// ── Struct Overlay — pure codec (no DOM / VS Code API dependencies) ──
// Contains field size helpers, decode logic, presets, and allStructs().
// Importable from both the webview runtime and the test runner.

import { S }       from './state';
import type { StructDef, StructField, StructFieldType, StructFieldEndian } from './types';

export type { StructDef, StructField, StructFieldType, StructFieldEndian };

// ── Constants ─────────────────────────────────────────────────────

export const FIELD_TYPES: StructFieldType[] = [
    'uint8', 'uint16', 'uint32',
    'int8',  'int16',  'int32',
    'float32', 'float64',
];

export function fieldByteSize(type: StructFieldType): number {
    switch (type) {
        case 'uint8':  case 'int8':    return 1;
        case 'uint16': case 'int16':   return 2;
        case 'uint32': case 'int32':
        case 'float32':                return 4;
        case 'float64':                return 8;
    }
}

export function structByteSize(def: StructDef): number {
    return def.fields.reduce((s, f) => s + fieldByteSize(f.type) * f.count, 0);
}

// ── Built-in Presets ──────────────────────────────────────────────

export const STRUCT_PRESETS: StructDef[] = [
    {
        id: '__preset_cm_vtable',
        name: 'ARM Cortex-M Vector Table',
        fields: [
            { name: 'Initial SP',           type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'Reset_Handler',         type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'NMI_Handler',           type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'HardFault_Handler',     type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'MemManage_Handler',     type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'BusFault_Handler',      type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'UsageFault_Handler',    type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'Reserved[0]',           type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'Reserved[1]',           type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'Reserved[2]',           type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'Reserved[3]',           type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'SVC_Handler',           type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'DebugMon_Handler',      type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'Reserved[4]',           type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'PendSV_Handler',        type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'SysTick_Handler',       type: 'uint32', count: 1, endian: 'inherit' },
        ],
    },
    {
        id: '__preset_stm32_gpio',
        name: 'STM32 GPIO Port',
        fields: [
            { name: 'CRL  (Config Low)',       type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'CRH  (Config High)',      type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'IDR  (Input Data)',       type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'ODR  (Output Data)',      type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'BSRR (Bit Set/Reset)',    type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'BRR  (Bit Reset)',        type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'LCKR (Lock)',             type: 'uint32', count: 1, endian: 'inherit' },
        ],
    },
    {
        id: '__preset_stm32_rcc',
        name: 'STM32 RCC Registers',
        fields: [
            { name: 'CR       (Clock Ctrl)',   type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'CFGR     (Clock Cfg)',    type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'CIR      (Clock Intr)',   type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'APB2RSTR (APB2 Reset)',   type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'APB1RSTR (APB1 Reset)',   type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'AHBENR   (AHB Enable)',   type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'APB2ENR  (APB2 Enable)',  type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'APB1ENR  (APB1 Enable)',  type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'BDCR     (Backup Dom)',   type: 'uint32', count: 1, endian: 'inherit' },
            { name: 'CSR      (Ctrl/Status)',  type: 'uint32', count: 1, endian: 'inherit' },
        ],
    },
];

// ── Decode logic ──────────────────────────────────────────────────

export interface DecodedField {
    fieldName: string;
    type: StructFieldType;
    /** Index within the array (0 for scalars). */
    arrayIdx: number;
    byteOffset: number;
    bytesHex: string;
    decoded: string;
    hasData: boolean;
}

export function decodeField(
    bytes: number[],       // exactly fieldByteSize(type) bytes; value < 0 means missing
    type: StructFieldType,
    endian: 'le' | 'be',
): string {
    const size = fieldByteSize(type);
    if (bytes.length < size || bytes.some(b => b < 0)) { return '??'; }

    const buf = new ArrayBuffer(size);
    const dv  = new DataView(buf);
    const le  = endian === 'le';
    bytes.slice(0, size).forEach((b, i) => dv.setUint8(i, b));

    switch (type) {
        case 'uint8':   return `${dv.getUint8(0)}  (0x${dv.getUint8(0).toString(16).toUpperCase().padStart(2,'0')})`;
        case 'int8':    return `${dv.getInt8(0)}`;
        case 'uint16':  { const v = dv.getUint16(0, le); return `${v}  (0x${v.toString(16).toUpperCase().padStart(4,'0')})`; }
        case 'int16':   return `${dv.getInt16(0, le)}`;
        case 'uint32':  { const v = dv.getUint32(0, le); return `${v >>> 0}  (0x${(v >>> 0).toString(16).toUpperCase().padStart(8,'0')})`; }
        case 'int32':   return `${dv.getInt32(0, le)}`;
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

export function decodeStruct(
    def: StructDef,
    baseAddr: number,
    flatBytes: Map<number, number>,
    globalEndian: 'le' | 'be',
): DecodedField[] {
    const rows: DecodedField[] = [];
    let offset = 0;
    for (const field of def.fields) {
        const sz = fieldByteSize(field.type);
        const endian = field.endian === 'inherit' ? globalEndian : field.endian;
        for (let idx = 0; idx < field.count; idx++) {
            const raw: number[] = [];
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

export function allStructs(): StructDef[] {
    return [...STRUCT_PRESETS, ...S.structs];
}
