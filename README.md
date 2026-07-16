# pmtiles-kit 🗺️

> **Pre-release:** this package is not yet published to npm. Install from a checkout; scoped `npm`/`npx` commands below describe the intended release interface.

**The missing Swiss-army knife for PMTiles and MBTiles.** Inspect, validate, convert, and preview map tile archives with a single command. Efficient conversion, progress indicators, and CI/CD integration.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/tabibhasann/pmtiles-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/tabibhasann/pmtiles-kit/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-78%25-brightgreen)](https://github.com/tabibhasann/pmtiles-kit/actions)
[![Tests](https://img.shields.io/badge/tests-186%20passed-brightgreen)](https://github.com/tabibhasann/pmtiles-kit/actions)


**Demo:** Example output: see [Quickstart](#quickstart) above

### Screenshot

```text
$ pmtiles-kit info sample.pmtiles

Format:     PMTILES
Tile type:  mvt
Compression: gzip
Zoom range: 0 – 2
Bounds:     [-85.051129, -180, 85.051129, 180]
Center:     0, 0, 1
Tile count: 5

$ pmtiles-kit validate sample.pmtiles
✓ Valid
```

## Why pmtiles-kit?

Map tile archives (PMTiles, MBTiles) are the backbone of modern web mapping, but tooling has been fragmented. **pmtiles-kit unifies everything:**

### How it compares

| Tool | Language | Inspect | Validate | Convert | Preview | Library API |
|---|---|---|---|---|---|---|
| **pmtiles-kit** | TypeScript | ✅ | ✅ | ✅ | ✅ | ✅ |
| [go-pmtiles](https://github.com/protomaps/go-pmtiles) | Go | ✅ | ✅ | ❌ | ❌ | ❌ |
| [pmtiles (npm)](https://www.npmjs.com/package/pmtiles) | TypeScript | ❌ | ❌ | ❌ | ❌ | ✅ (render only) |
| [tippecanoe](https://github.com/felt/tippecanoe) | C++ | ❌ | ❌ | ✅ (GeoJSON→PMTiles) | ❌ | ❌ |
| [mb-util](https://github.com/mapbox/mbutil) | Python | ❌ | ❌ | ✅ (MBTiles↔tile dir) | ❌ | ❌ |

pmtiles-kit combines inspect, validate, convert, and preview workflows in one
npm-native CLI and library.

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
npx @tabibhasan/pmtiles-kit info map.pmtiles
npx @tabibhasan/pmtiles-kit serve map.pmtiles     # opens MapLibre preview
npx @tabibhasan/pmtiles-kit validate map.pmtiles  # CI-friendly (exit code)
npx @tabibhasan/pmtiles-kit convert map.mbtiles map.pmtiles
```

## Commands

| Command | Description |
|---------|-------------|
| `info <file> [--json] [--verbose]` | Show header, metadata, tile stats |
| `validate <file> [--json] [--strict]` | Structural checks, exits 1 if invalid. `--strict` treats warnings as errors |
| `convert <in> <out>` | MBTiles ↔ PMTiles (handles Y-flip) |
| `serve <file> [-p 8080]` | Local tile server + MapLibre viewer |
| `tile <file> -z Z -x X -y Y` | Dump a single tile |
| `extract <in> <out> [--bbox s,w,n,e] [--minzoom Z] [--maxzoom Z]` | Subset by bbox and/or zoom range |
| `scan <dir> [--json] [--verbose]` | Scan a directory for PMTiles/MBTiles files |
| `compare <a> <b> [--json]` | Compare two tile archives tile-by-tile |

## Library API

```ts
import { openArchive } from "@tabibhasan/pmtiles-kit";

const archive = await openArchive("map.pmtiles");
const header = await archive.getHeader();
const tile = await archive.getTile(5, 10, 15); // XYZ convention
await archive.close();
```

### Programmatic conversion

```ts
import { writePMTilesFile, zxyToTileId } from "@tabibhasan/pmtiles-kit";
import { openArchive } from "@tabibhasan/pmtiles-kit";

// Read tiles from an MBTiles archive and write a PMTiles file
const src = await openArchive("input.mbtiles");
const header = await src.getHeader();
const entries: { tileId: number; data: Uint8Array }[] = [];
for await (const { z, x, y, data } of src.iterTiles()) {
  entries.push({ tileId: zxyToTileId(z, x, y), data });
}
await writePMTilesFile("output.pmtiles", header, entries);
await src.close();
```

## CI/CD Integration

```yaml
# .github/workflows/validate-tiles.yml
name: Validate Tile Archives
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npx @tabibhasan/pmtiles-kit validate tiles/*.pmtiles --strict --json > report.json
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: tile-validation, path: report.json }
```

## Examples

See the [`examples/`](examples/) directory for complete scripts:
- [`inspect.mjs`](examples/inspect.mjs) — Inspect a PMTiles file
- [`convert.mjs`](examples/convert.mjs) — Convert MBTiles → PMTiles
- [`validate.mjs`](examples/validate.mjs) — Validate a PMTiles file

## Critical: Y-flip

MBTiles uses TMS (Y origin: bottom), PMTiles uses XYZ (Y origin: top). Every tile read from MBTiles automatically flips Y so the library API is always XYZ. Conversion between formats preserves tile data correctly.

## Alternatives

| Tool | Type | Scope | CLI | Convert | Validate | Preview | npm |
|------|------|-------|-----|---------|----------|---------|-----|
| **pmtiles-kit** | CLI + library | PMTiles + MBTiles inspect/validate/convert/preview | Yes | Both | Yes | MapLibre viewer | Yes |
| [pmtiles CLI](https://github.com/protomaps/PMTiles/tree/main/js) | CLI | PMTiles show/extract only | Yes | No | No | No | No |
| [tippecanoe](https://github.com/felt/tippecanoe) | CLI | GeoJSON → MBTiles/PMTiles creation | Yes | No | No | No | No |
| [mbtiletool](https://github.com/mapbox/mbutil) | CLI | MBTiles export/import | Yes | No | No | No | No |
| [tileserver-gl](https://github.com/maptiler/tileserver-gl) | Server | Serve MBTiles/PMTiles | No | No | No | Yes | No |

**Why pmtiles-kit?** It's the only tool that combines inspection, validation, format conversion (PMTiles ↔ MBTiles), a built-in MapLibre preview server, and directory scanning in a single npm-installable CLI — purpose-built for CI/CD and local workflows.

## Roadmap

**What works now:**
- `info`, `validate`, `convert`, `serve`, `tile`, `extract`, `scan`, `compare` commands
- PMTiles and MBTiles support with automatic Y-flip
- MapLibre GL preview server
- TypeScript library API
- `--strict` validation mode for CI
- `--json` output for all commands

**Planned:**
- HTTP range reads for remote PMTiles archives
- Large fixture tests (1GB+ archive handling)
- `pmtiles-kit serve --port 3000` with style picker

## CLI Reference

```bash
pmtiles-kit --help          # Show all available commands and options
pmtiles-kit --version       # Print the installed version
pmtiles-kit info map.pmtiles --json
pmtiles-kit validate map.pmtiles --strict --json
pmtiles-kit convert map.mbtiles map.pmtiles
pmtiles-kit extract map.pmtiles subset.pmtiles --bbox 23,90,24,91 --minzoom 0 --maxzoom 10
pmtiles-kit scan ./tiles/ --json
pmtiles-kit compare old.pmtiles new.pmtiles --json
```

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT

---

⭐ Star [tabibhasann/pmtiles-kit](https://github.com/tabibhasann/pmtiles-kit) on GitHub if this helped you.
