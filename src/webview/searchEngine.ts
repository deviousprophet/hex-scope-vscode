// Combined SearchEngine + UI glue
import { S } from './state';
import { applyMatchHighlights, scrollTo } from './memoryView';
import type { SearchEndianness, SearchMode } from './types';

export interface SearchRequest {
    mode: SearchMode;
    raw: string;
    addrs: number[];
    getByte: (addr: number) => number | undefined;
    endianness?: SearchEndianness;
}

export interface SearchHandlers {
    onStatus?: (text: string) => void;
    onComplete: (matches: number[]) => void;
}

const SEARCH_DEBOUNCE_MS = 120;
const SEARCH_CHUNK_BUDGET_MS = 10;

export class SearchEngine {
    private token = 0;
    private debounceHandle: number | null = null;
    private chunkHandle: number | null = null;

    private lastMode: SearchMode | null = null;
    private lastByteNeedleLength = 0;
    private lastByteNeedles: number[][] = [];
    private lastByteMatches: number[] = [];
    private lastAddrQuery = '';
    private lastAddrMatches: number[] = [];

    public search(req: SearchRequest, handlers: SearchHandlers): void {
        this.cancelPending();

        const raw = req.raw ?? '';
        if (raw.trim() === '') {
            this.resetCache();
            handlers.onComplete([]);
            return;
        }

        const token = ++this.token;
        handlers.onStatus?.('Searching...');

        this.debounceHandle = window.setTimeout(() => {
            this.debounceHandle = null;
            if (req.mode === 'addr') {
                this.runAddressSearch(token, req, handlers);
                return;
            }
            this.runByteSearch(token, req, handlers);
        }, SEARCH_DEBOUNCE_MS);
    }

    public clear(): void {
        this.cancelPending();
        this.resetCache();
    }

    private runByteSearch(token: number, req: SearchRequest, handlers: SearchHandlers): void {
        const needles = buildNeedles(req.mode, req.raw, req.endianness ?? 'le');
        if (needles.length === 0) {
            this.lastMode = req.mode;
            this.lastByteNeedleLength = 0;
            this.lastByteNeedles = [];
            this.lastByteMatches = [];
            handlers.onComplete([]);
            return;
        }

        const needleLen = needles[0].length;
        const canRefine =
            this.lastMode === req.mode &&
            this.lastByteMatches.length > 0 &&
            needleLen >= this.lastByteNeedleLength;

        const candidates = canRefine ? this.lastByteMatches : req.addrs;
        const matches: number[] = [];

        let index = 0;
        const step = (): void => {
            if (token !== this.token) { return; }

            const deadline = performance.now() + SEARCH_CHUNK_BUDGET_MS;
            while (index < candidates.length && performance.now() < deadline) {
                const startAddr = candidates[index];
                for (const needle of needles) {
                    if (matchSequence(req.getByte, startAddr, needle)) { matches.push(startAddr); break; }
                }
                index++;
            }

            if (index < candidates.length) {
                this.chunkHandle = window.setTimeout(step, 0);
                return;
            }

            this.chunkHandle = null;
            if (token !== this.token) { return; }

            this.lastMode = req.mode;
            this.lastByteNeedleLength = needleLen;
            this.lastByteNeedles = needles;
            this.lastByteMatches = matches;
            handlers.onComplete(matches);
        };

        step();
    }

    private runAddressSearch(token: number, req: SearchRequest, handlers: SearchHandlers): void {
        const query = normalizeAddrQuery(req.raw);
        if (!query) {
            this.lastMode = 'addr';
            this.lastAddrQuery = '';
            this.lastAddrMatches = [];
            handlers.onComplete([]);
            return;
        }

        const canRefine =
            this.lastMode === 'addr' &&
            this.lastAddrQuery.length > 0 &&
            query.startsWith(this.lastAddrQuery);

        const candidates = canRefine ? this.lastAddrMatches : req.addrs;
        const matches: number[] = [];

        let index = 0;
        const step = (): void => {
            if (token !== this.token) { return; }

            const deadline = performance.now() + SEARCH_CHUNK_BUDGET_MS;
            while (index < candidates.length && performance.now() < deadline) {
                const addr = candidates[index];
                if (addr.toString(16).toUpperCase().startsWith(query)) {
                    matches.push(addr);
                }
                index++;
            }

            if (index < candidates.length) {
                this.chunkHandle = window.setTimeout(step, 0);
                return;
            }

            this.chunkHandle = null;
            if (token !== this.token) { return; }

            this.lastMode = 'addr';
            this.lastAddrQuery = query;
            this.lastAddrMatches = matches;
            handlers.onComplete(matches);
        };

        step();
    }

    private cancelPending(): void {
        this.token++;
        if (this.debounceHandle !== null) {
            window.clearTimeout(this.debounceHandle);
            this.debounceHandle = null;
        }
        if (this.chunkHandle !== null) {
            window.clearTimeout(this.chunkHandle);
            this.chunkHandle = null;
        }
    }

    private resetCache(): void {
        this.lastMode = null;
        this.lastByteNeedleLength = 0;
        this.lastByteNeedles = [];
        this.lastByteMatches = [];
        this.lastAddrQuery = '';
        this.lastAddrMatches = [];
    }
}

function matchSequence(getByte: (addr: number) => number | undefined, startAddr: number, needle: number[]): boolean {
    for (let i = 0; i < needle.length; i++) {
        if (getByte(startAddr + i) !== needle[i]) {
            return false;
        }
    }
    return true;
}

function normalizeAddrQuery(raw: string): string | null {
    const s = raw.trim().replace(/^0x/i, '');
    if (s.length === 0) { return null; }
    if (!/^[0-9a-fA-F]{1,8}$/.test(s)) { return null; }
    return s.toUpperCase();
}

function buildNeedles(mode: SearchMode, raw: string, endianness: SearchEndianness): number[][] {
    if (mode === 'hex') {
        const tokens = raw.replace(/\s/g, '').match(/.{1,2}/g) ?? [];
        const bytes: number[] = [];
        for (const tok of tokens) {
            const v = parseInt(tok, 16);
            if (isNaN(v) || v < 0 || v > 255) { return []; }
            bytes.push(v);
        }
        if (bytes.length === 0) { return []; }
        if (endianness === 'be') {
            return [bytes];
        }
        return [[...bytes].reverse()];
    }

    if (mode === 'ascii') {
        return [Array.from(new TextEncoder().encode(raw))];
    }

    return [];
}

// -------------------- UI glue (previously in search.ts) --------------------

let _switchToMemory: (() => void) | null = null;
const engine = new SearchEngine();

export function initSearch(switchToMemory: () => void): void {
    _switchToMemory = switchToMemory;
}

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
            endianness: S.searchEndianness,
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

