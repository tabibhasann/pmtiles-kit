import { gzipSync, gunzipSync } from "zlib";

/** Gzip-compress a Uint8Array using zlib. */
export function gzipData(data: Uint8Array): Uint8Array {
  return new Uint8Array(gzipSync(Buffer.from(data)));
}

/** Decompress a gzipped Uint8Array using zlib. */
export function gunzipData(data: Uint8Array): Uint8Array {
  return new Uint8Array(gunzipSync(Buffer.from(data)));
}

/** Little-endian varint encoding (Protocol Buffers LEB128). */
export function writeVarint(value: number, out: number[]): void {
  let v = value >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
}

/** Read a little-endian varint from a DataView at the current position. */
export function readVarint(view: DataView, state: { pos: number }): number {
  let result = 0;
  let shift = 0;
  for (;;) {
    const byte = view.getUint8(state.pos);
    state.pos += 1;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return result >>> 0;
    shift += 7;
    if (shift > 35) throw new Error("varint too long");
  }
}

/** Encode a lon/lat pair into 8 bytes (two little-endian int32s at 1e7 precision). */
export function positionToBytes(lon: number, lat: number): Uint8Array {
  const lonInt = Math.max(-2147483648, Math.min(2147483647, Math.round(lon * 1e7)));
  const latInt = Math.max(-2147483648, Math.min(2147483647, Math.round(lat * 1e7)));
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setInt32(0, lonInt, true);
  view.setInt32(4, latInt, true);
  return new Uint8Array(buf);
}
