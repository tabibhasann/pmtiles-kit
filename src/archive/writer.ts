/**
 * PMTiles v3 writer — pure JavaScript, no external binary required.
 *
 * Implements the v3 spec (https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md).
 * Used by the `convert` command to write .pmtiles files from .mbtiles sources.
 */

import { writeFileSync } from "fs";
import { gzipSync, gunzipSync } from "zlib";
import { PMTilesCompression, TileType, TileArchiveHeader } from "./types";

function gzipData(data: Uint8Array): Uint8Array {
  return new Uint8Array(gzipSync(Buffer.from(data)));
}

function gunzipData(data: Uint8Array): Uint8Array {
  return new Uint8Array(gunzipSync(Buffer.from(data)));
}

const COMPRESSION_TO_NUM: Record<PMTilesCompression, number> = {
  unknown: 0,
  none: 1,
  gzip: 2,
  brotli: 3,
  zstd: 4,
};

const TILE_TYPE_TO_NUM: Record<TileType, number> = {
  unknown: 0,
  mvt: 1,
  png: 2,
  jpeg: 3,
  webp: 4,
  avif: 5,
  maplibre: 6,
};

const NUM_TO_COMPRESSION: Record<number, PMTilesCompression> = {
  0: "unknown",
  1: "none",
  2: "gzip",
  3: "brotli",
  4: "zstd",
};

const NUM_TO_TILE_TYPE: Record<number, TileType> = {
  0: "unknown",
  1: "mvt",
  2: "png",
  3: "jpeg",
  4: "webp",
  5: "avif",
  6: "maplibre",
};

/** Convert (z,x,y) to a PMTiles TileID using the standard Hilbert curve order.
 *  This algorithm is the reference implementation from the pmtiles JS library.
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

/** Cumulative tile count at the start of each zoom level. */
const TZ_VALUES = [
  0, 1, 5, 21, 85, 341, 1365, 5461, 21845, 87381, 349525, 1398101, 5592405,
  22369621, 89478485, 357913941, 1431655765, 5726623061, 22906492245,
  91625968981, 366503875925, 1466015503701, 5864062014805, 23456248059221,
  93824992236885, 375299968947541, 1501199875790165,
] as const;

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

/** Little-endian varint encoding (Protocol Buffers LEB128). */
function writeVarint(value: number, out: number[]): void {
  let v = value >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
}

function positionToBytes(lon: number, lat: number): Uint8Array {
  // Encode as 4-byte little-endian signed int, value * 1e7
  const lonInt = Math.max(-2147483648, Math.min(2147483647, Math.round(lon * 1e7)));
  const latInt = Math.max(-2147483648, Math.min(2147483647, Math.round(lat * 1e7)));
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setInt32(0, lonInt, true);
  view.setInt32(4, latInt, true);
  return new Uint8Array(buf);
}

function positionFromBytes(view: DataView, offset: number): [number, number] {
  const lon = view.getInt32(offset, true) / 1e7;
  const lat = view.getInt32(offset + 4, true) / 1e7;
  return [lon, lat];
}

function readVarint(view: DataView, state: { pos: number }): number {
  let result = 0;
  let shift = 0;
  for (;;) {
    const byte = view.getUint8(state.pos);
    state.pos += 1;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return result >>> 0;
    shift += 7;
    if (shift > 35) throw new Error("varint too long");
  }
}

export interface WriterEntry {
  tileId: number;
  offset: number;
  length: number;
  runLength: number;
}

export interface WriterResult {
  bytes: Uint8Array;
  header: TileArchiveHeader;
  tileCount: number;
}

export interface PMTilesWriteOptions {
  minZoom: number;
  maxZoom: number;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  centerZoom?: number;
  centerLon?: number;
  centerLat?: number;
  tileType: TileType;
  tileCompression: PMTilesCompression;
  metadata: Record<string, unknown>;
}

/**
 * Build the bytes of a complete .pmtiles archive from a list of entries
 * (already sorted by tileId) and the corresponding tile bytes (concatenated).
 */
export function buildPMTiles(
  entries: WriterEntry[],
  tileData: Uint8Array,
  options: PMTilesWriteOptions
): WriterResult {
  // Sanity: entries must be sorted by tileId
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].tileId < entries[i - 1].tileId) {
      throw new Error("PMTiles writer: entries must be sorted by tileId");
    }
  }

  // 1. Build the root directory (gzip-compressed)
  const rootDir = encodeDirectory(entries);
  const rootDirGz = gzipData(rootDir);

  // 2. Build the metadata (gzip-compressed JSON)
  const metaJson = new TextEncoder().encode(JSON.stringify(options.metadata));
  const metaGz = gzipData(metaJson);

  // 3. No leaf directories for small archives
  const leafOffset = 0n;
  const leafLength = 0n;

  // 4. Layout:
  //    [header 127B][root dir][metadata][leaf dirs (none)][tile data]
  const HEADER_SIZE = 127;
  const rootDirOffset = BigInt(HEADER_SIZE);
  const rootDirLength = BigInt(rootDirGz.length);
  const metaOffset = rootDirOffset + rootDirLength;
  const metaLength = BigInt(metaGz.length);
  const tileDataOffset = metaOffset + metaLength;
  const tileDataLength = BigInt(tileData.length);

  // 5. Write header
  const header = new Uint8Array(HEADER_SIZE);
  const hv = new DataView(header.buffer);

  // Magic "PMTiles"
  header.set([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73], 0);
  // Version
  header[7] = 3;
  // Offsets and lengths (all little-endian 64-bit)
  hv.setBigUint64(8, rootDirOffset, true);
  hv.setBigUint64(16, rootDirLength, true);
  hv.setBigUint64(24, metaOffset, true);
  hv.setBigUint64(32, metaLength, true);
  hv.setBigUint64(40, leafOffset, true);
  hv.setBigUint64(48, leafLength, true);
  hv.setBigUint64(56, tileDataOffset, true);
  hv.setBigUint64(64, tileDataLength, true);
  // Number of addressed tiles, tile entries, tile contents
  const addressed = BigInt(
    entries.reduce((sum, e) => sum + Math.max(0, e.runLength), 0)
  );
  const entryCount = BigInt(entries.filter((e) => e.runLength > 0).length);
  // Unique tile contents = number of distinct (offset, length) blobs
  const blobKeys = new Set<string>();
  for (const e of entries) {
    if (e.runLength > 0) blobKeys.add(`${e.offset}:${e.length}`);
  }
  const contents = BigInt(blobKeys.size);
  hv.setBigUint64(72, addressed, true);
  hv.setBigUint64(80, entryCount, true);
  hv.setBigUint64(88, contents, true);
  // Clustered: 1 if we ordered by tileId (assumed yes for our writer)
  header[96] = 1;
  // Internal compression: gzip
  header[97] = COMPRESSION_TO_NUM.gzip;
  // Tile compression
  header[98] = COMPRESSION_TO_NUM[options.tileCompression] ?? COMPRESSION_TO_NUM.unknown;
  // Tile type
  header[99] = TILE_TYPE_TO_NUM[options.tileType] ?? TILE_TYPE_TO_NUM.unknown;
  // MinZ, MaxZ
  header[100] = options.minZoom;
  header[101] = options.maxZoom;
  // Min position (8 bytes) — lon then lat, each as int32
  const minPos = positionToBytes(options.minLon, options.minLat);
  header.set(minPos, 102);
  // Max position
  const maxPos = positionToBytes(options.maxLon, options.maxLat);
  header.set(maxPos, 110);
  // Center zoom
  header[118] = options.centerZoom ?? Math.floor((options.minZoom + options.maxZoom) / 2);
  // Center position
  const centerLon = options.centerLon ?? (options.minLon + options.maxLon) / 2;
  const centerLat = options.centerLat ?? (options.minLat + options.maxLat) / 2;
  const centerPos = positionToBytes(centerLon, centerLat);
  header.set(centerPos, 119);

  // 6. Concatenate all sections
  const total = HEADER_SIZE + rootDirGz.length + metaGz.length + tileData.length;
  const out = new Uint8Array(total);
  out.set(header, 0);
  out.set(rootDirGz, HEADER_SIZE);
  out.set(metaGz, HEADER_SIZE + rootDirGz.length);
  out.set(tileData, HEADER_SIZE + rootDirGz.length + metaGz.length);

  return {
    bytes: out,
    tileCount: Number(addressed),
    header: {
      format: "pmtiles",
      tileType: options.tileType,
      compression: options.tileCompression,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      bounds: [options.minLat, options.minLon, options.maxLat, options.maxLon],
      center: [centerLon, centerLat, header[118]],
      tileCount: Number(addressed),
      vectorLayers: Array.isArray((options.metadata as { vector_layers?: unknown[] }).vector_layers)
        ? ((options.metadata as { vector_layers: { id: string }[] }).vector_layers.map(
            (l) => l.id
          ))
        : undefined,
    },
  };
}

function encodeDirectory(entries: WriterEntry[]): Uint8Array {
  const buf: number[] = [];
  // Number of entries (varint)
  writeVarint(entries.length, buf);
  // Delta-encoded tileIds
  let lastId = 0;
  for (const e of entries) {
    writeVarint(e.tileId - lastId, buf);
    lastId = e.tileId;
  }
  // RunLengths
  for (const e of entries) {
    writeVarint(e.runLength, buf);
  }
  // Lengths
  for (const e of entries) {
    writeVarint(e.length, buf);
  }
  // Offsets (with deduplication hint: 0 if contiguous with prev)
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

/** Read a v3 PMTiles header from bytes. */
export function readPMTilesHeader(bytes: Uint8Array): {
  rootDirOffset: number;
  rootDirLength: number;
  metaOffset: number;
  metaLength: number;
  leafOffset: number;
  leafLength: number;
  tileDataOffset: number;
  tileDataLength: number;
  clustered: boolean;
  internalCompression: PMTilesCompression;
  tileCompression: PMTilesCompression;
  tileType: TileType;
  minZoom: number;
  maxZoom: number;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  centerZoom: number;
  centerLon: number;
  centerLat: number;
  tileEntries: number;
  tileContents: number;
  addressedTiles: number;
} {
  if (bytes.length < 127) throw new Error("PMTiles file too short");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6]);
  if (magic !== "PMTiles") throw new Error(`Not a PMTiles file (magic: ${magic})`);
  if (bytes[7] !== 3) throw new Error(`Unsupported PMTiles version: ${bytes[7]}`);

  return {
    rootDirOffset: Number(view.getBigUint64(8, true)),
    rootDirLength: Number(view.getBigUint64(16, true)),
    metaOffset: Number(view.getBigUint64(24, true)),
    metaLength: Number(view.getBigUint64(32, true)),
    leafOffset: Number(view.getBigUint64(40, true)),
    leafLength: Number(view.getBigUint64(48, true)),
    tileDataOffset: Number(view.getBigUint64(56, true)),
    tileDataLength: Number(view.getBigUint64(64, true)),
    addressedTiles: Number(view.getBigUint64(72, true)),
    tileEntries: Number(view.getBigUint64(80, true)),
    tileContents: Number(view.getBigUint64(88, true)),
    clustered: bytes[96] === 1,
    internalCompression: NUM_TO_COMPRESSION[bytes[97]] ?? "unknown",
    tileCompression: NUM_TO_COMPRESSION[bytes[98]] ?? "unknown",
    tileType: NUM_TO_TILE_TYPE[bytes[99]] ?? "unknown",
    minZoom: bytes[100],
    maxZoom: bytes[101],
    minLon: view.getInt32(102, true) / 1e7,
    minLat: view.getInt32(106, true) / 1e7,
    maxLon: view.getInt32(110, true) / 1e7,
    maxLat: view.getInt32(114, true) / 1e7,
    centerZoom: bytes[118],
    centerLon: view.getInt32(119, true) / 1e7,
    centerLat: view.getInt32(123, true) / 1e7,
  };
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

/** Position helpers exposed for test/utility use. */
export { positionFromBytes };

/** Save a complete PMTiles archive to disk. */
export function writePMTilesFile(
  path: string,
  entries: WriterEntry[],
  tileData: Uint8Array,
  options: PMTilesWriteOptions
): WriterResult {
  const result = buildPMTiles(entries, tileData, options);
  writeFileSync(path, result.bytes);
  return result;
}
