import { TileArchiveHeader, TileType, PMTilesCompression } from "../archive/types";
import { zxyToTileId, WriterEntry } from "../archive/writer";

/** Infer the tile type (mvt, png, jpeg, etc.) from an archive header. */
export function inferTileType(header: TileArchiveHeader): TileType {
  if (header.tileType === "mvt" || header.tileType === "vector") return "mvt";
  if (header.tileType === "png") return "png";
  if (header.tileType === "jpeg") return "jpeg";
  if (header.tileType === "webp") return "webp";
  if (header.tileType === "avif") return "avif";
  return "unknown";
}

/** Infer the compression format from an archive header. */
export function inferCompression(header: TileArchiveHeader): PMTilesCompression {
  const c = (header.compression || "").toString().toLowerCase();
  if (c === "gzip") return "gzip";
  if (c === "brotli") return "brotli";
  if (c === "zstd") return "zstd";
  if (c === "none" || c === "identity") return "none";
  if (header.format === "mbtiles") return "gzip";
  return "unknown";
}

/** Auto-detect compression from raw tile bytes by looking at the magic. */
export function detectCompression(bytes: Uint8Array): PMTilesCompression {
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return "gzip";
  if (bytes.length >= 4 && bytes[0] === 0x28 && bytes[1] === 0xb5) return "zstd";
  return "none";
}

/** FNV-1a hash for deduplication — collision probability ~1/2^32 per pair. */
export function bytesKey(b: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) {
    hash ^= b[i]!;
    hash = Math.imul(hash, 0x01000193);
  }
  return `${b.length}:${(hash >>> 0).toString(16)}`;
}

export interface CollectedTile {
  z: number;
  x: number;
  y: number;
  bytes: Uint8Array;
}

export interface BuiltEntries {
  entries: WriterEntry[];
  tileData: Uint8Array;
  deduplicated: number;
}

/**
 * Sort collected tiles by Hilbert tileId, deduplicate by exact bytes,
 * build run-length-encoded entries, and concatenate the tile data section.
 * Shared by the `convert` and `extract` commands.
 */
export function buildEntriesAndTileData(collected: CollectedTile[]): BuiltEntries {
  collected.sort((a, b) => zxyToTileId(a.z, a.x, a.y) - zxyToTileId(b.z, b.x, b.y));

  const entries: WriterEntry[] = [];
  const blobs: Uint8Array[] = [];
  const seen = new Map<string, number>();
  let offset = 0;
  let deduplicated = 0;

  for (const { z, x, y, bytes } of collected) {
    const key = bytesKey(bytes);
    let blobOffset = seen.get(key);
    if (blobOffset === undefined) {
      blobOffset = offset;
      seen.set(key, blobOffset);
      blobs.push(bytes);
      offset += bytes.length;
    } else {
      deduplicated += 1;
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

  return { entries, tileData, deduplicated };
}
