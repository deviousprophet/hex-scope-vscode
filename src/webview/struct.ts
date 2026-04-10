// ── Struct / Type Overlay — UI layer ─────────────────────────────
// Renders the sidebar panel, decode result table, and inline editor.
// Pure codec logic lives in struct-codec.ts.

import { S }       from './state';
import { esc }     from './utils';
import { vscode }  from './api';
import { rerender } from './render';
import {
    FIELD_TYPES, STRUCT_PRESETS,
    fieldByteSize, structByteSize, decodeStruct, allStructs,
} from './struct-codec.js';
import type { StructDef, StructFieldType, StructFieldEndian, StructPin } from './types';

// Re-export codec symbols so callers can import from a single path.
export {
    FIELD_TYPES, STRUCT_PRESETS,
    fieldByteSize, structByteSize, decodeStruct, allStructs,
} from './struct-codec.js';
export type { DecodedField } from './struct-codec.js';

// ── Sidebar panel render ──────────────────────────────────────────

/** Debounce timer for live address-input decode. */
let _decodeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDecode(): void {
    if (_decodeTimer) { clearTimeout(_decodeTimer); }
    _decodeTimer = setTimeout(() => {
        const inp = document.getElementById('struct-addr-inp') as HTMLInputElement | null;
        if (inp) {
            const v = parseInt(inp.value.replace(/^0x/i, ''), 16);
            S.activeStructAddr = isNaN(v) ? null : v;
        }
        renderDecodeResult();
        _decodeTimer = null;
    }, 250);
}

export function renderStructPanel(): void {
    const sec = document.getElementById('s-struct');
    if (!sec) { return; }

    const addrVal = S.activeStructAddr !== null
        ? S.activeStructAddr.toString(16).toUpperCase().padStart(8, '0') : '';
    const all = allStructs();
    const badge = S.structs.length > 0 ? `<span class="sb-badge">${S.structs.length}</span>` : '';

    const structOpts = all.length === 0
        ? '<option value="">— No structs —</option>'
        : all.map(d => {
            const sz = structByteSize(d);
            return `<option value="${esc(d.id)}" ${S.activeStructId === d.id ? 'selected' : ''}>${esc(d.name)} (${sz} B)</option>`;
          }).join('');

    const isPreset  = S.activeStructId?.startsWith('__preset_') ?? false;
    const hasCustom = S.activeStructId !== null && !isPreset && all.some(d => d.id === S.activeStructId);

    sec.innerHTML =
        `<div class="sb-hdr">Struct Overlay ${badge}</div>` +
        `<div class="struct-controls">` +
        // Address row with 0x prefix
        `<div class="struct-row">` +
        `<span class="struct-addr-pfx">0x</span>` +
        `<input id="struct-addr-inp" class="struct-addr-inp" type="text" ` +
               `value="${esc(addrVal)}" placeholder="08000000" maxlength="8" autocomplete="off" spellcheck="false">` +
        `</div>` +
        // Struct picker row with inline manage icons
        `<div class="struct-row">` +
        `<select id="struct-sel" class="struct-sel">${structOpts}</select>` +
        (hasCustom
            ? `<button id="struct-btn-edit" class="struct-btn struct-btn-icon" title="Edit struct definition">✎</button>` +
              `<button id="struct-btn-del"  class="struct-btn struct-btn-icon struct-btn-icon-danger" title="Delete struct definition">✕</button>`
            : '') +
        `</div>` +
        // New struct always available
        `<button id="struct-btn-new" class="struct-add-field-btn">+ New Struct</button>` +
        `</div>` +
        `<div id="struct-decode-result"></div>`;

    // Wire events
    const addrInp = document.getElementById('struct-addr-inp') as HTMLInputElement;
    addrInp.addEventListener('input', () => { scheduleDecode(); });
    addrInp.addEventListener('change', () => {
        const v = parseInt(addrInp.value.replace(/^0x/i, ''), 16);
        S.activeStructAddr = isNaN(v) ? null : v;
        renderDecodeResult();
    });

    document.getElementById('struct-sel')!.addEventListener('change', e => {
        // Persist current address before re-render replaces the input element
        const v = parseInt(addrInp.value.replace(/^0x/i, ''), 16);
        S.activeStructAddr = isNaN(v) ? null : v;
        S.activeStructId = (e.target as HTMLSelectElement).value || null;
        renderStructPanel();
    });

    document.getElementById('struct-btn-new')?.addEventListener('click', () => {
        renderStructEditor(null);
    });

    document.getElementById('struct-btn-edit')?.addEventListener('click', () => {
        const def = S.structs.find(d => d.id === S.activeStructId) ?? null;
        renderStructEditor(def);
    });

    document.getElementById('struct-btn-del')?.addEventListener('click', () => {
        S.structs = S.structs.filter(d => d.id !== S.activeStructId);
        S.activeStructId = allStructs()[0]?.id ?? null;
        vscode.postMessage({ type: 'saveStructs', structs: S.structs });
        renderStructPanel();
    });

    // Decode immediately if we already have a valid address + struct
    if (S.activeStructId && S.activeStructAddr !== null) {
        renderDecodeResult();
    }
}

// ── Decode result table ───────────────────────────────────────────

function renderDecodeResult(): void {
    const el = document.getElementById('struct-decode-result');
    if (!el) { return; }

    const def = allStructs().find(d => d.id === S.activeStructId);
    if (!def) {
        el.innerHTML = `<div class="sb-empty struct-result-empty">Select a struct to decode.</div>`;
        return;
    }
    if (S.activeStructAddr === null) {
        el.innerHTML = `<div class="sb-empty struct-result-empty">Enter a base address.</div>`;
        return;
    }

    const rows = decodeStruct(def, S.activeStructAddr, S.flatBytes, S.endian);
    const totalBytes = structByteSize(def);
    const baseAddr = S.activeStructAddr;
    const baseHex = baseAddr.toString(16).toUpperCase().padStart(8, '0');

    if (rows.length === 0) {
        el.innerHTML = `<div class="sb-empty struct-result-empty">No fields defined.</div>`;
        return;
    }

    const alreadyPinned = S.structPins.some(p => p.structId === def.id && p.addr === baseAddr);

    const trows = rows.map(r => {
        const offHex  = r.byteOffset.toString(16).toUpperCase().padStart(4, '0');
        const addrHex = (baseAddr + r.byteOffset).toString(16).toUpperCase().padStart(8, '0');
        const noData  = !r.hasData ? ' struct-no-data' : '';
        return `<tr class="struct-drow${noData}" data-addr="${addrHex}" title="0x${addrHex}">` +
            `<td class="sdf-off">+${offHex}</td>` +
            `<td class="sdf-name">${esc(r.fieldName)}</td>` +
            `<td class="sdf-type">${esc(r.type)}</td>` +
            `<td class="sdf-val">${esc(r.decoded)}</td>` +
            `</tr>`;
    }).join('');

    el.innerHTML =
        `<div class="struct-result-hdr">` +
        `<span class="struct-result-name">${esc(def.name)}</span>` +
        `<span class="struct-result-meta">@ 0x${baseHex} · ${totalBytes}B</span>` +
        `<button id="struct-btn-pin" class="struct-pin-save-btn${alreadyPinned ? ' pinned' : ''}" ` +
               `title="${alreadyPinned ? 'Already saved' : 'Save this overlay to the pins list'}">` +
               `${alreadyPinned ? '📌' : '📌 Save'}` +
        `</button>` +
        `</div>` +
        `<table class="struct-decode-tbl"><tbody>${trows}</tbody></table>`;

    // Pin button
    document.getElementById('struct-btn-pin')?.addEventListener('click', () => {
        if (alreadyPinned) { return; }
        const pin: StructPin = { id: `pin_${Date.now()}`, structId: def.id, addr: baseAddr };
        S.structPins = [...S.structPins, pin];
        vscode.postMessage({ type: 'saveStructPins', pins: S.structPins });
        renderStructPins();
        renderDecodeResult(); // re-render to update pin button state
    });

    // Click row → select that address in memory/inspector
    el.querySelectorAll<HTMLElement>('.struct-drow[data-addr]').forEach(row => {
        row.addEventListener('click', () => {
            const addr = parseInt(row.dataset.addr!, 16);
            if (!isNaN(addr) && S.flatBytes.has(addr)) {
                S.selStart = addr;
                S.selEnd   = addr;
                import('./memoryView.js').then(m => m.applySel());
                import('./sidebar.js').then(m => m.updateInspector());
            }
        });
    });
}

// ── Struct Editor ─────────────────────────────────────────────────

/** Render the inline struct editor. Pass null to create a new struct. */
export function renderStructEditor(existing: StructDef | null): void {
    const sec = document.getElementById('s-struct');
    if (!sec) { return; }

    const draft: StructDef = existing
        ? { id: existing.id, name: existing.name, fields: existing.fields.map(f => ({ ...f })) }
        : { id: `user_${Date.now()}`, name: 'MyStruct', fields: [] };

    const fieldRow = (f: import('./types').StructField, i: number): string => {
        const typeOpts = FIELD_TYPES.map(t =>
            `<option value="${t}" ${f.type === t ? 'selected' : ''}>${t}</option>`
        ).join('');
        const endianOpts = (['inherit', 'le', 'be'] as StructFieldEndian[]).map(e =>
            `<option value="${e}" ${f.endian === e ? 'selected' : ''}>${e}</option>`
        ).join('');
        return `<div class="struct-field-row" data-idx="${i}">` +
            `<input class="sfe-name-inp" type="text" value="${esc(f.name)}" maxlength="64" placeholder="fieldName">` +
            `<select class="sfe-type-sel">${typeOpts}</select>` +
            `<input class="sfe-count-inp" type="number" value="${f.count}" min="1" max="256" title="Array count">` +
            `<select class="sfe-endian-sel">${endianOpts}</select>` +
            `<button class="sfe-del-btn" title="Remove field">✕</button>` +
            `</div>`;
    };

    const syncDraftFromDOM = () => {
        draft.name = (document.getElementById('struct-name-inp') as HTMLInputElement)?.value ?? draft.name;
        const rows = document.querySelectorAll<HTMLElement>('#struct-fields .struct-field-row');
        draft.fields = Array.from(rows).map(row => ({
            name:   (row.querySelector('.sfe-name-inp')   as HTMLInputElement).value   || 'field',
            type:   (row.querySelector('.sfe-type-sel')   as HTMLSelectElement).value  as StructFieldType,
            count:  Math.max(1, parseInt((row.querySelector('.sfe-count-inp') as HTMLInputElement).value) || 1),
            endian: (row.querySelector('.sfe-endian-sel') as HTMLSelectElement).value  as StructFieldEndian,
        }));
    };

    const wireEditorEvents = () => {
        document.getElementById('struct-load-preset')?.addEventListener('click', () => {
            const pId = (document.getElementById('struct-preset-sel') as HTMLSelectElement).value;
            const preset = STRUCT_PRESETS.find(p => p.id === pId);
            if (preset) {
                draft.name   = preset.name;
                draft.fields = preset.fields.map(f => ({ ...f }));
                renderIt();
            }
        });

        document.getElementById('struct-add-field')?.addEventListener('click', () => {
            syncDraftFromDOM();
            draft.fields.push({ name: `field${draft.fields.length}`, type: 'uint8', count: 1, endian: 'inherit' });
            renderIt();
        });

        document.querySelectorAll<HTMLElement>('.sfe-del-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                syncDraftFromDOM();
                const row = btn.closest<HTMLElement>('.struct-field-row')!;
                const idx = parseInt(row.dataset.idx!);
                draft.fields.splice(idx, 1);
                renderIt();
            });
        });

        document.getElementById('struct-save')?.addEventListener('click', () => {
            syncDraftFromDOM();
            if (!draft.name.trim()) { draft.name = 'MyStruct'; }
            const existingIdx = S.structs.findIndex(d => d.id === draft.id);
            if (existingIdx >= 0) {
                S.structs[existingIdx] = draft;
            } else {
                S.structs.push(draft);
            }
            S.activeStructId = draft.id;
            vscode.postMessage({ type: 'saveStructs', structs: S.structs });
            renderStructPanel();
        });

        document.getElementById('struct-cancel')?.addEventListener('click', () => {
            renderStructPanel();
        });
    };

    const renderIt = () => {
        const presetOpts = STRUCT_PRESETS.map(p =>
            `<option value="${esc(p.id)}">${esc(p.name)}</option>`
        ).join('');

        const fieldRows = draft.fields.map((f, i) => fieldRow(f, i)).join('');

        sec.innerHTML =
            `<div class="sb-hdr">${existing ? 'Edit Struct' : 'New Struct'}</div>` +
            `<div class="struct-editor">` +
            (!existing
                ? `<div class="struct-row struct-preset-row">` +
                  `<label class="struct-lbl">Preset</label>` +
                  `<select id="struct-preset-sel" class="struct-sel">` +
                  `<option value="">— blank —</option>${presetOpts}` +
                  `</select>` +
                  `<button id="struct-load-preset" class="struct-btn struct-btn-secondary">Load</button>` +
                  `</div>`
                : '') +
            `<div class="struct-row">` +
            `<label class="struct-lbl">Name</label>` +
            `<input id="struct-name-inp" class="struct-addr-inp" type="text" value="${esc(draft.name)}" maxlength="64">` +
            `</div>` +
            `<div id="struct-fields">` +
            `<div class="struct-field-hdr">` +
            `<span class="sfe-name">Field Name</span>` +
            `<span class="sfe-type">Type</span>` +
            `<span class="sfe-count">×</span>` +
            `<span class="sfe-endian">End.</span>` +
            `<span class="sfe-del"></span>` +
            `</div>` +
            `${fieldRows}` +
            `</div>` +
            `<button id="struct-add-field" class="struct-add-field-btn">+ Add Field</button>` +
            `<div class="struct-editor-btns">` +
            `<button id="struct-save"   class="struct-btn struct-btn-apply">Save</button>` +
            `<button id="struct-cancel" class="struct-btn struct-btn-secondary">Cancel</button>` +
            `</div>` +
            `</div>`;

        wireEditorEvents();
    };

    renderIt();
}

// ── Selection helper ──────────────────────────────────────────────

/** Called when the user's byte selection changes.
 *  - Struct tab active: always sync address to selection and live-decode.
 *  - Struct tab hidden: fill address only when the box is still empty (pre-fills for later).
 */
export function onSelectionChangeForStruct(): void {
    if (S.selStart === null) { return; }
    const inp = document.getElementById('struct-addr-inp') as HTMLInputElement | null;
    if (!inp) { return; }

    if (S.sidebarTab === 'struct') {
        // Live sync: update address and immediately decode
        inp.value = S.selStart.toString(16).toUpperCase().padStart(8, '0');
        S.activeStructAddr = S.selStart;
        renderDecodeResult();
    } else if (!inp.value.trim()) {
        // Pre-fill so the address is ready when the user switches to the struct tab
        inp.value = S.selStart.toString(16).toUpperCase().padStart(8, '0');
        S.activeStructAddr = S.selStart;
    }
}

// ── Struct Pins list ──────────────────────────────────────────────

export function renderStructPins(): void {
    const sec = document.getElementById('s-struct-pins');
    if (!sec) { return; }

    const badge = S.structPins.length > 0
        ? `<span class="sb-badge">${S.structPins.length}</span>` : '';

    if (S.structPins.length === 0) {
        sec.innerHTML =
            `<div class="sb-hdr">Saved Overlays ${badge}</div>` +
            `<div class="sb-empty">Decode a struct and click 📌 to save it here.</div>`;
        return;
    }

    const items = S.structPins.map((pin, i) => {
        const def = allStructs().find(d => d.id === pin.structId);
        const defName = def ? def.name : `? (${pin.structId})`;
        const totalBytes = def ? structByteSize(def) : 0;
        const addrHex = pin.addr.toString(16).toUpperCase().padStart(8, '0');
        const note = pin.note ? `<div class="struct-pin-note">${esc(pin.note)}</div>` : '';
        return (
            `<div class="struct-pin-item" data-idx="${i}">` +
            `<div class="struct-pin-body">` +
            `<div class="struct-pin-name">${esc(defName)}</div>` +
            `${note}` +
            `<div class="struct-pin-meta">0x${addrHex} · ${totalBytes}B</div>` +
            `</div>` +
            `<button class="struct-pin-del" data-idx="${i}" title="Remove pin">✕</button>` +
            `</div>`
        );
    }).join('');

    sec.innerHTML =
        `<div class="sb-hdr">Saved Overlays ${badge}</div>` +
        items;

    // Click item body → jump to address + highlight bytes + show decode
    sec.querySelectorAll<HTMLElement>('.struct-pin-item').forEach(item => {
        item.addEventListener('click', e => {
            // Don't trigger from delete button
            if ((e.target as HTMLElement).closest('.struct-pin-del')) { return; }
            const idx = parseInt(item.dataset.idx!);
            const pin = S.structPins[idx];
            if (!pin) { return; }
            const def = allStructs().find(d => d.id === pin.structId);
            if (!def) { return; }

            const size = structByteSize(def);
            S.activeStructId   = pin.structId;
            S.activeStructAddr = pin.addr;
            S.selStart = pin.addr;
            S.selEnd   = pin.addr + size - 1;

            // Switch content pane to memory view, then apply selection + scroll
            rerender.toMemory();
            import('./memoryView.js').then(m => {
                m.applySel();
                m.scrollTo(pin.addr);
            });
            import('./sidebar.js').then(m => m.updateInspector());

            // Update decoder panel in the Advanced tab
            renderStructPanel();
        });
    });

    // Delete button
    sec.querySelectorAll<HTMLElement>('.struct-pin-del').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx!);
            S.structPins = S.structPins.filter((_, i) => i !== idx);
            vscode.postMessage({ type: 'saveStructPins', pins: S.structPins });
            renderStructPins();
            renderDecodeResult(); // refresh pin button state
        });
    });
}
