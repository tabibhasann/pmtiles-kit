import { PMTiles } from "pmtiles";
import { Archive, TileArchiveHeader, TileCoordinate } from "./types";
import { NodeFileSource } from "./node-source";

function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
  return { x, y };
}

/**
 * PMTiles archive reader using the `pmtiles` npm library.
 *
 * Supports local files (via NodeFileSource) and HTTP URLs (via HttpRangeSource).
 */
export class PMTilesArchive implements Archive {
  private pmtiles: PMTiles | null = null;
  private _header: TileArchiveHeader | null = null;
  private path: string;

  /**
   * @param path - Path to the .pmtiles file
   * @param source - Optional pre-configured source (e.g. HttpRangeSource for remote archives)
   */
  constructor(path: string, source?: unknown) {
    this.path = path;
    if (source) {
      this.pmtiles = new PMTiles(source as ConstructorParameters<typeof PMTiles>[0]);
    }
  }

  /** Initialize the archive by reading the header and metadata. Must be called before any other method. */
  async init(): Promise<void> {
    if (!this.pmtiles) {
      this.pmtiles = new PMTiles(new NodeFileSource(this.path) as unknown as ConstructorParameters<typeof PMTiles>[0]);
    }
    const h = await this.pmtiles.getHeader();
    const metadata = (await this.pmtiles.getMetadata()) as Record<string, unknown>;

    // vector_layers lives in metadata per the v3 spec, not the header
    const vecLayersRaw = metadata?.vector_layers;
    const vectorLayers = Array.isArray(vecLayersRaw)
      ? (vecLayersRaw as { id: string }[]).map((l) => l.id)
      : undefined;

    this._header = {
      format: "pmtiles",
      tileType:
        h.tileType === 1
          ? "mvt"
          : h.tileType === 2
            ? "png"
            : h.tileType === 3
              ? "jpeg"
              : h.tileType === 4
                ? "webp"
                : h.tileType === 5
                  ? "avif"
                  : "unknown",
      compression:
        h.tileCompression === 1
          ? "none"
          : h.tileCompression === 2
            ? "gzip"
            : h.tileCompression === 3
              ? "brotli"
              : h.tileCompression === 4
                ? "zstd"
                : "unknown",
      minZoom: h.minZoom,
      maxZoom: h.maxZoom,
      bounds: [h.minLat, h.minLon, h.maxLat, h.maxLon],
      center: [h.centerLon, h.centerLat, h.centerZoom],
      tileCount: h.numAddressedTiles,
      vectorLayers,
    };
  }

  /** @returns The parsed archive header */
  async getHeader(): Promise<TileArchiveHeader> {
    return this._header!;
  }

  /**
   * @returns The archive metadata as a key-value object
   * @throws {Error} If the archive has not been initialized
   */
  async getMetadata(): Promise<Record<string, unknown>> {
    if (!this.pmtiles) throw new Error("Archive not initialized");
    return ((await this.pmtiles.getMetadata()) || {}) as Record<string, unknown>;
  }

  /**
   * @param z - Zoom level
   * @param x - Tile column (XYZ)
   * @param y - Tile row (XYZ)
   * @returns The tile bytes, or undefined if the tile doesn't exist
   * @throws {Error} If the archive has not been initialized
   */
  async getTile(
    z: number,
    x: number,
    y: number
  ): Promise<Uint8Array | undefined> {
    if (!this.pmtiles) throw new Error("Archive not initialized");
    const resp = await this.pmtiles.getZxy(z, x, y);
    if (!resp) return undefined;
    // PMTiles returns { data: ArrayBuffer } from a custom Source
    return new Uint8Array(resp.data);
  }

  /** @returns Array of zoom levels present in the archive */
  async listZooms(): Promise<number[]> {
    if (!this._header) return [];
    const zooms: number[] = [];
    for (let z = this._header.minZoom; z <= this._header.maxZoom; z++) {
      zooms.push(z);
    }
    return zooms;
  }

  /** @returns An async iterable of tile coordinates in the archive */
  async *listTiles(): AsyncIterable<TileCoordinate> {
    if (!this.pmtiles || !this._header) return;

    // We use a brute-force scan over the bounds, but query the archive via
    // the official PMTiles library (which uses the directory internally)
    // rather than re-implementing the Hilbert curve mapping.
    //
    // This is correct, but slow for very large archives. PMTiles doesn't
    // expose a directory listing through the public API.
    const { minZoom, maxZoom, bounds } = this._header;
    const [minLat, minLon, maxLat, maxLon] = bounds;

    for (let z = minZoom; z <= maxZoom; z++) {
      const minTile = lonLatToTile(minLon, maxLat, z);
      const maxTile = lonLatToTile(maxLon, minLat, z);
      const xMin = Math.max(0, minTile.x);
      const xMax = Math.min((1 << z) - 1, maxTile.x);
      const yMin = Math.max(0, minTile.y);
      const yMax = Math.min((1 << z) - 1, maxTile.y);
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          try {
            const resp = await this.pmtiles.getZxy(z, x, y);
            if (resp) {
              yield { z, x, y };
            }
          } catch {
            // ignore lookup errors
          }
        }
      }
    }
  }

  /** Release any resources held by the archive. */
  async close(): Promise<void> {
    // PMTiles lib doesn't need explicit close for file-based access
  }
}
