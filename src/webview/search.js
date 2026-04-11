"use strict";
// ── Search ────────────────────────────────────────────────────────
// Hex / ASCII / UTF-8 search with match navigation
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSearch = initSearch;
exports.runSearch = runSearch;
exports.clearSearch = clearSearch;
exports.nextMatch = nextMatch;
exports.prevMatch = prevMatch;
exports.updMC = updMC;
const state_1 = require("./state");
const memoryView_1 = require("./memoryView");
let _switchToMemory = null;
function initSearch(switchToMemory) {
    _switchToMemory = switchToMemory;
}
// ── Run search ────────────────────────────────────────────────────
function runSearch() {
    const raw = document.getElementById('search-input')?.value ?? '';
    state_1.S.matchAddrs = [];
    state_1.S.matchIdx = -1;
    if (raw.trim() === '') {
        (0, memoryView_1.applyMatchHighlights)();
        updMC();
        return;
    }
    if (state_1.S.searchMode === 'addr') {
        const addr = parseAddr(raw.trim());
        if (addr !== null && state_1.S.flatBytes.has(addr)) {
            state_1.S.matchAddrs = [addr];
            state_1.S.matchIdx = 0;
        }
        (0, memoryView_1.applyMatchHighlights)();
        scrollToMatch();
        updMC();
        return;
    }
    const needle = buildNeedle(raw);
    if (needle.length === 0) {
        (0, memoryView_1.applyMatchHighlights)();
        updMC();
        return;
    }
    const addrs = state_1.S.sortedAddrs;
    for (let i = 0; i <= addrs.length - needle.length; i++) {
        let match = true;
        for (let j = 0; j < needle.length; j++) {
            if (state_1.S.flatBytes.get(addrs[i + j]) !== needle[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            state_1.S.matchAddrs.push(addrs[i]);
        }
    }
    if (state_1.S.matchAddrs.length > 0) {
        state_1.S.matchIdx = 0;
    }
    (0, memoryView_1.applyMatchHighlights)();
    scrollToMatch();
    updMC();
}
function clearSearch() {
    state_1.S.matchAddrs = [];
    state_1.S.matchIdx = -1;
    const inp = document.getElementById('search-input');
    if (inp) {
        inp.value = '';
    }
    (0, memoryView_1.applyMatchHighlights)();
    updMC();
}
function nextMatch() {
    if (state_1.S.matchAddrs.length === 0) {
        return;
    }
    state_1.S.matchIdx = (state_1.S.matchIdx + 1) % state_1.S.matchAddrs.length;
    goToMatch();
}
function prevMatch() {
    if (state_1.S.matchAddrs.length === 0) {
        return;
    }
    state_1.S.matchIdx = (state_1.S.matchIdx - 1 + state_1.S.matchAddrs.length) % state_1.S.matchAddrs.length;
    goToMatch();
}
function updMC() {
    const el = document.getElementById('match-count');
    if (!el) {
        return;
    }
    if (state_1.S.matchAddrs.length === 0) {
        el.textContent = '';
    }
    else {
        el.textContent = `${state_1.S.matchIdx + 1} / ${state_1.S.matchAddrs.length}`;
    }
}
// ── Private ───────────────────────────────────────────────────────
function goToMatch() {
    if (state_1.S.currentView !== 'memory') {
        if (_switchToMemory) {
            _switchToMemory();
        }
    }
    else {
        (0, memoryView_1.applyMatchHighlights)();
    }
    scrollToMatch();
    updMC();
}
function scrollToMatch() {
    if (state_1.S.matchIdx >= 0 && state_1.S.matchAddrs.length > 0) {
        (0, memoryView_1.scrollTo)(state_1.S.matchAddrs[state_1.S.matchIdx]);
    }
}
function buildNeedle(raw) {
    const mode = state_1.S.searchMode;
    if (mode === 'hex') {
        const tokens = raw.replace(/\s/g, '').match(/.{1,2}/g) ?? [];
        const bytes = [];
        for (const tok of tokens) {
            const v = parseInt(tok, 16);
            if (isNaN(v) || v < 0 || v > 255) {
                return [];
            }
            bytes.push(v);
        }
        return bytes;
    }
    // ascii / utf8 — encode as UTF-8
    return Array.from(new TextEncoder().encode(raw));
}
function parseAddr(raw) {
    const s = raw.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{1,8}$/.test(s)) {
        return null;
    }
    const v = parseInt(s, 16);
    return isNaN(v) ? null : v;
}
//# sourceMappingURL=search.js.map