# pmtiles-kit 🗺️

**The missing Swiss-army knife for PMTiles and MBTiles.** Inspect, validate, convert, and preview map tile archives with a single command. Efficient conversion, progress indicators, and CI/CD integration.

[![npm version](https://img.shields.io/npm/v/@tabibhasan/pmtiles-kit)](https://npmjs.com/package/@tabibhasan/pmtiles-kit)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/tabibhasann/pmtiles-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/tabibhasann/pmtiles-kit/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-71%25-brightgreen)](https://github.com/tabibhasann/pmtiles-kit/actions)
[![Tests](https://img.shields.io/badge/tests-170%20passed-brightgreen)](https://github.com/tabibhasann/pmtiles-kit/actions)
[![Downloads](https://img.shields.io/npm/dm/@tabibhasan/pmtiles-kit)](https://npmjs.com/package/@tabibhasan/pmtiles-kit)


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

pmtiles-kit is the only npm-native tool that combines inspect, validate, convert,
and preview in a single CLI + library.

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
| `info <file> [--json]` | Show header, metadata, tile stats |
| `validate <file> [--json] [--strict]` | Structural checks, exits 1 if invalid. `--strict` treats warnings as errors |
| `convert <in> <out>` | MBTiles ↔ PMTiles (handles Y-flip) |
| `serve <file> [-p 8080]` | Local tile server + MapLibre viewer |
| `tile <file> -z Z -x X -y Y` | Dump a single tile |

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
import { convertMbtilesToPmtiles } from "@tabibhasan/pmtiles-kit";

await convertMbtilesToPmtiles("input.mbtiles", "output.pmtiles", {
  onProgress: (done, total) => console.log(`${done}/${total} tiles`),
});
```

### Programmatic validation

```ts
import { validateArchive } from "@tabibhasan/pmtiles-kit";

const result = await validateArchive("map.pmtiles", { strict: true });
if (!result.valid) {
  for (const err of result.errors) console.error(err);
  process.exit(1);
}
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

## Roadmap

**What works now:**
- `info`, `validate`, `convert`, `serve`, `tile`, `extract` commands
- PMTiles and MBTiles support with automatic Y-flip
- MapLibre GL preview server
- TypeScript library API
- `--strict` validation mode for CI
- `--json` output for all commands

**Planned:**
- HTTP range reads for remote PMTiles archives
- Directory traversal (`pmtiles-kit info ./tiles/`)
- Large fixture tests (1GB+ archive handling)
- `pmtiles-kit preview --port 3000` with style picker

## API

### CLI Commands

| Command | Description |
|---------|-------------|
| `pmtiles-kit inspect <file>` | Print metadata, header, and structure |
| `pmtiles-kit validate <file>` | Validate PMTiles/MBTiles format |
| `pmtiles-kit convert <in> <out>` | Convert between PMTiles and MBTiles |
| `pmtiles-kit preview <file>` | Start local preview server |
| `pmtiles-kit tiles <file> --z 5` | List tiles at a specific zoom level |

### Programmatic API

```typescript
import { inspect, validate, convert } from 'pmtiles-kit';

// Inspect a PMTiles file
const info = await inspect('data.pmtiles');

// Validate file integrity
const result = await validate('data.pmtiles');

// Convert PMTiles to MBTiles
await convert('data.pmtiles', 'data.mbtiles');
```


## CLI Reference

\`\`\`bash
pmtiles-kit --help     # Show all available commands and options
pmtiles-kit --version  # Print the installed version
\`\`\`

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT

---

⭐ Star [tabibhasann/pmtiles-kit](https://github.com/tabibhasann/pmtiles-kit) on GitHub if this helped you.
