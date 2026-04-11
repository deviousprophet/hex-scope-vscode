// ── Struct / Type Overlay — UI layer ─────────────────────────────
// Renders the sidebar panel, decode result table, and inline editor.
// Pure codec logic lives in struct-codec.ts.

import { S }       from './state';
import { esc }     from './utils';
import { vscode }  from './api';
import { rerender } from './render';
import {
    FIELD_TYPES,
    fieldByteSize, structByteSize, decodeStruct, allStructs,
    parseStructText, fieldsToText,
} from './struct-codec.js';
import type { StructDef, StructFieldType, StructFieldEndian, StructPin } from './types';

// Re-export codec symbols so callers can import from a single path.
export {
    FIELD_TYPES, TYPE_TO_C,
    fieldByteSize, structByteSize, decodeStruct, allStructs,
    parseStructText, fieldsToText,
} from './struct-codec.js';
export type { DecodedField, ParseStructTextResult } from './struct-codec.js';

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
        // Endian toggle + New struct on the same row
        `<div class="struct-row" style="justify-content:space-between">` +
        `<div class="endian-tabs struct-endian-tabs">` +
        `<button id="struct-btn-le" class="${S.endian === 'le' ? 'active' : ''}">LE</button>` +
        `<button id="struct-btn-be" class="${S.endian === 'be' ? 'active' : ''}">BE</button>` +
        `</div>` +
        `<button id="struct-btn-new" class="struct-btn struct-btn-secondary" style="font-size:10px">+ New Struct</button>` +
        `</div>` +
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

    document.getElementById('struct-btn-le')!.addEventListener('click', () => {
        S.endian = 'le';
        document.getElementById('struct-btn-le')!.classList.add('active');
        document.getElementById('struct-btn-be')!.classList.remove('active');
        renderDecodeResult();
    });
    document.getElementById('struct-btn-be')!.addEventListener('click', () => {
        S.endian = 'be';
        document.getElementById('struct-btn-be')!.classList.add('active');
        document.getElementById('struct-btn-le')!.classList.remove('active');
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
export function renderStructEditor(existing: StructDef | null, mode: 'form' | 'text' = 'form'): void {
    const sec = document.getElementById('s-struct');
    if (!sec) { return; }

    const draftId = existing?.id ?? `user_${Date.now()}`;
    // draft.fields is the shared source of truth between both modes
    const draft: StructDef = existing
        ? { id: draftId, name: existing.name, fields: existing.fields.map(f => ({ ...f })) }
        : { id: draftId, name: 'MyStruct', fields: [{ name: 'field0', type: 'uint32', count: 1, endian: 'inherit' }] };

    const renderIt = (m: 'form' | 'text') => renderStructEditor_inner(sec, draft, existing, m);
    renderIt(mode);
}

function renderStructEditor_inner(
    sec: HTMLElement,
    draft: StructDef,
    existing: StructDef | null,
    mode: 'form' | 'text',
): void {
    const isForm = mode === 'form';

    // ── Visual form helpers ───────────────────────────────────────
    const fieldRow = (f: import('./types').StructField, i: number): string => {
        const typeOpts = FIELD_TYPES.map(t =>
            `<option value="${t}" ${f.type === t ? 'selected' : ''}>${t}</option>`
        ).join('');
        const endianOpts = (['inherit', 'le', 'be'] as StructFieldEndian[]).map(e =>
            `<option value="${e}" ${f.endian === e ? 'selected' : ''}>${e}</option>`
        ).join('');
        const isArr = f.count > 1;
        return `<div class="struct-field-row" data-idx="${i}">` +
            `<select class="sfe-type-sel">${typeOpts}</select>` +
            `<input class="sfe-name-inp" type="text" value="${esc(f.name)}" maxlength="64" placeholder="fieldName">` +
            `<div class="sfe-arr-cell${isArr ? ' is-array' : ''}">` +
            `<button class="sfe-arr-toggle" title="Make array">[ ]</button>` +
            `<span class="sfe-arr-brace">[</span>` +
            `<input class="sfe-count-inp" type="text" inputmode="numeric" value="${isArr ? f.count : ''}" placeholder="N" maxlength="3">` +
            `<span class="sfe-arr-brace">]</span>` +
            `</div>` +
            `<select class="sfe-endian-sel">${endianOpts}</select>` +
            `<button class="sfe-del-btn" title="Remove field">✕</button>` +
            `</div>`;
    };

    const syncDraftFromForm = () => {
        draft.name = (document.getElementById('struct-name-inp') as HTMLInputElement)?.value ?? draft.name;
        const rows = sec.querySelectorAll<HTMLElement>('.struct-field-row');
        draft.fields = Array.from(rows).map(row => ({
            name:   (row.querySelector('.sfe-name-inp')   as HTMLInputElement).value   || 'field',
            type:   (row.querySelector('.sfe-type-sel')   as HTMLSelectElement).value  as StructFieldType,
            count:  (() => {
                const cell = row.querySelector<HTMLElement>('.sfe-arr-cell')!;
                if (!cell.classList.contains('is-array')) { return 1; }
                const v = parseInt((row.querySelector('.sfe-count-inp') as HTMLInputElement).value);
                return isNaN(v) || v < 1 ? 1 : Math.min(v, 256);
            })(),
            endian: (row.querySelector('.sfe-endian-sel') as HTMLSelectElement).value  as StructFieldEndian,
        }));
    };

    const syncDraftFromText = () => {
        const ta = document.getElementById('struct-text-inp') as HTMLTextAreaElement | null;
        if (!ta) { return; }
        const nameInp = document.getElementById('struct-name-inp') as HTMLInputElement | null;
        if (nameInp) { draft.name = nameInp.value || draft.name; }
        const { fields } = parseStructText(ta.value);
        if (fields.length > 0) { draft.fields = fields; }
    };

    // ── Build HTML ────────────────────────────────────────────────
    const fieldRows  = draft.fields.map((f, i) => fieldRow(f, i)).join('');
    const formBody   =
        `<div id="struct-fields">` +
        `<div class="struct-field-hdr">` +
        `<span>Type</span><span>Name</span><span>[ ]</span><span>End.</span><span></span>` +
        `</div>` +
        (fieldRows || `<div class="sb-empty" style="padding:4px 0">No fields yet</div>`) +
        `</div>` +
        `<button id="struct-add-field" class="struct-add-field-btn">+ Add Field</button>`;

    const textBody   =
        `<textarea id="struct-text-inp" class="struct-text-inp" spellcheck="false" ` +
               `placeholder="uint32_t field_name;\nuint8_t  buffer[16];\nfloat    value;    // be"></textarea>` +
        `<div id="struct-parse-status" class="struct-parse-status"></div>` +
        `<div class="struct-text-hint">` +
        `uint8/16/32_t · int8/16/32_t · float · double · unsigned/signed · arr[N]` +
        ` · <span class="hint-code">// be</span> or <span class="hint-code">// le</span>` +
        `</div>`;

    sec.innerHTML =
        `<div class="sb-hdr">${existing ? 'Edit Struct' : 'New Struct'}</div>` +
        `<div class="struct-editor">` +
        // Name + mode toggle on the same row
        `<div class="struct-row">` +
        `<input id="struct-name-inp" class="struct-addr-inp" type="text" value="${esc(draft.name)}" ` +
               `maxlength="64" placeholder="StructName" style="flex:1">` +
        `<div class="struct-mode-toggle">` +
        `<button class="smt-btn${isForm ? ' active' : ''}" id="smt-form" title="Visual editor">≡ Form</button>` +
        `<button class="smt-btn${!isForm ? ' active' : ''}" id="smt-text" title="C syntax editor">&lt;/&gt; Text</button>` +
        `</div>` +
        `</div>` +
        // Editor body
        (isForm ? formBody : textBody) +
        // Action buttons
        `<div class="struct-editor-btns">` +
        `<button id="struct-save"   class="struct-btn struct-btn-apply">Save</button>` +
        `<button id="struct-cancel" class="struct-btn struct-btn-secondary">Cancel</button>` +
        `</div>` +
        `</div>`;

    // ── Wire mode toggle ─────────────────────────────────────────
    const nameInp = document.getElementById('struct-name-inp') as HTMLInputElement;

    document.getElementById('smt-form')!.addEventListener('click', () => {
        if (!isForm) {
            syncDraftFromText();
            draft.name = nameInp.value || draft.name;
        }
        renderStructEditor_inner(sec, draft, existing, 'form');
    });
    document.getElementById('smt-text')!.addEventListener('click', () => {
        if (isForm) {
            syncDraftFromForm();
            draft.name = nameInp.value || draft.name;
        }
        renderStructEditor_inner(sec, draft, existing, 'text');
    });

    // ── Wire form mode toggle ─────────────────────────────────────────
    if (isForm) {
        document.getElementById('struct-add-field')?.addEventListener('click', () => {
            syncDraftFromForm();
            draft.fields.push({ name: `field${draft.fields.length}`, type: 'uint8', count: 1, endian: 'inherit' });
            renderStructEditor_inner(sec, draft, existing, 'form');
        });

        sec.querySelectorAll<HTMLElement>('.sfe-del-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                syncDraftFromForm();
                const row = btn.closest<HTMLElement>('.struct-field-row')!;
                const idx = parseInt(row.dataset.idx!);
                draft.fields.splice(idx, 1);
                renderStructEditor_inner(sec, draft, existing, 'form');
            });
        });

        // Array toggle
        sec.querySelectorAll<HTMLElement>('.sfe-arr-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const cell = btn.closest<HTMLElement>('.sfe-arr-cell')!;
                const nowArr = !cell.classList.contains('is-array');
                cell.classList.toggle('is-array', nowArr);
                if (nowArr) {
                    const inp = cell.querySelector<HTMLInputElement>('.sfe-count-inp')!;
                    if (!inp.value) { inp.value = '2'; }
                    inp.focus();
                    inp.select();
                }
            });
        });

        // Numeric-only filter
        sec.querySelectorAll<HTMLInputElement>('.sfe-count-inp').forEach(inp => {
            inp.addEventListener('input', () => {
                inp.value = inp.value.replace(/\D/g, '').slice(0, 3);
            });
        });
    }

    // ── Text mode wiring ─────────────────────────────────────────
    if (!isForm) {
        const textArea = document.getElementById('struct-text-inp') as HTMLTextAreaElement;
        const statusEl = document.getElementById('struct-parse-status')!;

        // Populate without HTML encoding risks
        textArea.value = fieldsToText(draft.fields);

        const updateStatus = () => {
            const { fields, errors } = parseStructText(textArea.value);
            if (errors.length > 0) {
                statusEl.innerHTML = `<span class="struct-parse-err">⚠ ${esc(errors[0])}${
                    errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}</span>`;
            } else if (fields.length === 0) {
                statusEl.innerHTML = `<span class="struct-parse-hint">Add field declarations above</span>`;
            } else {
                const total = fields.reduce((s, f) => s + fieldByteSize(f.type) * f.count, 0);
                statusEl.innerHTML = `<span class="struct-parse-ok">✔ ${
                    fields.length} field${fields.length === 1 ? '' : 's'} · ${total} bytes</span>`;
            }
        };
        updateStatus();

        textArea.addEventListener('input', () => {
            const { structName } = parseStructText(textArea.value);
            if (structName && (!nameInp.value.trim() || nameInp.value === 'MyStruct')) {
                nameInp.value = structName;
            }
            updateStatus();
        });
    }

    // ── Save ─────────────────────────────────────────────────────
    document.getElementById('struct-save')!.addEventListener('click', () => {
        if (isForm) {
            syncDraftFromForm();
        } else {
            const ta = document.getElementById('struct-text-inp') as HTMLTextAreaElement;
            const statusEl = document.getElementById('struct-parse-status')!;
            const { fields, errors } = parseStructText(ta.value);
            if (errors.length > 0) {
                statusEl.innerHTML = `<span class="struct-parse-err">⚠ Fix ${
                    errors.length} error${errors.length === 1 ? '' : 's'} before saving.</span>`;
                return;
            }
            if (fields.length === 0) {
                statusEl.innerHTML = `<span class="struct-parse-err">⚠ No fields defined.</span>`;
                return;
            }
            draft.fields = fields;
        }
        const name = nameInp.value.trim() || 'MyStruct';
        if (draft.fields.length === 0) { return; }
        const def: StructDef = { id: draft.id, name, fields: draft.fields };
        const idx = S.structs.findIndex(d => d.id === def.id);
        if (idx >= 0) { S.structs[idx] = def; } else { S.structs.push(def); }
        S.activeStructId = def.id;
        vscode.postMessage({ type: 'saveStructs', structs: S.structs });
        renderStructPanel();
    });

    document.getElementById('struct-cancel')!.addEventListener('click', () => {
        renderStructPanel();
    });
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
