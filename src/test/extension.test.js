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
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
suite('HexScope Extension', () => {
    async function getActivatedExtension() {
        const ext = vscode.extensions.all.find(e => e.id.includes('vscode-hex-scope'));
        assert.ok(ext, 'HexScope extension should be present in the test instance');
        if (ext && !ext.isActive) {
            await ext.activate();
        }
        return ext;
    }
    test('extension can be located and activated', async () => {
        const ext = await getActivatedExtension();
        assert.ok(ext.isActive, 'extension should be active after activation');
    });
    test('all HexScope commands are registered', async () => {
        await getActivatedExtension();
        const commands = await vscode.commands.getCommands(true);
        const expected = [
            'hexScope.openInHexScope',
            'hexScope.addSegmentLabel',
            'hexScope.copyAsHexString',
            'hexScope.copyAsCArray',
            'hexScope.copyAsAscii',
            'hexScope.copyRawRecord',
        ];
        for (const cmd of expected) {
            assert.ok(commands.includes(cmd), `command "${cmd}" should be registered`);
        }
    });
});
//# sourceMappingURL=extension.test.js.map