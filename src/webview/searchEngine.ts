import type { SearchMode } from './types';

export interface SearchRequest {
    mode: SearchMode;
    raw: string;
    addrs: number[];
    getByte: (addr: number) => number | undefined;
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
    private lastByteNeedle: number[] = [];
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
        const needle = buildNeedle(req.mode, req.raw);
        if (needle.length === 0) {
            this.lastMode = req.mode;
            this.lastByteNeedle = [];
            this.lastByteMatches = [];
            handlers.onComplete([]);
            return;
        }

        const canRefine =
            this.lastMode === req.mode &&
            this.lastByteNeedle.length > 0 &&
            needle.length >= this.lastByteNeedle.length &&
            startsWithNeedle(needle, this.lastByteNeedle);

        const candidates = canRefine ? this.lastByteMatches : req.addrs;
        const matches: number[] = [];

        let index = 0;
        const step = (): void => {
            if (token !== this.token) { return; }

            const deadline = performance.now() + SEARCH_CHUNK_BUDGET_MS;
            while (index < candidates.length && performance.now() < deadline) {
                const startAddr = candidates[index];
                if (matchSequence(req.getByte, startAddr, needle)) {
                    matches.push(startAddr);
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
            this.lastByteNeedle = needle;
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
        this.lastByteNeedle = [];
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

function startsWithNeedle(needle: number[], prefix: number[]): boolean {
    if (prefix.length > needle.length) { return false; }
    for (let i = 0; i < prefix.length; i++) {
        if (needle[i] !== prefix[i]) { return false; }
    }
    return true;
}

function normalizeAddrQuery(raw: string): string | null {
    const s = raw.trim().replace(/^0x/i, '');
    if (s.length === 0) { return null; }
    if (!/^[0-9a-fA-F]{1,8}$/.test(s)) { return null; }
    return s.toUpperCase();
}

function buildNeedle(mode: SearchMode, raw: string): number[] {
    if (mode === 'hex') {
        const tokens = raw.replace(/\s/g, '').match(/.{1,2}/g) ?? [];
        const bytes: number[] = [];
        for (const tok of tokens) {
            const v = parseInt(tok, 16);
            if (isNaN(v) || v < 0 || v > 255) { return []; }
            bytes.push(v);
        }
        return bytes;
    }

    if (mode === 'ascii') {
        return Array.from(new TextEncoder().encode(raw));
    }

    return [];
}
