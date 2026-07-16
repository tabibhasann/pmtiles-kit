export type PMTilesCompression = "unknown" | "none" | "gzip" | "brotli" | "zstd";
export type TileType =
  | "unknown"
  | "mvt"
  | "png"
  | "jpeg"
  | "webp"
  | "avif"
  | "maplibre";

/** Header metadata for a tile archive (PMTiles or MBTiles). */
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

/** A tile coordinate in XYZ (slippy map) convention. */
export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

/** Interface for reading tile archives (PMTiles or MBTiles). */
export interface Archive {
  getHeader(): Promise<TileArchiveHeader>;
  getMetadata(): Promise<Record<string, unknown>>;
  getTile(z: number, x: number, y: number): Promise<Uint8Array | undefined>;
  listZooms(): Promise<number[]>;
  listTiles(): AsyncIterable<TileCoordinate>;
  close(): Promise<void>;
}

/** Result of validating an archive's structural integrity. */
export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Result of converting between archive formats. */
export interface ConvertReport {
  sourceFormat: string;
  targetFormat: string;
  tileCount: number;
  warnings: string[];
}
