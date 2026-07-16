/**
 * HTTP Source for PMTiles — reads remote archives via HTTP Range requests.
 *
 * Uses fetch() with Range headers to read only the bytes needed.
 * Falls back to a full download if the server doesn't support range requests.
 */
export class HttpRangeSource {
  private cache: Map<string, ArrayBuffer> = new Map();
  private supportsRange: boolean | null = null;

  /** @param url - HTTP(S) URL of the remote .pmtiles file */
  constructor(private url: string) {
    this.key = `http:${url}`;
  }

  /** @returns A unique cache key for this source */
  async getKey(): Promise<string> {
    return this.key;
  }

  private async fetchRange(offset: number, length: number): Promise<ArrayBuffer> {
    const end = offset + length - 1;
    const resp = await fetch(this.url, {
      headers: { Range: `bytes=${offset}-${end}` },
      signal: AbortSignal.timeout(30000),
    });

    if (resp.status === 206) {
      this.supportsRange = true;
      return await resp.arrayBuffer();
    }

    if (resp.status === 200) {
      // Server doesn't support range — return the full body sliced
      this.supportsRange = false;
      const buf = await resp.arrayBuffer();
      return buf.slice(offset, offset + length);
    }

    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }

  /**
   * @param offset - Byte offset to start reading from
   * @param length - Number of bytes to read
   * @returns An object containing the requested byte range as an ArrayBuffer
   * @throws {Error} If the HTTP request fails or returns an unexpected status
   */
  async getBytes(offset: number, length: number): Promise<{ data: ArrayBuffer }> {
    const cacheKey = `${offset}:${length}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { data: cached };
    }

    const data = await this.fetchRange(offset, length);
    // Cache small reads (header + directory)
    if (length <= 65536) {
      this.cache.set(cacheKey, data);
    }

    return { data };
  }
}
