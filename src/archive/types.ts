export type PMTilesCompression = "unknown" | "none" | "gzip" | "brotli" | "zstd";
export type TileType =
  | "unknown"
  | "mvt"
  | "png"
  | "jpeg"
  | "webp"
  | "avif"
  | "maplibre";

export interface TileArchiveHeader {
  format: "pmtiles" | "mbtiles";
  tileType: TileType | "vector" | "raster";
  compression: PMTilesCompression | string;
  minZoom: number;
  maxZoom: number;
  bounds: [number, number, number, number]; // [south, west, north, east]
  center: [number, number, number] | null;
  tileCount: number;
  vectorLayers?: string[];
}

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

export interface Archive {
  getHeader(): Promise<TileArchiveHeader>;
  getMetadata(): Promise<Record<string, unknown>>;
  getTile(z: number, x: number, y: number): Promise<Uint8Array | undefined>;
  listZooms(): Promise<number[]>;
  listTiles(): AsyncIterable<TileCoordinate>;
  close(): Promise<void>;
}

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConvertReport {
  sourceFormat: string;
  targetFormat: string;
  tileCount: number;
  warnings: string[];
}
