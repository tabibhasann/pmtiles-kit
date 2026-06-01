# pmtiles-kit 🗺️

> The missing Swiss-army knife for **PMTiles** and **MBTiles**. Inspect, validate, convert, and preview map tile archives — one command.

[![npm version](https://img.shields.io/npm/v/pmtiles-kit.svg)](https://npmjs.com/package/pmtiles-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

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
