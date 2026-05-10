# HexScope

VS Code extension for viewing and analyzing firmware files (HEX, SREC) with hex grid, search, patching.

## Supported file types

| Format | Extensions |
|---|---|
| Intel HEX | `.hex` |
| Motorola SREC | `.srec`, `.mot`, `.s19`, `.s28`, `.s37` |

## Quick usage

| Action | How |
|---|---|
| Open | Right-click a supported file → **Open with HexScope Viewer** |
| Views | Toolbar: **Memory**, **Records** |
| Edit | Click **Edit** to patch bytes; **Save** writes changes and recomputes checksums |
| Repair | Open the file in the normal editor, then run **HexScope: Quick Repair Checksums** |
| Search | `Ctrl+F` — search by hex sequence, ASCII string, or address |
| Labels | Add named, color-coded address-range banners; click a label to jump to it |
| Struct Overlay | Define C structs, pin them at addresses, and decode live binary data |

## Issues

Found a bug or want to request a feature? Please open an issue: [Issues](https://github.com/deviousprophet/vscode-hex-scope/issues)

Include a short description, steps to reproduce, and sample files when possible.
