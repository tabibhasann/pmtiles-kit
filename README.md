# pmtiles-kit 🗺️

**The missing Swiss-army knife for PMTiles and MBTiles.** Inspect, validate, convert, and preview map tile archives with a single command. Production-ready with efficient conversion, progress indicators, and CI/CD integration.

[![npm version](https://img.shields.io/npm/v/pmtiles-kit.svg)](https://npmjs.com/package/pmtiles-kit)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/tabibhasann/pmtiles-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/tabibhasann/pmtiles-kit/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/npm/dm/pmtiles-kit.svg)](https://npmjs.com/package/pmtiles-kit)

## Why pmtiles-kit?

Map tile archives (PMTiles, MBTiles) are the backbone of modern web mapping, but tooling has been fragmented. **pmtiles-kit unifies everything:**

- ✅ **Unified API** — Work with PMTiles and MBTiles using the same interface
- ✅ **Efficient conversion** — O(n) tile iteration with spatial indexing (not brute-force)
- ✅ **Real-time preview** — Built-in MapLibre GL viewer
- ✅ **CI/CD ready** — Validation with exit codes, JSON output
- ✅ **Progress indicators** — Know exactly how long operations will take
- ✅ **Type-safe** — Full TypeScript definitions
- ✅ **Library + CLI** — Use as a command-line tool or import in your code

**Handles the Y-flip automatically.** MBTiles uses TMS (Y=0 at bottom), PMTiles uses XYZ (Y=0 at top). pmtiles-kit normalizes this transparently.

## Quickstart

```bash
npx pmtiles-kit info map.pmtiles
npx pmtiles-kit serve map.pmtiles     # opens MapLibre preview
npx pmtiles-kit validate map.pmtiles  # CI-friendly (exit code)
npx pmtiles-kit convert map.mbtiles map.pmtiles
```

## Commands

| Command | Description |
|---------|-------------|
| `info <file> [--json]` | Show header, metadata, tile stats |
| `validate <file> [--json]` | Structural checks, exits 1 if invalid |
| `convert <in> <out>` | MBTiles ↔ PMTiles (handles Y-flip) |
| `serve <file> [-p 8080]` | Local tile server + MapLibre viewer |
| `tile <file> -z Z -x X -y Y` | Dump a single tile |

## Library API

```ts
import { openArchive } from "pmtiles-kit";

const archive = await openArchive("map.pmtiles");
const header = await archive.getHeader();
const tile = await archive.getTile(5, 10, 15); // XYZ convention
await archive.close();
```

## Critical: Y-flip

MBTiles uses TMS (Y origin: bottom), PMTiles uses XYZ (Y origin: top). Every tile read from MBTiles automatically flips Y so the library API is always XYZ. Conversion between formats preserves tile data correctly.

## License

MIT
