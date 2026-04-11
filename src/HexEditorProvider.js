"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HexEditorProvider = void 0;
exports.detectFormatFromParts = detectFormatFromParts;
exports.serializeSRec = serializeSRec;
exports.buildSRecDataRecord = buildSRecDataRecord;
exports.repairChecksums = repairChecksums;
const crypto = __importStar(require("crypto"));
const vscode = __importStar(require("vscode"));
const IntelHexParser_1 = require("./parser/IntelHexParser");
const SRecParser_1 = require("./parser/SRecParser");
class HexEditorProvider {
    _context;
    static viewType = 'hexScope.hexEditor';
    static _activePanel;
    /** Post a message to the currently active HexScope webview, if any. */
    static postToActive(msg) {
        HexEditorProvider._activePanel?.webview.postMessage(msg);
    }
    constructor(_context) {
        this._context = _context;
    }
    static register(context) {
        return vscode.window.registerCustomEditorProvider(HexEditorProvider.viewType, new HexEditorProvider(context), {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: false,
        });
    }
    async openCustomDocument(uri, _openContext, _token) {
        return { uri, dispose: () => { } };
    }
    async resolveCustomEditor(document, webviewPanel, _token) {
        webviewPanel.webview.options = { enableScripts: true };
        let raw = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(document.uri));
        const format = detectFormat(document.uri, raw);
        let parseResult = format === 'srec' ? (0, SRecParser_1.parseSRec)(raw) : (0, IntelHexParser_1.parseIntelHex)(raw);
        webviewPanel.webview.html = this._getHtml(webviewPanel.webview, document.uri, parseResult);
        // Load segment labels from workspace state
        const labelKey = `hexScope.labels.${document.uri.toString()}`;
        const storedLabels = this._context.workspaceState.get(labelKey, []);
        // Load struct definitions from workspace state
        const structKey = `hexScope.structs.${document.uri.toString()}`;
        const structPinKey = `hexScope.structPins.${document.uri.toString()}`;
        const postInit = () => webviewPanel.webview.postMessage({
            type: 'init',
            parseResult: serializeParseResult(parseResult, format),
            labels: this._context.workspaceState.get(labelKey, []),
            structs: this._context.workspaceState.get(structKey, []),
            structPins: this._context.workspaceState.get(structPinKey, []),
            rawSource: raw,
        });
        // Post initial data to webview
        postInit();
        // ── Live reload on external file changes ──────────────────────────
        // suppress the single watcher event caused by our own writes
        let suppressReload = false;
        let reloadTimer;
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.joinPath(document.uri, '..'), document.uri.path.split('/').pop()));
        const onExternalChange = () => {
            if (suppressReload) {
                suppressReload = false;
                return;
            }
            clearTimeout(reloadTimer);
            reloadTimer = setTimeout(async () => {
                try {
                    const newRaw = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(document.uri));
                    const newResult = format === 'srec' ? (0, SRecParser_1.parseSRec)(newRaw) : (0, IntelHexParser_1.parseIntelHex)(newRaw);
                    // Send as 'externalChange' so the webview can guard against
                    // overwriting unsaved edits
                    webviewPanel.webview.postMessage({
                        type: 'externalChange',
                        parseResult: serializeParseResult(newResult, format),
                        labels: this._context.workspaceState.get(labelKey, []),
                        rawSource: newRaw,
                    });
                    // Update provider-side state only after webview accepts it
                    // (done on 'reloadAccepted' response below)
                }
                catch { /* file transiently unavailable */ }
            }, 200);
        };
        watcher.onDidChange(onExternalChange);
        watcher.onDidCreate(onExternalChange);
        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'copyText':
                    await vscode.env.clipboard.writeText(msg.text);
                    vscode.window.showInformationMessage(`Copied: ${msg.label ?? ''}`);
                    break;
                case 'saveLabels': {
                    await this._context.workspaceState.update(labelKey, msg.labels);
                    break;
                }
                case 'saveStructs': {
                    await this._context.workspaceState.update(structKey, msg.structs);
                    break;
                }
                case 'saveStructPins': {
                    await this._context.workspaceState.update(structPinKey, msg.pins);
                    break;
                }
                case 'updateLabelVisibility': {
                    const current = this._context.workspaceState.get(labelKey, []);
                    const next = current.map(l => l.id === msg.id ? { ...l, hidden: msg.hidden } : l);
                    await this._context.workspaceState.update(labelKey, next);
                    break;
                }
                case 'reorderLabel': {
                    const current = this._context.workspaceState.get(labelKey, []);
                    const idx = current.findIndex(l => l.id === msg.id);
                    if (idx < 0) {
                        break;
                    }
                    const next = [...current];
                    const dir = msg.dir;
                    const swap = idx + dir;
                    if (swap < 0 || swap >= next.length) {
                        break;
                    }
                    [next[idx], next[swap]] = [next[swap], next[idx]];
                    await this._context.workspaceState.update(labelKey, next);
                    // Labels already updated client-side; just persist
                    break;
                }
                case 'saveEdits': {
                    // msg.edits: Array<[addr: number, value: number]>
                    const edits = msg.edits;
                    const editMap = new Map(edits);
                    const newHex = format === 'srec'
                        ? serializeSRec(raw, parseResult, editMap)
                        : serializeIntelHex(raw, parseResult, editMap);
                    suppressReload = true;
                    await vscode.workspace.fs.writeFile(document.uri, new TextEncoder().encode(newHex));
                    // Update in-memory state to the saved content
                    raw = newHex;
                    parseResult = format === 'srec' ? (0, SRecParser_1.parseSRec)(raw) : (0, IntelHexParser_1.parseIntelHex)(raw);
                    webviewPanel.webview.postMessage({ type: 'savedEdits' });
                    vscode.window.showInformationMessage(`HexScope: saved ${edits.length} byte${edits.length === 1 ? '' : 's'} to ${document.uri.fsPath.split(/[\/\\]/).pop()}`);
                    break;
                }
                case 'repairChecksums': {
                    const repairedRaw = repairChecksums(raw, parseResult);
                    suppressReload = true;
                    await vscode.workspace.fs.writeFile(document.uri, new TextEncoder().encode(repairedRaw));
                    const fixedCount = parseResult.checksumErrors;
                    // Update in-memory state to the repaired content
                    raw = repairedRaw;
                    parseResult = format === 'srec' ? (0, SRecParser_1.parseSRec)(raw) : (0, IntelHexParser_1.parseIntelHex)(raw);
                    postInit();
                    vscode.window.showInformationMessage(`HexScope: repaired ${fixedCount} checksum${fixedCount === 1 ? '' : 's'} in ${document.uri.fsPath.split(/[\/\\]/).pop()}`);
                    break;
                }
                case 'reloadAccepted': {
                    // Webview confirmed it is safe to apply the pending external change
                    raw = msg.rawSource;
                    parseResult = format === 'srec' ? (0, SRecParser_1.parseSRec)(raw) : (0, IntelHexParser_1.parseIntelHex)(raw);
                    break;
                }
            }
        });
        webviewPanel.onDidChangeViewState(e => {
            if (e.webviewPanel.active) {
                HexEditorProvider._activePanel = webviewPanel;
            }
        });
        webviewPanel.onDidDispose(() => {
            watcher.dispose();
            clearTimeout(reloadTimer);
            if (HexEditorProvider._activePanel === webviewPanel) {
                HexEditorProvider._activePanel = undefined;
            }
        });
    }
    _getHtml(webview, _uri, _parseResult) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview.js'));
        const cssFiles = [
            'base', 'toolbar', 'layout', 'sidebar',
            'record-view', 'memory-view', 'raw-view', 'context-menu', 'struct',
        ];
        const cssLinks = cssFiles.map(name => {
            const uri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'src', 'webview', `${name}.css`));
            return `    <link rel="stylesheet" href="${uri}">`;
        }).join('\n');
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
${cssLinks}
    <title>HexScope</title>
</head>
<body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
exports.HexEditorProvider = HexEditorProvider;
function serializeParseResult(result, format) {
    return {
        records: result.records.map(r => ({
            lineNumber: r.lineNumber,
            raw: r.raw,
            byteCount: r.byteCount,
            address: r.address,
            recordType: r.recordType,
            data: Array.from(r.data),
            checksum: r.checksum,
            checksumValid: r.checksumValid,
            resolvedAddress: r.resolvedAddress,
            error: r.error,
        })),
        segments: result.segments.map(s => ({
            startAddress: s.startAddress,
            data: Array.from(s.data),
        })),
        totalDataBytes: result.totalDataBytes,
        checksumErrors: result.checksumErrors,
        malformedLines: result.malformedLines,
        startAddress: result.startAddress,
        format,
    };
}
/** Rebuild an Intel HEX file from original parse + a map of addr→newValue overrides. */
function serializeIntelHex(originalRaw, parseResult, edits) {
    if (edits.size === 0) {
        return originalRaw;
    }
    const eol = originalRaw.includes('\r\n') ? '\r\n' : '\n';
    const lines = [];
    for (const rec of parseResult.records) {
        if (rec.error || rec.recordType !== 0 /* Data */) {
            lines.push(rec.raw);
            continue;
        }
        // Apply any edits that fall inside this record
        const data = Array.from(rec.data);
        let changed = false;
        for (let i = 0; i < data.length; i++) {
            const addr = rec.resolvedAddress + i;
            if (edits.has(addr)) {
                data[i] = edits.get(addr);
                changed = true;
            }
        }
        if (!changed) {
            lines.push(rec.raw);
            continue;
        }
        // Rebuild the record line with updated data + recomputed checksum
        lines.push(buildDataRecord(rec.address, data));
    }
    return lines.join(eol);
}
function buildDataRecord(addr16, data) {
    const bc = data.length;
    const ah = (addr16 >> 8) & 0xFF;
    const al = addr16 & 0xFF;
    let sum = bc + ah + al + 0 /* type=Data */;
    for (const b of data) {
        sum += b;
    }
    const chk = ((~sum + 1) & 0xFF);
    const body = bc.toString(16).toUpperCase().padStart(2, '0') +
        addr16.toString(16).toUpperCase().padStart(4, '0') +
        '00' +
        data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('') +
        chk.toString(16).toUpperCase().padStart(2, '0');
    return ':' + body;
}
/**
 * Pure format-detection logic, exposed for testing.
 * Decides format from file extension and raw content.
 */
function detectFormatFromParts(ext, raw) {
    if (['srec', 'mot', 's19', 's28', 's37'].includes(ext)) {
        return 'srec';
    }
    // Content sniff: first non-empty line starts with 'S' followed by a digit
    const firstLine = raw.trimStart().slice(0, 4);
    if (/^S[0-9]/i.test(firstLine)) {
        return 'srec';
    }
    return 'ihex';
}
/** Detect whether raw content is Intel HEX or Motorola SREC. */
function detectFormat(uri, raw) {
    return detectFormatFromParts(uri.path.split('.').pop()?.toLowerCase() ?? '', raw);
}
/** Rebuild a Motorola SREC file from original parse + a map of addr→newValue overrides. */
function serializeSRec(originalRaw, parseResult, edits) {
    if (edits.size === 0) {
        return originalRaw;
    }
    const eol = originalRaw.includes('\r\n') ? '\r\n' : '\n';
    const lines = [];
    for (const rec of parseResult.records) {
        if (rec.error || !(0, SRecParser_1.srecIsData)(rec.recordType)) {
            lines.push(rec.raw);
            continue;
        }
        // Apply any edits that fall inside this record
        const data = Array.from(rec.data);
        let changed = false;
        for (let i = 0; i < data.length; i++) {
            const addr = rec.resolvedAddress + i;
            if (edits.has(addr)) {
                data[i] = edits.get(addr);
                changed = true;
            }
        }
        if (!changed) {
            lines.push(rec.raw);
            continue;
        }
        lines.push(buildSRecDataRecord(rec.recordType, rec.resolvedAddress, data));
    }
    return lines.join(eol);
}
function buildSRecDataRecord(type, address, data) {
    const asz = SRecParser_1.SREC_ADDR_SIZES[type] ?? 2;
    const byteCount = asz + data.length + 1; // addrBytes + dataBytes + checksumByte
    let sum = byteCount;
    for (let i = 0; i < asz; i++) {
        sum += (address >>> ((asz - 1 - i) * 8)) & 0xFF;
    }
    for (const b of data) {
        sum += b;
    }
    const chk = (~sum) & 0xFF;
    const bcHex = byteCount.toString(16).toUpperCase().padStart(2, '0');
    const addrHex = address.toString(16).toUpperCase().padStart(asz * 2, '0');
    const dataHex = data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
    const chkHex = chk.toString(16).toUpperCase().padStart(2, '0');
    return `S${type}${bcHex}${addrHex}${dataHex}${chkHex}`;
}
/**
 * Rewrite every checksum-invalid (but structurally parseable) record in-place
 * by replacing its last two hex characters with the correctly computed checksum.
 * Lines with a parse error are left untouched because their structure is unknown.
 */
function repairChecksums(raw, parseResult) {
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const lines = raw.split(/\r?\n/);
    for (const rec of parseResult.records) {
        if (rec.error || rec.checksumValid) {
            continue;
        }
        const line = lines[rec.lineNumber - 1];
        if (!line) {
            continue;
        }
        // Replace the last two characters (the checksum hex byte)
        const correctChk = computeCorrectChecksum(rec);
        lines[rec.lineNumber - 1] = line.slice(0, -2) +
            correctChk.toString(16).toUpperCase().padStart(2, '0');
    }
    return lines.join(eol);
}
/** Compute the correct checksum for a parsed record (works for both IHEX and SREC). */
function computeCorrectChecksum(rec) {
    // IHEX: two's-complement of (byteCount + addrHi + addrLo + recordType + data)
    // SREC: one's-complement of (byteCount + addrBytes + data)
    // We detect by address byte count: SREC types have fixed addr sizes, IHEX always 2.
    // Both share the same shape — differentiate by checking if raw starts with ':' or 'S'.
    if (rec.raw.startsWith('S')) {
        const aszMap = { 0: 2, 1: 2, 2: 3, 3: 4, 5: 2, 6: 3, 7: 4, 8: 3, 9: 2 };
        const asz = aszMap[rec.recordType] ?? 2;
        let sum = rec.byteCount;
        for (let i = asz - 1; i >= 0; i--) {
            sum += (rec.address >>> (i * 8)) & 0xFF;
        }
        for (const b of rec.data) {
            sum += b;
        }
        return (~sum) & 0xFF;
    }
    let sum = rec.byteCount + ((rec.address >> 8) & 0xFF) + (rec.address & 0xFF) + rec.recordType;
    for (const b of rec.data) {
        sum += b;
    }
    return (~sum + 1) & 0xFF;
}
function getNonce() {
    return crypto.randomBytes(16).toString('hex');
}
//# sourceMappingURL=HexEditorProvider.js.map