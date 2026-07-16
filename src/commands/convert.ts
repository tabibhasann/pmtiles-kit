import Database from "better-sqlite3";
import { existsSync, writeFileSync } from "fs";
import { gzipSync } from "zlib";
import { ConvertReport } from "../archive/types";
import { openArchive } from "../archive/open";
import { buildPMTiles } from "../archive/writer";
import { inferTileType, inferCompression, detectCompression, buildEntriesAndTileData } from "./shared";

/**
 * Convert a tile archive (PMTiles or MBTiles) to a different format.
 *
 * - .mbtiles → .pmtiles: uses the pure-JS v3 writer
 * - .mbtiles → .mbtiles: direct SQLite copy (passthrough via the writer)
 * - .pmtiles → .mbtiles: re-wraps into a new SQLite MBTiles database
 * - .pmtiles → .pmtiles: re-wraps through the writer (useful for re-clustering)
 *
 * @param src - Path to the source archive
 * @param dst - Path for the output archive
 * @returns A summary string with conversion stats
 * @throws {Error} If the output file already exists or conversion fails
 */
export async function convertCommand(
  src: string,
  dst: string
): Promise<string> {
  if (existsSync(dst)) {
    throw new Error(`Output file already exists: ${dst}`);
  }

  const dstExt = dst.split(".").pop()?.toLowerCase();
  const isToPMTiles = dstExt === "pmtiles";

  const srcArchive = await openArchive(src);
  const header = await srcArchive.getHeader();
  const report: ConvertReport = {
    sourceFormat: header.format,
    targetFormat: isToPMTiles ? "pmtiles" : "mbtiles",
    tileCount: 0,
    warnings: [],
  };

  if (isToPMTiles) {
    await convertToPMTiles(srcArchive, dst, report);
  } else {
    await convertToMBTiles(srcArchive, dst, report);
  }

  await srcArchive.close();

  const warnSuffix = report.warnings.length
    ? `\nWarnings: ${report.warnings.join("; ")}`
    : "\nWarnings: none";
  return `Converted ${report.sourceFormat} → ${report.targetFormat}\nTiles: ${report.tileCount}${warnSuffix}`;
}

/**
 * Convert any archive to MBTiles. We pull every tile from the source via the
 * Archive interface and write them into a fresh SQLite database.
 */
async function convertToMBTiles(
  srcArchive: import("../archive/types").Archive,
  dst: string,
  report: ConvertReport
): Promise<void> {
  const targetDb = new Database(dst);

  try {
    targetDb.exec(`
      CREATE TABLE IF NOT EXISTS metadata (name TEXT, value TEXT);
      CREATE TABLE IF NOT EXISTS tiles (
        zoom_level INTEGER,
        tile_column INTEGER,
        tile_row INTEGER,
        tile_data BLOB
      );
      CREATE UNIQUE INDEX IF NOT EXISTS tile_index ON tiles (zoom_level, tile_column, tile_row);
    `);

    // Copy metadata (with PMTiles -> MBTiles key normalization)
    const metadata = await srcArchive.getMetadata();
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (key === "vector_layers" || typeof value === "object") {
        normalized[key] = JSON.stringify(value);
      } else {
        normalized[key] = String(value);
      }
    }
    // Ensure a "format" key exists
    if (!normalized.format) {
      normalized.format = "pbf";
    }
    // MBTiles bounds are [west, south, east, north]
    const srcHeader = await srcArchive.getHeader();
    if (!normalized.bounds) {
      const [s, w, n, e] = srcHeader.bounds;
      normalized.bounds = `${w},${s},${e},${n}`;
    }

    const insertMeta = targetDb.prepare(
      "INSERT INTO metadata (name, value) VALUES (?, ?)"
    );
    for (const [key, value] of Object.entries(normalized)) {
      insertMeta.run(key, value);
    }

    const insertTile = targetDb.prepare(
      "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)"
    );

    const totalTiles = srcHeader.tileCount;
    console.log(`Converting ${totalTiles} tiles to MBTiles...`);

    // MBTiles convention: vector tiles are stored gzipped. The PMTiles reader
    // transparently decompresses, so we need to re-gzip here unless the user
    // asked for raw bytes (format != pbf).
    const shouldGzip = (normalized.format || "").toLowerCase() === "pbf";

    let lastProgress = Date.now();
    targetDb.exec("BEGIN");
    for await (const { z, x, y } of srcArchive.listTiles()) {
      const tile = await srcArchive.getTile(z, x, y);
      if (tile) {
        const bytes = shouldGzip
          ? Buffer.from(gzipSync(Buffer.from(tile)))
          : Buffer.from(tile);
        // yXyz -> yTms for storage
        const yTms = (1 << z) - 1 - y;
        insertTile.run(z, x, yTms, bytes);
        report.tileCount++;
        const now = Date.now();
        if (now - lastProgress > 1000) {
          const progress = totalTiles > 0 ? ((report.tileCount / totalTiles) * 100).toFixed(1) : "?";
          console.log(`Progress: ${report.tileCount}/${totalTiles} tiles (${progress}%)`);
          lastProgress = now;
        }
      }
    }
    targetDb.exec("COMMIT");

    console.log(`Conversion complete: ${report.tileCount} tiles written`);
  } finally {
    targetDb.close();
  }
}

/**
 * Convert any archive to PMTiles using the pure-JS v3 writer.
 */
async function convertToPMTiles(
  srcArchive: import("../archive/types").Archive,
  dst: string,
  report: ConvertReport
): Promise<void> {
  const srcHeader = await srcArchive.getHeader();

  // Collect every tile from the source archive.
  console.log(`Collecting tiles from ${srcHeader.format}...`);
  const collected: { z: number; x: number; y: number; bytes: Uint8Array }[] = [];
  for await (const { z, x, y } of srcArchive.listTiles()) {
    const tile = await srcArchive.getTile(z, x, y);
    if (tile) {
      collected.push({ z, x, y, bytes: tile });
    }
  }
  report.tileCount = collected.length;

  // Sort by Hilbert TileID, deduplicate, and build the tile data section
  const { entries, tileData, deduplicated } = buildEntriesAndTileData(collected);

  if (deduplicated > 0) {
    report.warnings.push(
      `${deduplicated} duplicate tile content(s) reused in the PMTiles data section`
    );
  }

  // Determine tile type & compression. Prefer the actual bytes if the
  // source declared a compression that doesn't match the data (this is
  // common with synthetic test fixtures and some hand-made MBTiles).
  const tileType = inferTileType(srcHeader);
  let tileCompression = inferCompression(srcHeader);
  if (collected.length > 0) {
    const actual = detectCompression(collected[0]!.bytes);
    if (actual !== "unknown") {
      tileCompression = actual;
    }
  }

  // Metadata for the PMTiles archive (pass through what we can)
  const meta = await srcArchive.getMetadata();
  const outMeta: Record<string, unknown> = { ...meta };

  // Bounds are [south, west, north, east] internally; convert to lon/lat
  const [minLat, minLon, maxLat, maxLon] = srcHeader.bounds;

  console.log(`Writing PMTiles v3 archive (${entries.length} entries, ${tileData.length} bytes of tile data)...`);
  const result = buildPMTiles(entries, tileData, {
    minZoom: srcHeader.minZoom,
    maxZoom: srcHeader.maxZoom,
    minLon,
    minLat,
    maxLon,
    maxLat,
    centerZoom: srcHeader.center ? srcHeader.center[2] : Math.floor((srcHeader.minZoom + srcHeader.maxZoom) / 2),
    centerLon: srcHeader.center ? srcHeader.center[0] : (minLon + maxLon) / 2,
    centerLat: srcHeader.center ? srcHeader.center[1] : (minLat + maxLat) / 2,
    tileType,
    tileCompression,
    metadata: outMeta,
  });

  writeFileSync(dst, result.bytes);
  console.log(`Wrote ${result.bytes.length} bytes to ${dst}`);
}
