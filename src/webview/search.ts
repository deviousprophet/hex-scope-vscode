// ── Search ────────────────────────────────────────────────────────
// Hex / ASCII / UTF-8 search with match navigation

import { S } from './state';
import { applyMatchHighlights, scrollTo } from './memoryView';
import { SearchEngine } from './searchEngine';

let _switchToMemory: (() => void) | null = null;
const engine = new SearchEngine();

export function initSearch(switchToMemory: () => void): void {
    _switchToMemory = switchToMemory;
}

// ── Run search ────────────────────────────────────────────────────

export function runSearch(): void {
    const raw = (document.getElementById('search-input') as HTMLInputElement | null)?.value ?? '';
    S.matchAddrs = [];
    S.matchIdx   = -1;

    if (raw.trim() === '') {
        engine.clear();
        applyMatchHighlights();
        updMC();
        return;
    }

    applyMatchHighlights();
    engine.search(
        {
            mode: S.searchMode,
            raw,
            addrs: S.sortedAddrs,
            getByte: (addr: number) => S.flatBytes.get(addr),
        },
        {
            onStatus: updMC,
            onComplete: (matches: number[]) => {
                S.matchAddrs = matches;
                S.matchIdx = matches.length > 0 ? 0 : -1;
                applyMatchHighlights();
                scrollToMatch();
                updMC();
            },
        }
    );
}

export function clearSearch(): void {
    engine.clear();
    S.matchAddrs = [];
    S.matchIdx   = -1;
    const inp = document.getElementById('search-input') as HTMLInputElement | null;
    if (inp) { inp.value = ''; }
    applyMatchHighlights();
    updMC();
}

export function nextMatch(): void {
    if (S.matchAddrs.length === 0) { return; }
    S.matchIdx = (S.matchIdx + 1) % S.matchAddrs.length;
    goToMatch();
}

export function prevMatch(): void {
    if (S.matchAddrs.length === 0) { return; }
    S.matchIdx = (S.matchIdx - 1 + S.matchAddrs.length) % S.matchAddrs.length;
    goToMatch();
}

export function updMC(statusText?: string): void {
    updMCInternal(statusText);
}

function updMCInternal(statusText?: string): void {
    const el = document.getElementById('match-count');
    if (!el) { return; }
    if (statusText) {
        el.textContent = statusText;
        return;
    }
    if (S.matchAddrs.length === 0) {
        el.textContent = '';
    } else {
        el.textContent = `${S.matchIdx + 1} / ${S.matchAddrs.length}`;
    }
}

// ── Private ───────────────────────────────────────────────────────

function goToMatch(): void {
    if (S.currentView !== 'memory') {
        if (_switchToMemory) { _switchToMemory(); }
    } else {
        applyMatchHighlights();
    }
    scrollToMatch();
    updMC();
}

function scrollToMatch(): void {
    if (S.matchIdx >= 0 && S.matchAddrs.length > 0) {
        scrollTo(S.matchAddrs[S.matchIdx]);
    }
}
