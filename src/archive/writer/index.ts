import { writeFileSync } from "fs";
import { COMPRESSION_TO_NUM, TILE_TYPE_TO_NUM, NUM_TO_COMPRESSION, NUM_TO_TILE_TYPE, HEADER_SIZE } from "./constants";
import { gzipData, positionToBytes } from "./encoding";
import { encodeDirectory } from "./directory";
import type { PMTilesCompression, TileType } from "../types";
import type { WriterEntry, WriterResult, PMTilesWriteOptions } from "./types";

export { zxyToTileId, encodeDirectory, decodeDirectory } from "./directory";
export type { WriterEntry, WriterResult, PMTilesWriteOptions } from "./types";

/**
 * Build the bytes of a complete .pmtiles archive from a list of entries
 * (already sorted by tileId) and the corresponding tile bytes (concatenated).
 * @param entries - Tile entries sorted by tileId
 * @param tileData - Concatenated tile bytes
 * @param options - Archive metadata and bounds
 * @throws {Error} If entries are not sorted by tileId
 */
export function buildPMTiles(
  entries: WriterEntry[],
  tileData: Uint8Array,
  options: PMTilesWriteOptions
): WriterResult {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].tileId < entries[i - 1].tileId) {
      throw new Error("PMTiles writer: entries must be sorted by tileId");
    }
  }

  const rootDir = encodeDirectory(entries);
  const rootDirGz = gzipData(rootDir);

  const metaJson = new TextEncoder().encode(JSON.stringify(options.metadata));
  const metaGz = gzipData(metaJson);

  const leafOffset = 0n;
  const leafLength = 0n;

  const rootDirOffset = BigInt(HEADER_SIZE);
  const rootDirLength = BigInt(rootDirGz.length);
  const metaOffset = rootDirOffset + rootDirLength;
  const metaLength = BigInt(metaGz.length);
  const tileDataOffset = metaOffset + metaLength;
  const tileDataLength = BigInt(tileData.length);

  const header = new Uint8Array(HEADER_SIZE);
  const hv = new DataView(header.buffer);

  header.set([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73], 0);
  header[7] = 3;
  hv.setBigUint64(8, rootDirOffset, true);
  hv.setBigUint64(16, rootDirLength, true);
  hv.setBigUint64(24, metaOffset, true);
  hv.setBigUint64(32, metaLength, true);
  hv.setBigUint64(40, leafOffset, true);
  hv.setBigUint64(48, leafLength, true);
  hv.setBigUint64(56, tileDataOffset, true);
  hv.setBigUint64(64, tileDataLength, true);
  const addressed = BigInt(
    entries.reduce((sum, e) => sum + Math.max(0, e.runLength), 0)
  );
  const entryCount = BigInt(entries.filter((e) => e.runLength > 0).length);
  const blobKeys = new Set<string>();
  for (const e of entries) {
    if (e.runLength > 0) blobKeys.add(`${e.offset}:${e.length}`);
  }
  const contents = BigInt(blobKeys.size);
  hv.setBigUint64(72, addressed, true);
  hv.setBigUint64(80, entryCount, true);
  hv.setBigUint64(88, contents, true);
  header[96] = 1;
  header[97] = COMPRESSION_TO_NUM.gzip;
  header[98] = COMPRESSION_TO_NUM[options.tileCompression] ?? COMPRESSION_TO_NUM.unknown;
  header[99] = TILE_TYPE_TO_NUM[options.tileType] ?? TILE_TYPE_TO_NUM.unknown;
  header[100] = options.minZoom;
  header[101] = options.maxZoom;
  const minPos = positionToBytes(options.minLon, options.minLat);
  header.set(minPos, 102);
  const maxPos = positionToBytes(options.maxLon, options.maxLat);
  header.set(maxPos, 110);
  header[118] = options.centerZoom ?? Math.floor((options.minZoom + options.maxZoom) / 2);
  const centerLon = options.centerLon ?? (options.minLon + options.maxLon) / 2;
  const centerLat = options.centerLat ?? (options.minLat + options.maxLat) / 2;
  const centerPos = positionToBytes(centerLon, centerLat);
  header.set(centerPos, 119);

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

/** Read a v3 PMTiles header from bytes.
 * @param bytes - Raw PMTiles file bytes (at least 127)
 * @throws {Error} If file is too short, magic is wrong, or version unsupported
 */
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

/** Save a complete PMTiles archive to disk.
 * @param path - Output file path
 * @param entries - Tile entries sorted by tileId
 * @param tileData - Concatenated tile bytes
 * @param options - Archive metadata and bounds
 */
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
