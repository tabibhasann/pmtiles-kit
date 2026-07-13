# Architecture

```
pmtiles-kit
├── src/
│   ├── cli.ts                  # Commander.js entry point — dispatches subcommands
│   ├── archive/
│   │   ├── types.ts            # Core interfaces: Archive, TileArchiveHeader, ValidationReport, ConvertReport
│   │   ├── open.ts             # openArchive() — detects format by extension/magic bytes, supports HTTP URLs
│   │   ├── pmtiles.ts          # PMTilesArchive — wraps pmtiles library, reads header/metadata/tiles
│   │   ├── mbtiles.ts          # MBTilesArchive — reads SQLite-based MBTiles with TMS↔XYZ conversion
│   │   ├── node-source.ts      # NodeFileSource — loads local files into memory for pmtiles library
│   │   ├── http-source.ts      # HttpRangeSource — reads remote PMTiles via HTTP Range requests
│   │   └── writer.ts           # buildPMTiles() — constructs PMTiles v3 binary from tile entries
│   ├── commands/
│   │   ├── info.ts             # Display archive header + metadata (text/JSON)
│   │   ├── validate.ts         # Structural validation with --strict and --json
│   │   ├── convert.ts          # PMTiles↔MBTiles conversion with metadata normalization
│   │   ├── extract.ts          # Subset by bbox/zoom range → new PMTiles file
│   │   ├── serve.ts            # Local HTTP tile server with MapLibre preview
│   │   ├── tile.ts             # Dump single tile to stdout/file
│   │   ├── scan.ts             # Recursively scan directory for archives
│   │   └── compare.ts          # Compare two archives: header diffs, tile set diffs, byte diffs
│   └── index.ts                # Public API exports
├── test/
│   ├── fixtures.ts             # Build test PMTiles/MBTiles fixtures
│   ├── validation.test.ts      # Validate command tests (valid/invalid/empty/strict/bounds)
│   ├── conversion.test.ts      # Convert command tests
│   ├── roundtrip.test.ts       # Y-flip roundtrip + MBTiles→PMTiles→MBTiles tile byte preservation
│   ├── scan_compare.test.ts    # Scan directory + compare archives tests
│   ├── writer.test.ts          # PMTiles writer tests
│   ├── pmtiles.test.ts         # PMTilesArchive reader tests
│   ├── archive.test.ts         # openArchive format detection tests
│   ├── bytes.test.ts           # Byte utility tests
│   ├── yflip.test.ts           # TMS↔XYZ conversion tests
│   ├── report.test.ts          # Report formatting tests
│   └── public-api.test.ts      # Public API surface tests
└── package.json
```

## Data Flow

```
User CLI input
    │
    ▼
cli.ts (Commander.js)
    │
    ├──► openArchive(path)           ← supports local files + HTTP URLs
    │       │
    │       ├──► PMTilesArchive      ← uses NodeFileSource or HttpRangeSource
    │       └──► MBTilesArchive      ← uses better-sqlite3
    │
    ├──► info / validate / convert / extract / scan / compare
    │       │
    │       ▼
    │    Archive interface
    │       ├── getHeader()
    │       ├── getMetadata()
    │       ├── getTile(z, x, y)
    │       ├── listTiles()
    │       └── close()
    │
    └──► Output (text / JSON / file)
```

## Key Design Decisions

- **Archive abstraction**: Both PMTiles and MBTiles implement the same `Archive` interface, enabling format-agnostic commands.
- **HTTP range reads**: `HttpRangeSource` enables reading remote PMTiles without downloading the entire file.
- **TMS↔XYZ conversion**: MBTiles stores tiles in TMS (y-flipped) order; the library handles this transparently.
- **Writer dedup**: `buildPMTiles` deduplicates identical tile blobs by content hash to minimize file size.
