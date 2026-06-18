/**
 * Tiny in-memory fixture builders so tests don't have to commit large
 * binary files to the repo.
 *
 * Both fixtures contain the same 3 tiles at zoom 0/1/2 so tests can
 * round-trip them. Tile bytes are gzipped to match the MBTiles "pbf" format
 * convention, which is what real-world vector tiles use.
 */

import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync, mkdirSync } from "fs";
import { gzipSync } from "zlib";
import { buildPMTiles, WriterEntry } from "../src/archive/writer";
import { zxyToTileId } from "../src/archive/writer";

export interface TileRef {
  z: number;
  x: number;
  y: number;
  bytes: Uint8Array;
}

/** A tiny deterministic gzipped tile payload based on (z, x, y). */
export function makeTileBytes(z: number, x: number, y: number): Uint8Array {
  const s = `MVT-${z}-${x}-${y}`;
  return new Uint8Array(gzipSync(Buffer.from(s)));
}

export function makeFixtureTiles(): TileRef[] {
  // A few representative tiles across zooms 0, 1, and 2
  return [
    { z: 0, x: 0, y: 0, bytes: makeTileBytes(0, 0, 0) },
    { z: 1, x: 0, y: 0, bytes: makeTileBytes(1, 0, 0) },
    { z: 1, x: 1, y: 1, bytes: makeTileBytes(1, 1, 1) },
    { z: 2, x: 2, y: 1, bytes: makeTileBytes(2, 2, 1) },
    { z: 2, x: 0, y: 2, bytes: makeTileBytes(2, 0, 2) },
  ];
}

/** Build an MBTiles fixture in a temp file, return the path. */
export function buildMBTilesFixture(): string {
  const dir = join(tmpdir(), `pmtiles-kit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "sample.mbtiles");
  const db = new Database(path);
  db.exec(`
    CREATE TABLE metadata (name TEXT, value TEXT);
    CREATE TABLE tiles (
      zoom_level INTEGER,
      tile_column INTEGER,
      tile_row INTEGER,
      tile_data BLOB
    );
    CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row);
  `);
  const meta = [
    ["name", "Sample"],
    ["format", "pbf"],
    ["bounds", "-180.000000,-85.051129,180.000000,85.051129"],
    ["center", "0.000000,0.000000,1"],
    ["minzoom", "0"],
    ["maxzoom", "2"],
    ["type", "overlay"],
    ["version", "1.0.0"],
  ];
  const insertMeta = db.prepare("INSERT INTO metadata (name, value) VALUES (?, ?)");
  for (const [k, v] of meta) insertMeta.run(k, v);

  const insertTile = db.prepare(
    "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)"
  );
  // MBTiles uses TMS (Y-flipped)
  for (const t of makeFixtureTiles()) {
    const yTms = (1 << t.z) - 1 - t.y;
    insertTile.run(t.z, t.x, yTms, Buffer.from(t.bytes));
  }
  db.close();
  return path;
}

/** Build a PMTiles v3 fixture in a temp file, return the path. */
export function buildPMTilesFixture(): string {
  const dir = join(tmpdir(), `pmtiles-kit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "sample.pmtiles");
  const tiles = makeFixtureTiles();
  // Sort by TileID and accumulate tile data
  tiles.sort((a, b) => zxyToTileId(a.z, a.x, a.y) - zxyToTileId(b.z, b.x, b.y));
  const entries: WriterEntry[] = [];
  const blobs: Uint8Array[] = [];
  let offset = 0;
  for (const t of tiles) {
    const id = zxyToTileId(t.z, t.x, t.y);
    entries.push({ tileId: id, offset, length: t.bytes.length, runLength: 1 });
    blobs.push(t.bytes);
    offset += t.bytes.length;
  }
  const totalBytes = offset;
  const tileData = new Uint8Array(totalBytes);
  let p = 0;
  for (const b of blobs) {
    tileData.set(b, p);
    p += b.length;
  }
  const result = buildPMTiles(entries, tileData, {
    minZoom: 0,
    maxZoom: 2,
    minLon: -180,
    minLat: -85.051129,
    maxLon: 180,
    maxLat: 85.051129,
    centerZoom: 1,
    centerLon: 0,
    centerLat: 0,
    tileType: "mvt",
    tileCompression: "gzip",
    metadata: {
      name: "Sample",
      format: "pbf",
      type: "overlay",
      version: "1.0.0",
      vector_layers: [{ id: "sample", fields: {} }],
    },
  });
  writeFileSync(path, result.bytes);
  return path;
}
