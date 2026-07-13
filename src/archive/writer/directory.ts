import { TZ_VALUES } from "./constants";
import { writeVarint, readVarint, gunzipData } from "./encoding";
import type { PMTilesCompression } from "../types";
import type { WriterEntry } from "./types";

/** Convert (z,x,y) to a PMTiles TileID using the standard Hilbert curve order.
 *  This algorithm is the reference implementation from the pmtiles JS library.
 * @param z - Zoom level (0–26)
 * @param x - Tile column
 * @param y - Tile row
 * @returns Hilbert-ordered tile ID
 * @throws {Error} If zoom > 26 or x/y outside zoom bounds
 */
export function zxyToTileId(z: number, x: number, y: number): number {
  if (z > 26) throw new Error("Tile zoom level exceeds max safe number limit (26)");
  if (x > (1 << z) - 1 || y > (1 << z) - 1) {
    throw new Error("tile x/y outside zoom level bounds");
  }
  const acc = TZ_VALUES[z];
  const n = 1 << z;
  let rx = 0;
  let ry = 0;
  let d = 0;
  const xy: [number, number] = [x, y];
  let s = n / 2;
  while (s > 0) {
    rx = (xy[0] & s) > 0 ? 1 : 0;
    ry = (xy[1] & s) > 0 ? 1 : 0;
    d += s * s * (3 * rx ^ ry);
    rotate(s, xy, rx, ry);
    s = s / 2;
  }
  return acc + d;
}

function rotate(n: number, xy: [number, number], rx: number, ry: number): void {
  if (ry === 0) {
    if (rx === 1) {
      xy[0] = n - 1 - xy[0];
      xy[1] = n - 1 - xy[1];
    }
    const t = xy[0];
    xy[0] = xy[1];
    xy[1] = t;
  }
}

/** Encode directory entries into PMTiles v3 directory bytes. */
export function encodeDirectory(entries: WriterEntry[]): Uint8Array {
  const buf: number[] = [];
  writeVarint(entries.length, buf);
  let lastId = 0;
  for (const e of entries) {
    writeVarint(e.tileId - lastId, buf);
    lastId = e.tileId;
  }
  for (const e of entries) {
    writeVarint(e.runLength, buf);
  }
  for (const e of entries) {
    writeVarint(e.length, buf);
  }
  let nextByte = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (i > 0 && e.offset === nextByte) {
      writeVarint(0, buf);
    } else {
      writeVarint(e.offset + 1, buf);
    }
    nextByte = e.offset + e.length;
  }
  return new Uint8Array(buf);
}

/** Decode a (gzip-compressed) root directory. */
export function decodeDirectory(bytes: Uint8Array, internalCompression: PMTilesCompression): WriterEntry[] {
  const decompressed =
    internalCompression === "gzip" ? gunzipData(bytes) : bytes;
  const view = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
  const state = { pos: 0 };
  const numEntries = readVarint(view, state);
  const entries: WriterEntry[] = [];
  let lastId = 0;
  for (let i = 0; i < numEntries; i++) {
    lastId += readVarint(view, state);
    entries.push({ tileId: lastId, offset: 0, length: 0, runLength: 0 });
  }
  for (let i = 0; i < numEntries; i++) {
    entries[i]!.runLength = readVarint(view, state);
  }
  for (let i = 0; i < numEntries; i++) {
    entries[i]!.length = readVarint(view, state);
  }
  for (let i = 0; i < numEntries; i++) {
    const v = readVarint(view, state);
    if (v === 0 && i > 0) {
      const prev = entries[i - 1]!;
      entries[i]!.offset = prev.offset + prev.length;
    } else {
      entries[i]!.offset = v - 1;
    }
  }
  return entries;
}
