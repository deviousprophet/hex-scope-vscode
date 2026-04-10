# Changelog

## [1.1.0] — 2026-04-10

### Added

- **Motorola SREC / S-Record support** — full parser for S0–S9 record types with one's-complement checksum validation, 2/3/4-byte address resolution (S1/S2/S3), and contiguous segment assembly; all five common file extensions registered (`.srec`, `.mot`, `.s19`, `.s28`, `.s37`)
- **SREC serializer** — Edit mode Save correctly rebuilds S1/S2/S3 data records preserving the original record type and address width, with recomputed one's-complement checksums
- **Format detection** — automatic IHEX/SREC detection by file extension with content-sniff fallback (`S[0-9]` prefix) for ambiguous extensions
- **SREC-aware Records view** — record type badges and color-coding for all nine SREC record types (Header S0, Data S1/S2/S3, Count S5/S6, End S7/S8/S9); format-aware `isData` classification
- **SREC Raw view tokenizer** — per-field syntax coloring for SREC lines in the Raw view (start code, type, byte count, address, data bytes, checksum)
- **Format badge** in the stats bar (`IHEX` or `SREC`) identifying the active parser
- **SREC TextMate grammar** (`syntaxes/srec.tmLanguage.json`) with per-field token scopes and default token colors registered in `package.json`
- **Shared parser types** (`src/parser/types.ts`) — `HexRecord`, `MemorySegment`, and `ParseResult` interfaces extracted so neither parser depends on the other

### Changed

- `SerializedParseResult` extended with `format: 'ihex' | 'srec'` discriminant field
- Parser comment style made consistent across `IntelHexParser.ts` and `SRecParser.ts`; `SRecParser.ts` no longer imports from `IntelHexParser.ts`
- Sample files reorganised into `sample/ihex/` and `sample/srec/` subdirectories; `sample/README.md` renamed to `sample/SAMPLE.md`

### Added (tests and samples)

- `src/test/srec-parser.test.ts` — 30+ unit tests for the SREC parser
- `src/test/ihex-samples.test.ts` — sample-file integration tests for all five Intel HEX samples
- `src/test/srec-samples.test.ts` — sample-file integration tests for all six SREC samples plus cross-format parity checks
- Six new SREC sample files: `minimal.srec`, `firmware_s1.srec`, `firmware_s3.srec`, `stm32_s3.srec`, `mixed_addr.srec`, `errors.srec`

---

## [1.0.0] — 2026-04-09

### Added

- Custom editor for Intel HEX (`.hex`) files, registered for `*.hex` via VS Code's custom editor API
- Intel HEX parser supporting all six record types: Data, End of File, Extended Segment Address, Start Segment Address, Extended Linear Address, and Start Linear Address
- 32-bit address resolution for both Extended Linear Address (type 04) and Extended Segment Address (type 02) modes
- Per-record checksum validation with error and malformed-line counters
- Contiguous memory segment assembly from valid data records
- **Memory view**: 16-byte hex grid with address column, decoded-text column, 4-byte group spacing, and column hover highlight
- **Records view**: table of all parsed HEX records with type badges, address fields, byte counts, and checksum status
- **Raw view**: syntax-highlighted Intel HEX source using a bundled TextMate grammar
- **Inspector sidebar**: single-byte display (hex chip, decimal, ASCII, nibble-grouped binary — each click-to-copy); multi-byte raw hex dump
- **Bit view** sidebar panel: 8-column bit grid per byte; supports up to 8 bytes for multi-byte selections; bit index header (7→0); column hover highlight
- **Multi-byte interpreter**: interprets selection as smallest fitting type — `uint16`/`int16` (2 bytes), `uint32`/`int32`/`float32` (4 bytes), `float64` (8 bytes); little-endian / big-endian toggle; click-to-copy values
- **Search** (`Ctrl+F`): hex-byte sequence, ASCII string, and address search modes with next/previous match navigation
- **Edit mode**: toolbar toggle; in-place byte patching; undo (`Ctrl+Z`); edited bytes highlighted in amber; `💾 Save` writes a corrected Intel HEX file to disk with recomputed per-record checksums
- **Right-click context menu** — single byte: Copy (Hex, Decimal, Binary, ASCII) and Patch submenus; multi-byte: Copy (8 formats with live preview), Analyze (Sum, XOR, CRC-8, CRC-16, CRC-32), and Fill/Patch submenus
- Gap rows in the memory grid indicate non-contiguous address ranges with the unmapped byte count
- **Segment labels**: named, color-coded address-range banners rendered inline in the memory grid; persisted per workspace per file via `workspaceState`; supports add, edit, delete, reorder, and visibility toggle
- `Open with HexScope Viewer` command available in Explorer context menu and editor title button for `.hex` files
- Commands: `hexScope.openInHexScope`, `hexScope.addSegmentLabel`, `hexScope.copyAsHexString`, `hexScope.copyAsCArray`, `hexScope.copyAsAscii`, `hexScope.copyRawRecord`
- Intel HEX syntax highlighting via TextMate grammar with per-field token coloring (start code, byte count, address, record type, data, checksum)
- Drag-to-select bytes across hex cells and decoded-text cells in the memory grid

