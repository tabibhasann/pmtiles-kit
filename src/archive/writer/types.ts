import type { PMTilesCompression, TileType, TileArchiveHeader } from "../types";

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
