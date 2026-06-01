import { PMTiles } from "pmtiles";
import { Archive, TileArchiveHeader, ValidationReport } from "./types";
import { isGzipped } from "../util/bytes";

export class PMTilesArchive implements Archive {
  private pmtiles: PMTiles | null = null;
  private _header: TileArchiveHeader | null = null;
  private path: string;

  constructor(path: string) {
    this.path = path;
  }

  async init(): Promise<void> {
    this.pmtiles = new PMTiles(this.path);
    const h = await this.pmtiles.getHeader();
    const metadata = await this.pmtiles.getMetadata();

    const vectorLayers = h.vectorLayers?.map(
      (l: { id: string }) => l.id
    );

    this._header = {
      format: "pmtiles",
      tileType: h.tileType === 1 ? "vector" : "raster",
      compression:
        h.tileCompression === 1 ? "gzip" : h.tileCompression === 2 ? "brotli" : "none",
      minZoom: h.minZoom,
      maxZoom: h.maxZoom,
      bounds: [h.minLat, h.minLon, h.maxLat, h.maxLon],
      center: h.centerLat !== undefined
        ? [h.centerLon!, h.centerLat!, h.centerZoom!]
        : null,
      tileCount: h.tileCount,
      vectorLayers,
    };
  }

  async getHeader(): Promise<TileArchiveHeader> {
    return this._header!;
  }

  async getMetadata(): Promise<Record<string, unknown>> {
    if (!this.pmtiles) throw new Error("Archive not initialized");
    return (await this.pmtiles.getMetadata()) || {};
  }

  async getTile(
    z: number,
    x: number,
    y: number
  ): Promise<Uint8Array | undefined> {
    if (!this.pmtiles) throw new Error("Archive not initialized");
    const resp = await this.pmtiles.getZxy(z, x, y);
    if (!resp) return undefined;
    // PMTiles stores data in the response
    const ab = await resp.data.arrayBuffer();
    return new Uint8Array(ab);
  }

  async listZooms(): Promise<number[]> {
    if (!this._header) return [];
    const zooms: number[] = [];
    for (let z = this._header.minZoom; z <= this._header.maxZoom; z++) {
      zooms.push(z);
    }
    return zooms;
  }

  async close(): Promise<void> {
    // PMTiles lib doesn't need explicit close for file-based access
  }
}
