import { buildPMTiles, zxyToTileId, writePMTilesFile } from "../src/archive/writer";
import { gzipSync } from "zlib";
import { join } from "path";
import { tmpdir } from "os";
import { mkdirSync } from "fs";

const dir = join(tmpdir(), "pmtiles-kit-screenshots");
mkdirSync(dir, { recursive: true });

function makeTileBytes(z, x, y) {
  return new Uint8Array(gzipSync(Buffer.from(`MVT-${z}-${x}-${y}`)));
}

const tiles = [
  { z: 0, x: 0, y: 0, bytes: makeTileBytes(0, 0, 0) },
  { z: 1, x: 0, y: 0, bytes: makeTileBytes(1, 0, 0) },
  { z: 1, x: 1, y: 1, bytes: makeTileBytes(1, 1, 1) },
  { z: 2, x: 2, y: 1, bytes: makeTileBytes(2, 2, 1) },
  { z: 2, x: 0, y: 2, bytes: makeTileBytes(2, 0, 2) },
];

tiles.sort((a, b) => zxyToTileId(a.z, a.x, a.y) - zxyToTileId(b.z, b.x, b.y));

const entries = [];
const blobs = [];
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
for (const b of blobs) { tileData.set(b, p); p += b.length; }

const path = join(dir, "sample.pmtiles");
writePMTilesFile(path, entries, tileData, {
  minZoom: 0, maxZoom: 2, minLon: -180, minLat: -85.051129,
  maxLon: 180, maxLat: 85.051129, centerZoom: 1, centerLon: 0, centerLat: 0,
  tileType: "mvt", tileCompression: "gzip",
  metadata: { name: "Sample", format: "pbf", type: "overlay", version: "1.0.0" },
});

console.log(path);
