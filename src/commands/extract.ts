/**
 * `extract` command — produce a new .pmtiles file containing only tiles
 * that fall inside an optional bounding box and/or zoom range.
 *
 * Useful for subsetting large planet tilesets down to a region.
 */

import { writeFileSync } from "fs";
import { buildPMTiles, zxyToTileId, WriterEntry } from "../archive/writer";
import { TileType, PMTilesCompression } from "../archive/types";
import { openArchive } from "../archive/open";
import { inferTileType, inferCompression, bytesKey } from "./shared";

export interface ExtractOptions {
  minZoom?: number;
  maxZoom?: number;
  bbox?: [number, number, number, number]; // [south, west, north, east]
}

function tileInBbox(z: number, x: number, y: number, bbox: [number, number, number, number]): boolean {
  const n = 1 << z;
  const [minLat, minLon, maxLat, maxLon] = bbox;
  // Tile boundaries in lon/lat
  const tileMinLon = (x / n) * 360 - 180;
  const tileMaxLon = ((x + 1) / n) * 360 - 180;
  const tileMaxLat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const tileMinLat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  // Overlap test (not containment — tiles that straddle the bbox edge are included)
  return tileMaxLon >= minLon && tileMinLon <= maxLon && tileMaxLat >= minLat && tileMinLat <= maxLat;
}

/** Extract tiles from an archive to a directory on disk. */
export async function extractCommand(
  src: string,
  dst: string,
  opts: ExtractOptions
): Promise<string> {
  const srcArchive = await openArchive(src);
  const header = await srcArchive.getHeader();
  const minZ = opts.minZoom ?? header.minZoom;
  const maxZ = opts.maxZoom ?? header.maxZoom;

  // Collect tiles in the subset
  const collected: { z: number; x: number; y: number; bytes: Uint8Array }[] = [];
  const metadata = await srcArchive.getMetadata();
  for await (const { z, x, y } of srcArchive.listTiles()) {
    if (z < minZ || z > maxZ) continue;
    if (opts.bbox && !tileInBbox(z, x, y, opts.bbox)) continue;
    const tile = await srcArchive.getTile(z, x, y);
    if (tile) {
      collected.push({ z, x, y, bytes: tile });
    }
  }
  await srcArchive.close();

  // Sort by TileID + build entries (with simple dedup by tile bytes)
  collected.sort((a, b) => zxyToTileId(a.z, a.x, a.y) - zxyToTileId(b.z, b.x, b.y));
  const entries: WriterEntry[] = [];
  const blobs: Uint8Array[] = [];
  const seen = new Map<string, number>();
  let offset = 0;
  for (const { z, x, y, bytes } of collected) {
    const key = bytesKey(bytes);
    let blobOffset = seen.get(key);
    if (blobOffset === undefined) {
      blobOffset = offset;
      seen.set(key, blobOffset);
      blobs.push(bytes);
      offset += bytes.length;
    }
    const id = zxyToTileId(z, x, y);
    const last = entries[entries.length - 1];
    if (
      last &&
      last.offset === blobOffset &&
      last.length === bytes.length &&
      last.tileId + last.runLength === id
    ) {
      last.runLength += 1;
    } else {
      entries.push({ tileId: id, offset: blobOffset, length: bytes.length, runLength: 1 });
    }
  }
  const tileData = new Uint8Array(offset);
  let p = 0;
  for (const b of blobs) {
    tileData.set(b, p);
    p += b.length;
  }

  const [minLat, minLon, maxLat, maxLon] = header.bounds;
  const tileType: TileType = inferTileType(header);
  const compression: PMTilesCompression = inferCompression(header);

  const result = buildPMTiles(entries, tileData, {
    minZoom: minZ,
    maxZoom: maxZ,
    minLon: opts.bbox ? opts.bbox[1] : minLon,
    minLat: opts.bbox ? opts.bbox[0] : minLat,
    maxLon: opts.bbox ? opts.bbox[3] : maxLon,
    maxLat: opts.bbox ? opts.bbox[2] : maxLat,
    centerZoom: header.center ? header.center[2] : Math.floor((minZ + maxZ) / 2),
    centerLon: header.center ? header.center[0] : (minLon + maxLon) / 2,
    centerLat: header.center ? header.center[1] : (minLat + maxLat) / 2,
    tileType,
    tileCompression: compression,
    metadata,
  });
  writeFileSync(dst, result.bytes);
  return `Extracted ${entries.length} entries (${result.bytes.length} bytes) → ${dst}`;
}
