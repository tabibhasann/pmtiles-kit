import Database from "better-sqlite3";
import { Archive, TileArchiveHeader } from "./types";
import { tmsToXYZ } from "../util/bytes";

export class MBTilesArchive implements Archive {
  private db: Database.Database | null = null;
  private _header: TileArchiveHeader | null = null;
  private path: string;

  constructor(path: string) {
    this.path = path;
  }

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

    const bounds = metadata["bounds"]
      ? (metadata["bounds"].split(",").map(Number) as [
          number,
          number,
          number,
          number
        ])
      : ([-85, -180, 85, 180] as [number, number, number, number]);

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

  async getHeader(): Promise<TileArchiveHeader> {
    return this._header!;
  }

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

  async listZooms(): Promise<number[]> {
    if (!this.db) return [];
    const rows = this.db
      .prepare("SELECT DISTINCT zoom_level FROM tiles ORDER BY zoom_level")
      .all() as { zoom_level: number }[];
    return rows.map((r) => r.zoom_level);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
