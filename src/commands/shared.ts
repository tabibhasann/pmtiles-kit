import { TileArchiveHeader, TileType, PMTilesCompression } from "../archive/types";

export function inferTileType(header: TileArchiveHeader): TileType {
  if (header.tileType === "mvt" || header.tileType === "vector") return "mvt";
  if (header.tileType === "png") return "png";
  if (header.tileType === "jpeg") return "jpeg";
  if (header.tileType === "webp") return "webp";
  if (header.tileType === "avif") return "avif";
  return "unknown";
}

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
