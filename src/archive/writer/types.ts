import type { PMTilesCompression, TileType, TileArchiveHeader } from "../types";

/** A single entry in the PMTiles directory (run-length encoded). */
export interface WriterEntry {
  tileId: number;
  offset: number;
  length: number;
  runLength: number;
}

/** Result of building a PMTiles archive: the bytes, header, and tile count. */
export interface WriterResult {
  bytes: Uint8Array;
  header: TileArchiveHeader;
  tileCount: number;
}

/** Options for building a PMTiles archive (bounds, zooms, tile type, metadata). */
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
