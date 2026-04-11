"use strict";
// ── Struct / Type Overlay — UI layer ─────────────────────────────
// Renders the sidebar panel, decode result table, and inline editor.
// Pure codec logic lives in struct-codec.ts.
Object.defineProperty(exports, "__esModule", { value: true });
exports.fieldsToText = exports.parseStructText = exports.allStructs = exports.decodeStruct = exports.structByteSize = exports.fieldByteSize = exports.TYPE_TO_C = exports.STRUCT_PRESETS = exports.FIELD_TYPES = void 0;
exports.renderStructPanel = renderStructPanel;
exports.renderStructEditor = renderStructEditor;
exports.onSelectionChangeForStruct = onSelectionChangeForStruct;
exports.renderStructPins = renderStructPins;
const state_1 = require("./state");
const utils_1 = require("./utils");
const api_1 = require("./api");
const render_1 = require("./render");
const struct_codec_js_1 = require("./struct-codec.js");
// Re-export codec symbols so callers can import from a single path.
var struct_codec_js_2 = require("./struct-codec.js");
Object.defineProperty(exports, "FIELD_TYPES", { enumerable: true, get: function () { return struct_codec_js_2.FIELD_TYPES; } });
Object.defineProperty(exports, "STRUCT_PRESETS", { enumerable: true, get: function () { return struct_codec_js_2.STRUCT_PRESETS; } });
Object.defineProperty(exports, "TYPE_TO_C", { enumerable: true, get: function () { return struct_codec_js_2.TYPE_TO_C; } });
Object.defineProperty(exports, "fieldByteSize", { enumerable: true, get: function () { return struct_codec_js_2.fieldByteSize; } });
Object.defineProperty(exports, "structByteSize", { enumerable: true, get: function () { return struct_codec_js_2.structByteSize; } });
Object.defineProperty(exports, "decodeStruct", { enumerable: true, get: function () { return struct_codec_js_2.decodeStruct; } });
Object.defineProperty(exports, "allStructs", { enumerable: true, get: function () { return struct_codec_js_2.allStructs; } });
Object.defineProperty(exports, "parseStructText", { enumerable: true, get: function () { return struct_codec_js_2.parseStructText; } });
Object.defineProperty(exports, "fieldsToText", { enumerable: true, get: function () { return struct_codec_js_2.fieldsToText; } });
// ── Sidebar panel render ──────────────────────────────────────────
/** Debounce timer for live address-input decode. */
let _decodeTimer = null;
function scheduleDecode() {
    if (_decodeTimer) {
        clearTimeout(_decodeTimer);
    }
    _decodeTimer = setTimeout(() => {
        const inp = document.getElementById('struct-addr-inp');
        if (inp) {
            const v = parseInt(inp.value.replace(/^0x/i, ''), 16);
            state_1.S.activeStructAddr = isNaN(v) ? null : v;
        }
        renderDecodeResult();
        _decodeTimer = null;
    }, 250);
}
function renderStructPanel() {
    const sec = document.getElementById('s-struct');
    if (!sec) {
        return;
    }
    const addrVal = state_1.S.activeStructAddr !== null
        ? state_1.S.activeStructAddr.toString(16).toUpperCase().padStart(8, '0') : '';
    const all = (0, struct_codec_js_1.allStructs)();
    const badge = state_1.S.structs.length > 0 ? `<span class="sb-badge">${state_1.S.structs.length}</span>` : '';
    const structOpts = all.length === 0
        ? '<option value="">— No structs —</option>'
        : all.map(d => {
            const sz = (0, struct_codec_js_1.structByteSize)(d);
            return `<option value="${(0, utils_1.esc)(d.id)}" ${state_1.S.activeStructId === d.id ? 'selected' : ''}>${(0, utils_1.esc)(d.name)} (${sz} B)</option>`;
        }).join('');
    const isPreset = state_1.S.activeStructId?.startsWith('__preset_') ?? false;
    const hasCustom = state_1.S.activeStructId !== null && !isPreset && all.some(d => d.id === state_1.S.activeStructId);
    sec.innerHTML =
        `<div class="sb-hdr">Struct Overlay ${badge}</div>` +
            `<div class="struct-controls">` +
            // Address row with 0x prefix
            `<div class="struct-row">` +
            `<span class="struct-addr-pfx">0x</span>` +
            `<input id="struct-addr-inp" class="struct-addr-inp" type="text" ` +
            `value="${(0, utils_1.esc)(addrVal)}" placeholder="08000000" maxlength="8" autocomplete="off" spellcheck="false">` +
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
    const addrInp = document.getElementById('struct-addr-inp');
    addrInp.addEventListener('input', () => { scheduleDecode(); });
    addrInp.addEventListener('change', () => {
        const v = parseInt(addrInp.value.replace(/^0x/i, ''), 16);
        state_1.S.activeStructAddr = isNaN(v) ? null : v;
        renderDecodeResult();
    });
    document.getElementById('struct-sel').addEventListener('change', e => {
        // Persist current address before re-render replaces the input element
        const v = parseInt(addrInp.value.replace(/^0x/i, ''), 16);
        state_1.S.activeStructAddr = isNaN(v) ? null : v;
        state_1.S.activeStructId = e.target.value || null;
        renderStructPanel();
    });
    document.getElementById('struct-btn-new')?.addEventListener('click', () => {
        renderStructEditor(null);
    });
    document.getElementById('struct-btn-edit')?.addEventListener('click', () => {
        const def = state_1.S.structs.find(d => d.id === state_1.S.activeStructId) ?? null;
        renderStructEditor(def);
    });
    document.getElementById('struct-btn-del')?.addEventListener('click', () => {
        state_1.S.structs = state_1.S.structs.filter(d => d.id !== state_1.S.activeStructId);
        state_1.S.activeStructId = (0, struct_codec_js_1.allStructs)()[0]?.id ?? null;
        api_1.vscode.postMessage({ type: 'saveStructs', structs: state_1.S.structs });
        renderStructPanel();
    });
    // Decode immediately if we already have a valid address + struct
    if (state_1.S.activeStructId && state_1.S.activeStructAddr !== null) {
        renderDecodeResult();
    }
}
// ── Decode result table ───────────────────────────────────────────
function renderDecodeResult() {
    const el = document.getElementById('struct-decode-result');
    if (!el) {
        return;
    }
    const def = (0, struct_codec_js_1.allStructs)().find(d => d.id === state_1.S.activeStructId);
    if (!def) {
        el.innerHTML = `<div class="sb-empty struct-result-empty">Select a struct to decode.</div>`;
        return;
    }
    if (state_1.S.activeStructAddr === null) {
        el.innerHTML = `<div class="sb-empty struct-result-empty">Enter a base address.</div>`;
        return;
    }
    const rows = (0, struct_codec_js_1.decodeStruct)(def, state_1.S.activeStructAddr, state_1.S.flatBytes, state_1.S.endian);
    const totalBytes = (0, struct_codec_js_1.structByteSize)(def);
    const baseAddr = state_1.S.activeStructAddr;
    const baseHex = baseAddr.toString(16).toUpperCase().padStart(8, '0');
    if (rows.length === 0) {
        el.innerHTML = `<div class="sb-empty struct-result-empty">No fields defined.</div>`;
        return;
    }
    const alreadyPinned = state_1.S.structPins.some(p => p.structId === def.id && p.addr === baseAddr);
    const trows = rows.map(r => {
        const offHex = r.byteOffset.toString(16).toUpperCase().padStart(4, '0');
        const addrHex = (baseAddr + r.byteOffset).toString(16).toUpperCase().padStart(8, '0');
        const noData = !r.hasData ? ' struct-no-data' : '';
        return `<tr class="struct-drow${noData}" data-addr="${addrHex}" title="0x${addrHex}">` +
            `<td class="sdf-off">+${offHex}</td>` +
            `<td class="sdf-name">${(0, utils_1.esc)(r.fieldName)}</td>` +
            `<td class="sdf-type">${(0, utils_1.esc)(r.type)}</td>` +
            `<td class="sdf-val">${(0, utils_1.esc)(r.decoded)}</td>` +
            `</tr>`;
    }).join('');
    el.innerHTML =
        `<div class="struct-result-hdr">` +
            `<span class="struct-result-name">${(0, utils_1.esc)(def.name)}</span>` +
            `<span class="struct-result-meta">@ 0x${baseHex} · ${totalBytes}B</span>` +
            `<button id="struct-btn-pin" class="struct-pin-save-btn${alreadyPinned ? ' pinned' : ''}" ` +
            `title="${alreadyPinned ? 'Already saved' : 'Save this overlay to the pins list'}">` +
            `${alreadyPinned ? '📌' : '📌 Save'}` +
            `</button>` +
            `</div>` +
            `<table class="struct-decode-tbl"><tbody>${trows}</tbody></table>`;
    // Pin button
    document.getElementById('struct-btn-pin')?.addEventListener('click', () => {
        if (alreadyPinned) {
            return;
        }
        const pin = { id: `pin_${Date.now()}`, structId: def.id, addr: baseAddr };
        state_1.S.structPins = [...state_1.S.structPins, pin];
        api_1.vscode.postMessage({ type: 'saveStructPins', pins: state_1.S.structPins });
        renderStructPins();
        renderDecodeResult(); // re-render to update pin button state
    });
    // Click row → select that address in memory/inspector
    el.querySelectorAll('.struct-drow[data-addr]').forEach(row => {
        row.addEventListener('click', () => {
            const addr = parseInt(row.dataset.addr, 16);
            if (!isNaN(addr) && state_1.S.flatBytes.has(addr)) {
                state_1.S.selStart = addr;
                state_1.S.selEnd = addr;
                import('./memoryView.js').then(m => m.applySel());
                import('./sidebar.js').then(m => m.updateInspector());
            }
        });
    });
}
// ── Struct Editor ─────────────────────────────────────────────────
/** Render the inline struct editor. Pass null to create a new struct. */
function renderStructEditor(existing, mode = 'form') {
    const sec = document.getElementById('s-struct');
    if (!sec) {
        return;
    }
    const draftId = existing?.id ?? `user_${Date.now()}`;
    // draft.fields is the shared source of truth between both modes
    const draft = existing
        ? { id: draftId, name: existing.name, fields: existing.fields.map(f => ({ ...f })) }
        : { id: draftId, name: 'MyStruct', fields: [] };
    const renderIt = (m) => renderStructEditor_inner(sec, draft, existing, m);
    renderIt(mode);
}
function renderStructEditor_inner(sec, draft, existing, mode) {
    const isForm = mode === 'form';
    const presetOpts = struct_codec_js_1.STRUCT_PRESETS.map(p => `<option value="${(0, utils_1.esc)(p.id)}">${(0, utils_1.esc)(p.name)}</option>`).join('');
    // ── Visual form helpers ───────────────────────────────────────
    const fieldRow = (f, i) => {
        const typeOpts = struct_codec_js_1.FIELD_TYPES.map(t => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${t}</option>`).join('');
        const endianOpts = ['inherit', 'le', 'be'].map(e => `<option value="${e}" ${f.endian === e ? 'selected' : ''}>${e}</option>`).join('');
        return `<div class="struct-field-row" data-idx="${i}">` +
            `<input class="sfe-name-inp" type="text" value="${(0, utils_1.esc)(f.name)}" maxlength="64" placeholder="fieldName">` +
            `<select class="sfe-type-sel">${typeOpts}</select>` +
            `<input class="sfe-count-inp" type="number" value="${f.count}" min="1" max="256" title="Array count">` +
            `<select class="sfe-endian-sel">${endianOpts}</select>` +
            `<button class="sfe-del-btn" title="Remove field">✕</button>` +
            `</div>`;
    };
    const syncDraftFromForm = () => {
        draft.name = document.getElementById('struct-name-inp')?.value ?? draft.name;
        const rows = sec.querySelectorAll('.struct-field-row');
        draft.fields = Array.from(rows).map(row => ({
            name: row.querySelector('.sfe-name-inp').value || 'field',
            type: row.querySelector('.sfe-type-sel').value,
            count: Math.max(1, parseInt(row.querySelector('.sfe-count-inp').value) || 1),
            endian: row.querySelector('.sfe-endian-sel').value,
        }));
    };
    const syncDraftFromText = () => {
        const ta = document.getElementById('struct-text-inp');
        if (!ta) {
            return;
        }
        const nameInp = document.getElementById('struct-name-inp');
        if (nameInp) {
            draft.name = nameInp.value || draft.name;
        }
        const { fields } = (0, struct_codec_js_1.parseStructText)(ta.value);
        if (fields.length > 0) {
            draft.fields = fields;
        }
    };
    // ── Build HTML ────────────────────────────────────────────────
    const fieldRows = draft.fields.map((f, i) => fieldRow(f, i)).join('');
    const formBody = `<div id="struct-fields">` +
        `<div class="struct-field-hdr">` +
        `<span>Field Name</span><span>Type</span><span>×</span><span>End.</span><span></span>` +
        `</div>` +
        (fieldRows || `<div class="sb-empty" style="padding:4px 0">No fields yet</div>`) +
        `</div>` +
        `<button id="struct-add-field" class="struct-add-field-btn">+ Add Field</button>`;
    const textBody = `<textarea id="struct-text-inp" class="struct-text-inp" spellcheck="false" ` +
        `placeholder="uint32_t field_name;\nuint8_t  buffer[16];\nfloat    value;    // be"></textarea>` +
        `<div id="struct-parse-status" class="struct-parse-status"></div>` +
        `<div class="struct-text-hint">` +
        `uint8/16/32_t · int8/16/32_t · float · double · unsigned/signed · arr[N]` +
        ` · <span class="hint-code">// be</span> or <span class="hint-code">// le</span>` +
        `</div>`;
    sec.innerHTML =
        `<div class="sb-hdr">${existing ? 'Edit Struct' : 'New Struct'}</div>` +
            `<div class="struct-editor">` +
            // Preset row (new only)
            (!existing
                ? `<div class="struct-row struct-preset-row">` +
                    `<label class="struct-lbl">Preset</label>` +
                    `<select id="struct-preset-sel" class="struct-sel">` +
                    `<option value="">— blank —</option>${presetOpts}` +
                    `</select>` +
                    `<button id="struct-load-preset" class="struct-btn struct-btn-secondary">Load</button>` +
                    `</div>`
                : '') +
            // Name + mode toggle on the same row
            `<div class="struct-row">` +
            `<input id="struct-name-inp" class="struct-addr-inp" type="text" value="${(0, utils_1.esc)(draft.name)}" ` +
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
    const nameInp = document.getElementById('struct-name-inp');
    document.getElementById('smt-form').addEventListener('click', () => {
        if (!isForm) {
            syncDraftFromText();
            draft.name = nameInp.value || draft.name;
        }
        renderStructEditor_inner(sec, draft, existing, 'form');
    });
    document.getElementById('smt-text').addEventListener('click', () => {
        if (isForm) {
            syncDraftFromForm();
            draft.name = nameInp.value || draft.name;
        }
        renderStructEditor_inner(sec, draft, existing, 'text');
    });
    // ── Wire preset loader ───────────────────────────────────────
    document.getElementById('struct-load-preset')?.addEventListener('click', () => {
        const pId = document.getElementById('struct-preset-sel').value;
        const preset = struct_codec_js_1.STRUCT_PRESETS.find(p => p.id === pId);
        if (!preset) {
            return;
        }
        draft.name = preset.name;
        draft.fields = preset.fields.map(f => ({ ...f }));
        renderStructEditor_inner(sec, draft, existing, mode);
    });
    // ── Form mode wiring ─────────────────────────────────────────
    if (isForm) {
        document.getElementById('struct-add-field')?.addEventListener('click', () => {
            syncDraftFromForm();
            draft.fields.push({ name: `field${draft.fields.length}`, type: 'uint8', count: 1, endian: 'inherit' });
            renderStructEditor_inner(sec, draft, existing, 'form');
        });
        sec.querySelectorAll('.sfe-del-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                syncDraftFromForm();
                const row = btn.closest('.struct-field-row');
                const idx = parseInt(row.dataset.idx);
                draft.fields.splice(idx, 1);
                renderStructEditor_inner(sec, draft, existing, 'form');
            });
        });
    }
    // ── Text mode wiring ─────────────────────────────────────────
    if (!isForm) {
        const textArea = document.getElementById('struct-text-inp');
        const statusEl = document.getElementById('struct-parse-status');
        // Populate without HTML encoding risks
        textArea.value = (0, struct_codec_js_1.fieldsToText)(draft.fields);
        const updateStatus = () => {
            const { fields, errors } = (0, struct_codec_js_1.parseStructText)(textArea.value);
            if (errors.length > 0) {
                statusEl.innerHTML = `<span class="struct-parse-err">⚠ ${(0, utils_1.esc)(errors[0])}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}</span>`;
            }
            else if (fields.length === 0) {
                statusEl.innerHTML = `<span class="struct-parse-hint">Add field declarations above</span>`;
            }
            else {
                const total = fields.reduce((s, f) => s + (0, struct_codec_js_1.fieldByteSize)(f.type) * f.count, 0);
                statusEl.innerHTML = `<span class="struct-parse-ok">✔ ${fields.length} field${fields.length === 1 ? '' : 's'} · ${total} bytes</span>`;
            }
        };
        updateStatus();
        textArea.addEventListener('input', () => {
            const { structName } = (0, struct_codec_js_1.parseStructText)(textArea.value);
            if (structName && (!nameInp.value.trim() || nameInp.value === 'MyStruct')) {
                nameInp.value = structName;
            }
            updateStatus();
        });
    }
    // ── Save ─────────────────────────────────────────────────────
    document.getElementById('struct-save').addEventListener('click', () => {
        if (isForm) {
            syncDraftFromForm();
        }
        else {
            const ta = document.getElementById('struct-text-inp');
            const statusEl = document.getElementById('struct-parse-status');
            const { fields, errors } = (0, struct_codec_js_1.parseStructText)(ta.value);
            if (errors.length > 0) {
                statusEl.innerHTML = `<span class="struct-parse-err">⚠ Fix ${errors.length} error${errors.length === 1 ? '' : 's'} before saving.</span>`;
                return;
            }
            if (fields.length === 0) {
                statusEl.innerHTML = `<span class="struct-parse-err">⚠ No fields defined.</span>`;
                return;
            }
            draft.fields = fields;
        }
        const name = nameInp.value.trim() || 'MyStruct';
        if (draft.fields.length === 0) {
            return;
        }
        const def = { id: draft.id, name, fields: draft.fields };
        const idx = state_1.S.structs.findIndex(d => d.id === def.id);
        if (idx >= 0) {
            state_1.S.structs[idx] = def;
        }
        else {
            state_1.S.structs.push(def);
        }
        state_1.S.activeStructId = def.id;
        api_1.vscode.postMessage({ type: 'saveStructs', structs: state_1.S.structs });
        renderStructPanel();
    });
    document.getElementById('struct-cancel').addEventListener('click', () => {
        renderStructPanel();
    });
}
// ── Selection helper ──────────────────────────────────────────────
/** Called when the user's byte selection changes.
 *  - Struct tab active: always sync address to selection and live-decode.
 *  - Struct tab hidden: fill address only when the box is still empty (pre-fills for later).
 */
function onSelectionChangeForStruct() {
    if (state_1.S.selStart === null) {
        return;
    }
    const inp = document.getElementById('struct-addr-inp');
    if (!inp) {
        return;
    }
    if (state_1.S.sidebarTab === 'struct') {
        // Live sync: update address and immediately decode
        inp.value = state_1.S.selStart.toString(16).toUpperCase().padStart(8, '0');
        state_1.S.activeStructAddr = state_1.S.selStart;
        renderDecodeResult();
    }
    else if (!inp.value.trim()) {
        // Pre-fill so the address is ready when the user switches to the struct tab
        inp.value = state_1.S.selStart.toString(16).toUpperCase().padStart(8, '0');
        state_1.S.activeStructAddr = state_1.S.selStart;
    }
}
// ── Struct Pins list ──────────────────────────────────────────────
function renderStructPins() {
    const sec = document.getElementById('s-struct-pins');
    if (!sec) {
        return;
    }
    const badge = state_1.S.structPins.length > 0
        ? `<span class="sb-badge">${state_1.S.structPins.length}</span>` : '';
    if (state_1.S.structPins.length === 0) {
        sec.innerHTML =
            `<div class="sb-hdr">Saved Overlays ${badge}</div>` +
                `<div class="sb-empty">Decode a struct and click 📌 to save it here.</div>`;
        return;
    }
    const items = state_1.S.structPins.map((pin, i) => {
        const def = (0, struct_codec_js_1.allStructs)().find(d => d.id === pin.structId);
        const defName = def ? def.name : `? (${pin.structId})`;
        const totalBytes = def ? (0, struct_codec_js_1.structByteSize)(def) : 0;
        const addrHex = pin.addr.toString(16).toUpperCase().padStart(8, '0');
        const note = pin.note ? `<div class="struct-pin-note">${(0, utils_1.esc)(pin.note)}</div>` : '';
        return (`<div class="struct-pin-item" data-idx="${i}">` +
            `<div class="struct-pin-body">` +
            `<div class="struct-pin-name">${(0, utils_1.esc)(defName)}</div>` +
            `${note}` +
            `<div class="struct-pin-meta">0x${addrHex} · ${totalBytes}B</div>` +
            `</div>` +
            `<button class="struct-pin-del" data-idx="${i}" title="Remove pin">✕</button>` +
            `</div>`);
    }).join('');
    sec.innerHTML =
        `<div class="sb-hdr">Saved Overlays ${badge}</div>` +
            items;
    // Click item body → jump to address + highlight bytes + show decode
    sec.querySelectorAll('.struct-pin-item').forEach(item => {
        item.addEventListener('click', e => {
            // Don't trigger from delete button
            if (e.target.closest('.struct-pin-del')) {
                return;
            }
            const idx = parseInt(item.dataset.idx);
            const pin = state_1.S.structPins[idx];
            if (!pin) {
                return;
            }
            const def = (0, struct_codec_js_1.allStructs)().find(d => d.id === pin.structId);
            if (!def) {
                return;
            }
            const size = (0, struct_codec_js_1.structByteSize)(def);
            state_1.S.activeStructId = pin.structId;
            state_1.S.activeStructAddr = pin.addr;
            state_1.S.selStart = pin.addr;
            state_1.S.selEnd = pin.addr + size - 1;
            // Switch content pane to memory view, then apply selection + scroll
            render_1.rerender.toMemory();
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
    sec.querySelectorAll('.struct-pin-del').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            state_1.S.structPins = state_1.S.structPins.filter((_, i) => i !== idx);
            api_1.vscode.postMessage({ type: 'saveStructPins', pins: state_1.S.structPins });
            renderStructPins();
            renderDecodeResult(); // refresh pin button state
        });
    });
}
//# sourceMappingURL=struct.js.map