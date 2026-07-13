# pmtiles-kit examples

Example usage patterns for pmtiles-kit.

## Files

- [`inspect.mjs`](inspect.mjs) — Inspect a PMTiles file
- [`convert.mjs`](convert.mjs) — Convert MBTiles → PMTiles
- [`validate.mjs`](validate.mjs) — Validate a PMTiles file
- [`preview.mjs`](preview.mjs) — Generate a static preview HTML

## Quick Start

```bash
# Inspect a PMTiles file
pmtiles-kit inspect tiles.pmtiles

# Convert MBTiles to PMTiles
pmtiles-kit convert input.mbtiles output.pmtiles

# Validate
pmtiles-kit validate tiles.pmtiles

# Generate preview
pmtiles-kit preview tiles.pmtiles -o preview.html
```
