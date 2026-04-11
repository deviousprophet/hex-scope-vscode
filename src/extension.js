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
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
const vscode = __importStar(require("vscode"));
const HexEditorProvider_1 = require("./HexEditorProvider");
function activate(context) {
    // Register the custom editor provider for .hex files
    context.subscriptions.push(HexEditorProvider_1.HexEditorProvider.register(context));
    // Command: Add Segment Label
    context.subscriptions.push(vscode.commands.registerCommand('hexScope.addSegmentLabel', () => {
        vscode.commands.executeCommand('hexScope.addSegmentLabelInternal');
    }));
    // Command: Open current .hex file in the HexScope custom editor
    context.subscriptions.push(vscode.commands.registerCommand('hexScope.openInHexScope', (uri) => {
        const target = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (target) {
            vscode.commands.executeCommand('vscode.openWith', target, HexEditorProvider_1.HexEditorProvider.viewType);
        }
    }));
    // Copy commands — delegate to the active webview
    const copyCommands = [
        ['hexScope.copyAsHexString', 'hex'],
        ['hexScope.copyAsCArray', 'c'],
        ['hexScope.copyAsAscii', 'ascii'],
        ['hexScope.copyRawRecord', 'record'],
    ];
    for (const [cmd, format] of copyCommands) {
        context.subscriptions.push(vscode.commands.registerCommand(cmd, () => {
            HexEditorProvider_1.HexEditorProvider.postToActive({ type: 'copyCommand', format });
        }));
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map