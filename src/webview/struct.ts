// ── Struct / Type Overlay — UI layer ─────────────────────────────
// Renders the sidebar panel, decode result table, and inline editor.
// Pure codec logic lives in struct-codec.ts.

import { S }       from './state';
import { esc }     from './utils';
import { vscode }  from './api';
import {
    FIELD_TYPES, STRUCT_PRESETS,
    fieldByteSize, structByteSize, decodeStruct, allStructs,
} from './struct-codec.js';
import type { StructDef, StructFieldType, StructFieldEndian } from './types';

// Re-export codec symbols so callers can import from a single path.
export {
    FIELD_TYPES, STRUCT_PRESETS,
    fieldByteSize, structByteSize, decodeStruct, allStructs,
} from './struct-codec.js';
export type { DecodedField } from './struct-codec.js';

// ── Sidebar panel render ──────────────────────────────────────────

export function renderStructPanel(): void {
    const sec = document.getElementById('s-struct');
    if (!sec) { return; }

    const addrVal = S.activeStructAddr !== null
        ? S.activeStructAddr.toString(16).toUpperCase().padStart(8, '0') : '';
    const all = allStructs();
    const badge = S.structs.length > 0 ? `<span class="sb-badge">${S.structs.length} custom</span>` : '';

    const structOpts = all.length === 0
        ? '<option value="">— No structs —</option>'
        : all.map(d =>
            `<option value="${esc(d.id)}" ${S.activeStructId === d.id ? 'selected' : ''}>${esc(d.name)}</option>`
          ).join('');

    const isPreset  = S.activeStructId?.startsWith('__preset_') ?? false;
    const hasStruct = S.activeStructId !== null && all.find(d => d.id === S.activeStructId);

    sec.innerHTML =
        `<div class="sb-hdr">Struct Overlay ${badge}</div>` +
        `<div class="struct-controls">` +
        `<div class="struct-row">` +
        `<label class="struct-lbl">Address</label>` +
        `<input id="struct-addr-inp" class="struct-addr-inp" type="text" ` +
               `value="${esc(addrVal)}" placeholder="08000000" maxlength="8" autocomplete="off" spellcheck="false">` +
        `</div>` +
        `<div class="struct-row">` +
        `<label class="struct-lbl">Struct</label>` +
        `<select id="struct-sel" class="struct-sel">${structOpts}</select>` +
        `</div>` +
        `<div class="struct-btn-row">` +
        `<button id="struct-btn-apply" class="struct-btn struct-btn-apply" ` +
               `title="Decode memory at address using selected struct">Apply</button>` +
        (hasStruct && !isPreset
            ? `<button id="struct-btn-edit" class="struct-btn struct-btn-secondary" title="Edit struct definition">Edit</button>`
            : '') +
        `<button id="struct-btn-new" class="struct-btn struct-btn-secondary" title="Create a new struct definition">New</button>` +
        (hasStruct && !isPreset
            ? `<button id="struct-btn-del" class="struct-btn struct-btn-danger" title="Delete struct definition">Delete</button>`
            : '') +
        `</div>` +
        `</div>` +
        `<div id="struct-decode-result"></div>`;

    // Wire controls
    document.getElementById('struct-addr-inp')!.addEventListener('change', e => {
        const v = parseInt((e.target as HTMLInputElement).value.replace(/^0x/i, ''), 16);
        S.activeStructAddr = isNaN(v) ? null : v;
    });

    document.getElementById('struct-sel')!.addEventListener('change', e => {
        const val = (e.target as HTMLSelectElement).value;
        S.activeStructId = val || null;
        renderStructPanel(); // re-render to show/hide edit+delete buttons
    });

    document.getElementById('struct-btn-apply')?.addEventListener('click', () => {
        const addrRaw = (document.getElementById('struct-addr-inp') as HTMLInputElement).value.replace(/^0x/i, '');
        S.activeStructAddr = addrRaw ? parseInt(addrRaw, 16) : null;
        if (isNaN(S.activeStructAddr!)) { S.activeStructAddr = null; }
        renderDecodeResult();
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

    // If we already have a valid selection + address, render the result immediately
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
        el.innerHTML = `<div class="sb-empty struct-result-empty">Select a struct and press Apply.</div>`;
        return;
    }
    if (S.activeStructAddr === null) {
        el.innerHTML = `<div class="sb-empty struct-result-empty">Enter a base address.</div>`;
        return;
    }

    const rows = decodeStruct(def, S.activeStructAddr, S.flatBytes, S.endian);
    const totalBytes = structByteSize(def);
    const baseHex = S.activeStructAddr.toString(16).toUpperCase().padStart(8, '0');

    if (rows.length === 0) {
        el.innerHTML = `<div class="sb-empty struct-result-empty">No fields defined.</div>`;
        return;
    }

    const trows = rows.map(r => {
        const offHex  = r.byteOffset.toString(16).toUpperCase().padStart(4, '0');
        const addrHex = (S.activeStructAddr! + r.byteOffset).toString(16).toUpperCase().padStart(8, '0');
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
        `<span class="struct-result-meta">@ 0x${baseHex} · ${totalBytes} bytes</span>` +
        `</div>` +
        `<table class="struct-decode-tbl"><tbody>${trows}</tbody></table>`;

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

/** Called when the user's byte selection changes; auto-fills the address box if empty. */
export function onSelectionChangeForStruct(): void {
    if (S.selStart === null) { return; }
    const inp = document.getElementById('struct-addr-inp') as HTMLInputElement | null;
    if (inp && !inp.value.trim()) {
        inp.value = S.selStart.toString(16).toUpperCase().padStart(8, '0');
        S.activeStructAddr = S.selStart;
    }
}
