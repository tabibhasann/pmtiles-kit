# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0](https://github.com/tabibhasann/pmtiles-kit/compare/pmtiles-kit-v0.2.0...pmtiles-kit-v0.3.0) (2026-07-17)


### Features

* add JSDoc to all exports, tests for extract/tile commands, alternatives table ([c9d4814](https://github.com/tabibhasann/pmtiles-kit/commit/c9d481441d9022994410d7365da2846efde506d5))
* add stats command for per-zoom tile statistics ([0d81db1](https://github.com/tabibhasann/pmtiles-kit/commit/0d81db138b1ee6ea681fc0a15f7c9ce4d07e9d6c))


### Bug Fixes

* add missing private field declarations in NodeFileSource ([6154b38](https://github.com/tabibhasann/pmtiles-kit/commit/6154b38e349204be1f45914a0eeaecf767d684cc))
* prevent null header returns, fix db handle leak in convertToMBTiles ([6efebbc](https://github.com/tabibhasann/pmtiles-kit/commit/6efebbc10b2801d6275bfb706a43e2c558d67c39))

## [0.2.0] - 2026-06-16

### Added
- **Real PMTiles v3 writer** (`src/archive/writer.ts`) — pure JavaScript, no external binary
  required. Implements the v3 spec: header, gzip-compressed root directory with delta-encoded
  TileIDs and run-length encoding, metadata, and tile data. Tiles are sorted by Hilbert
  TileID and deduplicated automatically.
- `zxyToTileId()` and `decodeDirectory()` exported for use in custom pipelines
- `readPMTilesHeader()` for low-level access to PMTiles bytes
- Tile-deduplication during convert (consecutive identical tiles collapse via runLength)
- `extract` command — subset an archive by bbox and/or zoom range
- `scan` command — scan a directory for PMTiles/MBTiles files
- `compare` command — compare two tile archives tile-by-tile
- `--verbose` flag on `info` and `scan` commands
- New tests: `test/writer.test.ts` (6 tests) + `test/roundtrip.test.ts` (2 tests)

### Fixed
- Consolidated npm publishing into a single tag-triggered workflow so releases cannot publish twice.
- **`convert` actually writes a real PMTiles archive** (was silently writing MBTiles with a
  `.pmtiles` extension and a warning, breaking the spec acceptance criteria)
- `convert` normalizes metadata keys and bounds between PMTiles and MBTiles
- `validate` no longer false-positives when (z=0, x=0, y=0) is missing in a regional archive
- TypeScript types: added `PMTilesCompression` and `TileType` enums, removed dead `isGzipped`
  import
- CONTRIBUTING.md was a Python project template — now describes the TypeScript toolchain
- Added missing `.eslintrc.cjs` and `.prettierrc.json` configs (CI's `npm run lint` was failing)
- `package.json` lint script now actually works

### Changed
- Bumped version to 0.2.0
- Updated README to reflect real capabilities
- CI workflow now uses `npm ci` instead of `npm install` and runs typecheck + lint

## [0.1.0] - 2026-01-01

### Added
- Initial release of pmtiles-kit
- MBTiles reader (SQLite via better-sqlite3)
- PMTiles reader (v3 via the official `pmtiles` library)
- Y-flip (TMS ↔ XYZ) helpers
- CLI: `info`, `validate`, `convert`, `serve`, `tile`
- MapLibre preview page served at `/`
- GitHub Actions CI/CD
