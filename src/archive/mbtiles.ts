import Database from "better-sqlite3";
import { Archive, TileArchiveHeader, TileCoordinate } from "./types";
import { tmsToXYZ } from "../util/bytes";

/**
 * MBTiles archive reader using `better-sqlite3`.
 *
 * Reads tiles from a SQLite-based MBTiles database, converting TMS Y coordinates
 * to XYZ on the fly so callers always get XYZ tiles.
 */
export class MBTilesArchive implements Archive {
  private db: Database.Database | null = null;
  private _header: TileArchiveHeader | null = null;
  private path: string;

  /** @param path - Path to the .mbtiles file */
  constructor(path: string) {
    this.path = path;
  }

  /** Open the SQLite database and read the header. Must be called before any other method. */
  init(): void {
    this.db = new Database(this.path, { readonly: true });
    this._header = this._readHeader();
  }

  private _readHeader(): TileArchiveHeader {
    if (!this.db) throw new Error("Database not initialized");

    const metadataRows = this.db
      .prepare("SELECT name, value FROM metadata")
      .all() as { name: string; value: string }[];

    const metadata: Record<string, string> = {};
    for (const row of metadataRows) {
      metadata[row.name] = row.value;
    }

    const format = metadata["format"] || "pbf";
    const tileType = format === "pbf" || format === "mvt" ? "vector" : "raster";

    let vectorLayers: string[] | undefined;
    if (metadata["json"]) {
      try {
        const json = JSON.parse(metadata["json"]);
        if (json.vector_layers) {
          vectorLayers = json.vector_layers.map(
            (l: { id: string }) => l.id
          );
        }
      } catch {
        // ignore
      }
    }

    const boundsRaw = metadata["bounds"]
      ? (metadata["bounds"].split(",").map(Number) as [
          number,
          number,
          number,
          number
        ])
      : ([-180, -85, 180, 85] as [number, number, number, number]);
    
    // MBTiles stores bounds as [west, south, east, north]
    // Convert to internal format [south, west, north, east]
    const bounds: [number, number, number, number] = [
      boundsRaw[1], // south
      boundsRaw[0], // west
      boundsRaw[3], // north
      boundsRaw[2], // east
    ];

    const center = metadata["center"]
      ? (metadata["center"].split(",").map(Number) as [
          number,
          number,
          number
        ])
      : null;

    const zoomRange = this._getZoomRange();

    return {
      format: "mbtiles",
      tileType,
      compression: "gzip",
      minZoom: zoomRange.min,
      maxZoom: zoomRange.max,
      bounds,
      center,
      tileCount: this._tileCount(),
      vectorLayers,
    };
  }

  private _getZoomRange(): { min: number; max: number } {
    if (!this.db) return { min: 0, max: 0 };
    const row = this.db
      .prepare(
        "SELECT MIN(zoom_level) as min, MAX(zoom_level) as max FROM tiles"
      )
      .get() as { min: number; max: number };
    return { min: row?.min ?? 0, max: row?.max ?? 0 };
  }

  private _tileCount(): number {
    if (!this.db) return 0;
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM tiles")
      .get() as { count: number };
    return row?.count ?? 0;
  }

  /** @returns The parsed archive header */
  async getHeader(): Promise<TileArchiveHeader> {
    return this._header!;
  }

  /**
   * @returns The metadata table as a key-value object
   * @throws {Error} If the database has not been initialized
   */
  async getMetadata(): Promise<Record<string, unknown>> {
    if (!this.db) throw new Error("Database not initialized");
    const rows = this.db
      .prepare("SELECT name, value FROM metadata")
      .all() as { name: string; value: string }[];
    const meta: Record<string, unknown> = {};
    for (const row of rows) {
      meta[row.name] = row.value;
    }
    return meta;
  }

  /*
   * CRITICAL: MBTiles uses TMS (Y origin bottom), but our API uses XYZ (top).
   * We flip Y on read so callers always get XYZ tiles.
   */
  /**
   * @param z - Zoom level
   * @param x - Tile column (XYZ)
   * @param y - Tile row (XYZ, will be converted to TMS internally)
   * @returns The tile bytes, or undefined if the tile doesn't exist
   * @throws {Error} If the database has not been initialized
   */
  async getTile(
    z: number,
    x: number,
    y: number
  ): Promise<Uint8Array | undefined> {
    if (!this.db) throw new Error("Database not initialized");
    const yTms = tmsToXYZ(z, y);
    const row = this.db
      .prepare(
        "SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?"
      )
      .get(z, x, yTms) as { tile_data: Buffer } | undefined;
    return row ? new Uint8Array(row.tile_data) : undefined;
  }

  /** @returns Array of zoom levels present in the archive */
  async listZooms(): Promise<number[]> {
    if (!this.db) return [];
    const rows = this.db
      .prepare("SELECT DISTINCT zoom_level FROM tiles ORDER BY zoom_level")
      .all() as { zoom_level: number }[];
    return rows.map((r) => r.zoom_level);
  }

  /** @returns An async iterable of tile coordinates (in XYZ) in the archive */
  async *listTiles(): AsyncIterable<TileCoordinate> {
    if (!this.db) return;
    
    // Query all tile coordinates directly from the database
    const rows = this.db
      .prepare("SELECT zoom_level, tile_column, tile_row FROM tiles")
      .all() as { zoom_level: number; tile_column: number; tile_row: number }[];
    
    for (const row of rows) {
      // Convert from TMS (stored in DB) to XYZ (our API)
      yield {
        z: row.zoom_level,
        x: row.tile_column,
        y: tmsToXYZ(row.zoom_level, row.tile_row),
      };
    }
  }

  /** Close the SQLite database connection. */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
