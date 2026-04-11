"use strict";
// ── Sidebar panels ────────────────────────────────────────────────
// Inspector · Bit View · Multi-Byte interpreter · Segment Labels
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderInspector = renderInspector;
exports.updateInspector = updateInspector;
exports.renderBits = renderBits;
exports.renderLabels = renderLabels;
const state_1 = require("./state");
const utils_1 = require("./utils");
const api_1 = require("./api");
const render_1 = require("./render");
const data_1 = require("./data");
// ── Inspector ────────────────────────────────────────────────────
function renderInspector() {
    document.getElementById('s-insp').innerHTML =
        `<div class="sb-hdr">Inspector</div>
         <div id="insp-addr" style="display:none"></div>
         <div id="insp-vals"><div class="sb-empty">Click a byte to inspect</div></div>
         <div id="insp-multi"></div>`;
}
function updateInspector() {
    const addrEl = document.getElementById('insp-addr');
    const valsEl = document.getElementById('insp-vals');
    if (!addrEl || !valsEl) {
        return;
    }
    if (state_1.S.selStart === null) {
        addrEl.style.display = 'none';
        valsEl.innerHTML = '<div class="sb-empty">Click a byte to inspect</div>';
        renderBits();
        renderMultiInline();
        return;
    }
    const len = (state_1.S.selEnd !== null && state_1.S.selEnd >= state_1.S.selStart) ? state_1.S.selEnd - state_1.S.selStart + 1 : 1;
    const val = state_1.S.flatBytes.get(state_1.S.selStart);
    // ── Address bar ──
    const ah = state_1.S.selStart.toString(16).toUpperCase().padStart(8, '0');
    addrEl.style.display = '';
    if (len === 1) {
        addrEl.innerHTML = `<span class="insp-addr-single">0x${ah}</span>`;
    }
    else {
        const endH = state_1.S.selEnd.toString(16).toUpperCase().padStart(8, '0');
        addrEl.innerHTML =
            `<span class="insp-addr-range">0x${ah}</span>` +
                `<span class="insp-addr-sep">–</span>` +
                `<span class="insp-addr-range">0x${endH}</span>` +
                `<span class="insp-addr-len">${len} bytes</span>`;
    }
    if (val === undefined) {
        valsEl.innerHTML = '<div class="sb-empty">No data at this address</div>';
        renderBits();
        renderMultiInline();
        return;
    }
    let html = '';
    if (len === 1) {
        // ── Single byte: hex · dec · ASCII, then nibble-grouped binary ──
        const hexStr = `0x${val.toString(16).toUpperCase().padStart(2, '0')}`;
        const binRaw = val.toString(2).padStart(8, '0');
        const binDisp = `${binRaw.slice(0, 4)} ${binRaw.slice(4)}`;
        const p = val >= 0x20 && val < 0x7F;
        const asciiChip = p
            ? `<span class="insp-ascii-chip">'${(0, utils_1.esc)(String.fromCharCode(val))}'</span>`
            : '';
        html =
            `<div class="insp-byte-row">` +
                `<span class="insp-hex-chip" data-copy="${(0, utils_1.esc)(hexStr)}" data-label="hex" title="Click to copy">${hexStr}</span>` +
                `<span class="insp-dec-chip" data-copy="${(0, utils_1.esc)(String(val))}" data-label="decimal" title="Click to copy">${val}</span>` +
                `${asciiChip}` +
                `</div>` +
                `<div class="insp-bin-row" data-copy="${(0, utils_1.esc)(binRaw)}" data-label="binary" title="Click to copy">${binDisp}</div>`;
        renderBits(val);
    }
    else {
        // ── Multi-byte: show raw byte dump only — typed values are in the interpreter below ──
        const selBytes = [];
        for (let a = state_1.S.selStart; a <= state_1.S.selEnd; a++) {
            selBytes.push(state_1.S.flatBytes.get(a) ?? 0);
        }
        const dumpBytes = selBytes.slice(0, 8);
        const dumpStr = dumpBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        const copyStr = len > 8 ? `${dumpStr} …` : dumpStr;
        html =
            `<div class="insp-raw-dump" data-copy="${(0, utils_1.esc)(copyStr)}" data-label="bytes" title="Click to copy">` +
                `${dumpStr}${len > 8 ? ' <span class="insp-dump-ellipsis">…</span>' : ''}` +
                `</div>`;
        renderBitsMulti(selBytes.slice(0, Math.min(len, 8)));
    }
    valsEl.innerHTML = html;
    // Wire click-to-copy on all data-copy elements inside the inspector values panel
    valsEl.querySelectorAll('[data-copy]').forEach(el => {
        el.addEventListener('click', () => {
            api_1.vscode.postMessage({ type: 'copyText', text: el.dataset.copy, label: el.dataset.label ?? 'value' });
        });
    });
    renderMultiInline();
}
// ── Bit viewer ────────────────────────────────────────────────────
/** Single-byte bit view. */
function renderBits(val) {
    const sec = document.getElementById('s-bits');
    if (val === undefined) {
        sec.innerHTML =
            `<div class="sb-hdr">Bit View</div>` +
                `<div class="sb-body"><div class="sb-empty">—</div></div>`;
    }
    else {
        const pc = popcount(val);
        sec.innerHTML =
            `<div class="sb-hdr">Bit View</div>` +
                `<div class="sb-body">` +
                `<div class="bitgrid-wrap">${bitIndexRow()}${byteRow(val, null)}</div>` +
                `<span class="bit-pc">${pc}/8 bits set</span></div>`;
    }
    wireBitColHover();
}
/** Multi-byte bit view — one 8-cell row per byte. */
function renderBitsMulti(bytes) {
    const sec = document.getElementById('s-bits');
    const rows = bytes.map((b, i) => byteRow(b, `[${i}]`)).join('');
    const total = bytes.reduce((s, b) => s + popcount(b), 0);
    sec.innerHTML =
        `<div class="sb-hdr">Bit View ` +
            `<span class="sb-badge" style="font-weight:400;opacity:.6">${bytes.length} byte${bytes.length > 1 ? 's' : ''}</span></div>` +
            `<div class="sb-body">` +
            `<div class="bitgrid-wrap">${bitIndexRow()}${rows}</div>` +
            `<span class="bit-pc">${total}/${bytes.length * 8} bits set</span></div>`;
    wireBitColHover();
}
function wireBitColHover() {
    const wrap = document.querySelector('#s-bits .bitgrid-wrap');
    if (!wrap) {
        return;
    }
    let active = null;
    const setCol = (bit) => {
        if (bit === active) {
            return;
        }
        active = bit;
        wrap.querySelectorAll('.bit-v').forEach(c => c.classList.toggle('bit-col-hi', c.dataset.bit === bit));
    };
    wrap.addEventListener('mouseover', e => {
        setCol(e.target.dataset.bit ?? null);
    });
    wrap.addEventListener('mouseleave', () => setCol(null));
}
function popcount(v) {
    let n = 0;
    let x = v >>> 0;
    while (x) {
        n += x & 1;
        x >>>= 1;
    }
    return n;
}
function bitIndexRow() {
    const cells = Array.from({ length: 8 }, (_, i) => `<div class="bit-idx">${7 - i}</div>`).join('');
    return `<div class="bit-row"><div></div>${cells}</div>`;
}
function byteRow(val, label) {
    const hexStr = val.toString(16).toUpperCase().padStart(2, '0');
    const cells = Array.from({ length: 8 }, (_, i) => {
        const bit = 7 - i;
        const on = (val >> bit) & 1;
        return `<div class="bit-v${on ? ' on' : ''}" data-bit="${bit}" title="bit ${bit} = ${on}"></div>`;
    }).join('');
    const lbl = label !== null
        ? `<div class="bit-lbl"><span class="bit-lbl-idx">${(0, utils_1.esc)(label)}</span><span class="bit-hex">0x${hexStr}</span></div>`
        : `<div class="bit-lbl"><span class="bit-hex">0x${hexStr}</span></div>`;
    return `<div class="bit-row">${lbl}${cells}</div>`;
}
// ── Multi-byte interpreter (inline, inside inspector) ─────────────
function renderMultiInline() {
    const el = document.getElementById('insp-multi');
    if (!el) {
        return;
    }
    if (state_1.S.selStart === null || state_1.S.flatBytes.get(state_1.S.selStart) === undefined) {
        el.innerHTML = '';
        return;
    }
    const selLen = (state_1.S.selEnd !== null && state_1.S.selEnd >= state_1.S.selStart) ? state_1.S.selEnd - state_1.S.selStart + 1 : 1;
    if (selLen < 2) {
        el.innerHTML = '';
        return;
    }
    // Upper-fit: map selection length to [2|4|8] — smallest type that holds it
    const width = selLen <= 2 ? 2 : selLen <= 4 ? 4 : 8;
    // Read selection bytes, zero-pad to width
    const raw = Array.from({ length: width }, (_, i) => {
        const v = state_1.S.flatBytes.get(state_1.S.selStart + i);
        return (i < selLen && v !== undefined) ? v : 0;
    });
    const le = state_1.S.endian === 'le';
    // ── Calculations ──
    const b0 = raw[0], b1 = raw[1];
    const u16 = (le ? ((b1 << 8) | b0) : ((b0 << 8) | b1)) >>> 0;
    const i16 = (u16 << 16) >> 16;
    const [a, b, c, d] = raw;
    const u32 = (le ? ((d << 24) | (c << 16) | (b << 8) | a)
        : ((a << 24) | (b << 16) | (c << 8) | d)) >>> 0;
    const i32 = le ? (d << 24) | (c << 16) | (b << 8) | a
        : (a << 24) | (b << 16) | (c << 8) | d;
    const buf32 = new ArrayBuffer(4);
    const dv32 = new DataView(buf32);
    (le ? [a, b, c, d] : [d, c, b, a]).forEach((v, i) => dv32.setUint8(i, v));
    const f32val = dv32.getFloat32(0, true);
    const buf64 = new ArrayBuffer(8);
    const dv64 = new DataView(buf64);
    (le ? raw : [...raw].reverse()).forEach((v, i) => dv64.setUint8(i, v));
    const f64val = dv64.getFloat64(0, true);
    function fmtF(v) {
        if (isNaN(v)) {
            return 'NaN';
        }
        if (!isFinite(v)) {
            return `${v > 0 ? '+' : ''}${v}`;
        }
        return parseFloat(v.toPrecision(7)).toString();
    }
    const fmtI = (v) => v.toLocaleString('en');
    const fmtH = (v, w) => `0x${v.toString(16).toUpperCase().padStart(w, '0')}`;
    const padNote = selLen < width
        ? `<span class="mi-pad-note">zero-padded to ${width * 8}-bit</span>` : '';
    const card = (type, primary, copy) => {
        return `<div class="mi-card">` +
            `<span class="mi-type">${type}</span>` +
            `<div class="mi-vals"><span class="mi-dec" data-copy="${(0, utils_1.esc)(copy)}" title="Click to copy">${primary}</span></div>` +
            `</div>`;
    };
    // Unsigned card — shows dec and hex stacked, each clickable to copy their value
    const ucard = (type, uVal, hexW) => {
        const dec = fmtI(uVal);
        const hex = fmtH(uVal, hexW);
        return `<div class="mi-card mi-ucard">` +
            `<span class="mi-type">${type}</span>` +
            `<div class="mi-vals">` +
            `<span class="mi-dec" data-copy="${(0, utils_1.esc)(String(uVal))}" title="Click to copy decimal">${dec}</span>` +
            `<span class="mi-hex" data-copy="${(0, utils_1.esc)(hex)}" title="Click to copy hex">${hex}</span>` +
            `</div>` +
            `</div>`;
    };
    let group = '';
    if (width === 2) {
        group =
            ucard('uint16', u16, 4) +
                card('int16', fmtI(i16), String(i16));
    }
    else if (width === 4) {
        group =
            ucard('uint32', u32, 8) +
                card('int32', fmtI(i32), String(i32)) +
                card('float32', fmtF(f32val), fmtF(f32val));
    }
    else {
        group =
            card('float64', fmtF(f64val), fmtF(f64val));
    }
    el.innerHTML =
        (width >= 2
            ? `<div class="mi-ctrl-row">` +
                `<span class="mi-ctrl-lbl">Byte order</span>` +
                `<div class="endian-tabs">` +
                `<button id="btn-le" class="${le ? 'active' : ''}">LE</button>` +
                `<button id="btn-be" class="${!le ? 'active' : ''}">BE</button>` +
                `</div></div>`
            : '') +
            (padNote ? `<div class="mi-pad-row">${padNote}</div>` : '') +
            `<div class="mi-group">${group}</div>`;
    document.getElementById('btn-le')?.addEventListener('click', () => { state_1.S.endian = 'le'; renderMultiInline(); });
    document.getElementById('btn-be')?.addEventListener('click', () => { state_1.S.endian = 'be'; renderMultiInline(); });
    // Copy decimal value (all cards)
    el.querySelectorAll('.mi-dec[data-copy]').forEach(span => {
        span.addEventListener('click', e => {
            e.stopPropagation();
            api_1.vscode.postMessage({ type: 'copyText', text: span.dataset.copy, label: 'decimal' });
        });
    });
    // Copy hex value (unsigned cards only)
    el.querySelectorAll('.mi-hex[data-copy]').forEach(span => {
        span.addEventListener('click', e => {
            e.stopPropagation();
            api_1.vscode.postMessage({ type: 'copyText', text: span.dataset.copy, label: 'hex' });
        });
    });
}
// ── Labels ────────────────────────────────────────────────────────
function renderLabels() {
    const sec = document.getElementById('s-labels');
    const badge = state_1.S.labels.length > 0 ? `<span class="sb-badge">${state_1.S.labels.length}</span>` : '';
    const items = state_1.S.labels.length === 0
        ? '<div class="sb-empty">No labels defined</div>'
        : state_1.S.labels.map((l, i) => `
            <div class="label-item${l.hidden ? ' label-hidden' : ''}" data-id="${l.id}">
                <div class="label-sw" style="background:${l.hidden ? 'transparent' : l.color};border:1px solid ${l.color}"></div>
                <div class="label-inf">
                    <div class="label-nm">${(0, utils_1.esc)(l.name)}</div>
                    <div class="label-rng">0x${l.startAddress.toString(16).toUpperCase().padStart(8, '0')} &middot; ${(0, utils_1.fmtB)(l.length)}</div>
                </div>
                <span class="label-act label-vis" data-id="${l.id}" data-hidden="${l.hidden ? '1' : '0'}" title="${l.hidden ? 'Show' : 'Hide'}">${l.hidden ? '&#128065;&#xFE0E;' : '&#128065;'}</span>
                <span class="label-act label-up"  data-id="${l.id}" title="Move up"   ${i === 0 ? 'style="opacity:.3;pointer-events:none"' : ''}>&#8593;</span>
                <span class="label-act label-dn"  data-id="${l.id}" title="Move down" ${i === state_1.S.labels.length - 1 ? 'style="opacity:.3;pointer-events:none"' : ''}>&#8595;</span>
                <span class="label-act label-edt" data-id="${l.id}" title="Edit">&#9998;</span>
                <span class="label-act label-del" data-id="${l.id}" title="Remove">&#10005;</span>
            </div>`).join('');
    sec.innerHTML = `
        <div class="sb-hdr">Labels ${badge}</div>
        ${items}
        <button class="add-lbl-btn" id="btn-add-lbl">+ Add Segment Label</button>`;
    // Delete
    sec.querySelectorAll('.label-del').forEach(el => {
        el.addEventListener('click', () => {
            state_1.S.labels = state_1.S.labels.filter(l => l.id !== el.dataset.id);
            api_1.vscode.postMessage({ type: 'saveLabels', labels: state_1.S.labels });
            (0, data_1.buildMemRows)();
            render_1.rerender.labels();
            if (state_1.S.currentView === 'memory') {
                render_1.rerender.memory();
            }
        });
    });
    // Edit — open inline form
    sec.querySelectorAll('.label-edt').forEach(el => {
        el.addEventListener('click', () => renderLabelForm(el.dataset.id));
    });
    // Toggle visibility
    sec.querySelectorAll('.label-vis').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.id;
            const hidden = el.dataset.hidden === '1' ? false : true;
            state_1.S.labels = state_1.S.labels.map(l => l.id === id ? { ...l, hidden } : l);
            api_1.vscode.postMessage({ type: 'saveLabels', labels: state_1.S.labels });
            (0, data_1.buildMemRows)();
            render_1.rerender.labels();
            if (state_1.S.currentView === 'memory') {
                render_1.rerender.memory();
            }
        });
    });
    // Move up
    sec.querySelectorAll('.label-up').forEach(el => {
        el.addEventListener('click', () => {
            const idx = state_1.S.labels.findIndex(l => l.id === el.dataset.id);
            if (idx <= 0) {
                return;
            }
            const next = [...state_1.S.labels];
            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
            state_1.S.labels = next;
            api_1.vscode.postMessage({ type: 'saveLabels', labels: state_1.S.labels });
            (0, data_1.buildMemRows)();
            render_1.rerender.labels();
            if (state_1.S.currentView === 'memory') {
                render_1.rerender.memory();
            }
        });
    });
    // Move down
    sec.querySelectorAll('.label-dn').forEach(el => {
        el.addEventListener('click', () => {
            const idx = state_1.S.labels.findIndex(l => l.id === el.dataset.id);
            if (idx < 0 || idx >= state_1.S.labels.length - 1) {
                return;
            }
            const next = [...state_1.S.labels];
            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
            state_1.S.labels = next;
            api_1.vscode.postMessage({ type: 'saveLabels', labels: state_1.S.labels });
            (0, data_1.buildMemRows)();
            render_1.rerender.labels();
            if (state_1.S.currentView === 'memory') {
                render_1.rerender.memory();
            }
        });
    });
    // Add — open inline form
    document.getElementById('btn-add-lbl')?.addEventListener('click', () => renderLabelForm());
}
// ── Label inline form ─────────────────────────────────────────────
function renderLabelForm(editId) {
    const sec = document.getElementById('s-labels');
    const editing = editId ? state_1.S.labels.find(l => l.id === editId) : undefined;
    const COLORS = [
        { name: 'Sky Blue', v: '#4fc3f7' }, { name: 'Green', v: '#81c784' },
        { name: 'Orange', v: '#ffb74d' }, { name: 'Red', v: '#e57373' },
        { name: 'Purple', v: '#ce93d8' }, { name: 'Teal', v: '#80cbc4' },
        { name: 'Yellow', v: '#fff176' }, { name: 'Pink', v: '#f48fb1' },
    ];
    const fh = (n) => `0x${n.toString(16).toUpperCase().padStart(8, '0')}`;
    let chosenColor = editing?.color ?? COLORS[state_1.S.labels.length % COLORS.length].v;
    const defaultStart = editing ? fh(editing.startAddress)
        : (state_1.S.selStart !== null ? fh(state_1.S.selStart) : '');
    const defaultRange = editing ? `${editing.length}`
        : (state_1.S.selStart !== null && state_1.S.selEnd !== null ? `${state_1.S.selEnd - state_1.S.selStart + 1}` : '');
    const swatchHtml = COLORS.map(c => `<span class="lf-swatch${c.v === chosenColor ? ' selected' : ''}" data-color="${c.v}" style="background:${c.v}" title="${c.name}"></span>`).join('');
    sec.innerHTML = `
        <div class="sb-hdr">${editing ? 'Edit Label' : 'New Label'}</div>
        <div class="lbl-form">
            <div class="lf-field">
                <span class="lf-lbl">Name</span>
                <input id="lf-name" class="lf-input" type="text" placeholder="My Segment" value="${(0, utils_1.esc)(editing?.name ?? '')}">
            </div>
            <div class="lf-field">
                <span class="lf-lbl">Start address</span>
                <input id="lf-start" class="lf-input" type="text" placeholder="0x08000000" value="${defaultStart}">
            </div>
            <div class="lf-field">
                <span class="lf-lbl">Range</span>
                <div class="lf-range-row">
                    <div class="lf-mode-grp">
                        <button class="lf-mode active" data-mode="len">Length</button>
                        <button class="lf-mode" data-mode="end">End addr</button>
                    </div>
                    <input id="lf-range" class="lf-input" type="text" placeholder="512" value="${defaultRange}">
                </div>
            </div>
            <div class="lf-field">
                <span class="lf-lbl">Color</span>
                <div class="lf-swatches">${swatchHtml}</div>
            </div>
            <div class="lf-warn" id="lf-warn"></div>
            <div class="lf-actions">
                <button class="lf-btn lf-save" id="lf-save">${editing ? 'Update' : 'Add'}</button>
                <button class="lf-btn lf-cancel" id="lf-cancel">Cancel</button>
            </div>
        </div>`;
    let rangeMode = 'len';
    let pendingWarning = false;
    const warnEl = () => document.getElementById('lf-warn');
    const nameEl = () => document.getElementById('lf-name');
    const startEl = () => document.getElementById('lf-start');
    const rangeEl = () => document.getElementById('lf-range');
    // Color swatches
    sec.querySelectorAll('.lf-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            sec.querySelectorAll('.lf-swatch').forEach(s => s.classList.remove('selected'));
            sw.classList.add('selected');
            chosenColor = sw.dataset.color;
        });
    });
    // Range mode toggle
    sec.querySelectorAll('.lf-mode').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('active')) {
                return;
            }
            sec.querySelectorAll('.lf-mode').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const prev = rangeMode;
            rangeMode = btn.dataset.mode;
            const s = parseInt(startEl().value.replace(/^0x/i, ''), 16);
            if (prev === 'len' && rangeMode === 'end') {
                rangeEl().placeholder = '0x0800FFFF';
                const l = parseInt(rangeEl().value, 10);
                rangeEl().value = (!isNaN(s) && !isNaN(l) && l > 0) ? fh(s + l - 1) : '';
            }
            else {
                rangeEl().placeholder = '512';
                const e = parseInt(rangeEl().value.replace(/^0x/i, ''), 16);
                rangeEl().value = (!isNaN(s) && !isNaN(e) && e >= s) ? `${e - s + 1}` : (editing ? `${editing.length}` : '');
            }
            pendingWarning = false;
            warnEl().textContent = '';
        });
    });
    // Clear warning on input change
    ['lf-name', 'lf-start', 'lf-range'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            pendingWarning = false;
            warnEl().textContent = '';
        });
    });
    // Cancel
    document.getElementById('lf-cancel')?.addEventListener('click', () => renderLabels());
    // Save
    document.getElementById('lf-save')?.addEventListener('click', () => {
        warnEl().textContent = '';
        const name = nameEl().value.trim();
        if (!name) {
            warnEl().textContent = 'Name is required.';
            return;
        }
        const startAddress = parseInt(startEl().value.replace(/^0x/i, ''), 16);
        if (isNaN(startAddress)) {
            warnEl().textContent = 'Invalid start address.';
            return;
        }
        let length;
        if (rangeMode === 'end') {
            const end = parseInt(rangeEl().value.replace(/^0x/i, ''), 16);
            if (isNaN(end) || end < startAddress) {
                warnEl().textContent = 'Invalid end address.';
                return;
            }
            length = end - startAddress + 1;
        }
        else {
            length = /^0x/i.test(rangeEl().value) ? parseInt(rangeEl().value, 16) : parseInt(rangeEl().value, 10);
            if (isNaN(length) || length <= 0) {
                warnEl().textContent = 'Invalid length.';
                return;
            }
        }
        if (!pendingWarning) {
            const segs = state_1.S.parseResult?.segments ?? [];
            const segEnd = startAddress + length - 1;
            if (segs.length > 0 && !segs.some(s => startAddress <= s.startAddress + s.data.length - 1 && segEnd >= s.startAddress)) {
                warnEl().textContent = 'Range is outside mapped data. Click Save again to confirm.';
                pendingWarning = true;
                return;
            }
            const overlap = state_1.S.labels.filter(l => l.id !== editId &&
                startAddress <= l.startAddress + l.length - 1 &&
                segEnd >= l.startAddress);
            if (overlap.length > 0) {
                warnEl().textContent = `Overlaps with: ${overlap.map(l => `"${(0, utils_1.esc)(l.name)}"`).join(', ')}. Click Save again.`;
                pendingWarning = true;
                return;
            }
        }
        const label = {
            id: editId ?? `lbl_${Date.now()}`,
            name, startAddress, length, color: chosenColor,
            hidden: editing?.hidden,
        };
        state_1.S.labels = editId
            ? state_1.S.labels.map(l => l.id === editId ? label : l)
            : [...state_1.S.labels, label];
        api_1.vscode.postMessage({ type: 'saveLabels', labels: state_1.S.labels });
        (0, data_1.buildMemRows)();
        render_1.rerender.labels();
        if (state_1.S.currentView === 'memory') {
            render_1.rerender.memory();
        }
    });
}
//# sourceMappingURL=sidebar.js.map