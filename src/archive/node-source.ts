/**
 * Node.js Source for the pmtiles library.
 *
 * The pmtiles npm library expects a `Source` interface. Its built-in
 * `FileSource` is browser-only (uses the `File` API). `FetchSource`
 * works for HTTP(S) URLs. Neither works for a local file path.
 *
 * This source reads the file once and answers `getBytes()` via in-memory slicing.
 * PMTiles archives are small enough (planet PMTiles is < 100 GB, but typical
 * regional/working archives are MB to single-digit GB) that this is fine
 * for the CLI use case.
 */

import { promises as fs } from "fs";

export class NodeFileSource {
  private key: string;
  private buffer?: ArrayBuffer;

  /** @param path - Path to the local .pmtiles file */
  constructor(private path: string) {
    this.key = `node:${path}`;
  }

  /** @returns A unique cache key for this source */
  async getKey(): Promise<string> {
    return this.key;
  }

  private async ensureLoaded(): Promise<ArrayBuffer> {
    if (this.buffer) return this.buffer;
    const buf = await fs.readFile(this.path);
    // Slice to a fresh ArrayBuffer so DataView can use byteOffset 0
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    this.buffer = ab;
    return ab;
  }

  /**
   * @param offset - Byte offset to start reading from
   * @param length - Number of bytes to read
   * @returns An object containing the requested byte range as an ArrayBuffer
   */
  async getBytes(offset: number, length: number): Promise<{ data: ArrayBuffer }> {
    const buf = await this.ensureLoaded();
    // The pmtiles library reads a fixed 16 KB window for the header+root dir
    // even on small archives. Clamp to the actual file size and return what we have.
    const safeLength = Math.max(0, Math.min(length, buf.byteLength - offset));
    if (safeLength <= 0) {
      return { data: new ArrayBuffer(0) };
    }
    // Return a copy so callers can mutate without affecting the buffer
    const out = buf.slice(offset, offset + safeLength);
    return { data: out };
  }
}
