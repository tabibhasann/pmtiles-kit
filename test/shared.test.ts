import { describe, it, expect } from "vitest";
import { inferTileType, inferCompression, detectCompression, bytesKey } from "../src/commands/shared";
import { TileArchiveHeader } from "../src/archive/types";

function makeHeader(overrides: Partial<TileArchiveHeader> = {}): TileArchiveHeader {
  return {
    format: "pmtiles",
    tileType: "mvt",
    compression: "gzip",
    minZoom: 0,
    maxZoom: 14,
    tileCount: 100,
    minLon: -180,
    minLat: -90,
    maxLon: 180,
    maxLat: 90,
    ...overrides,
  } as TileArchiveHeader;
}

describe("inferTileType", () => {
  it("maps mvt correctly", () => {
    expect(inferTileType(makeHeader({ tileType: "mvt" as never }))).toBe("mvt");
  });

  it("maps vector to mvt", () => {
    expect(inferTileType(makeHeader({ tileType: "vector" as never }))).toBe("mvt");
  });

  it("maps png correctly", () => {
    expect(inferTileType(makeHeader({ tileType: "png" as never }))).toBe("png");
  });

  it("maps jpeg correctly", () => {
    expect(inferTileType(makeHeader({ tileType: "jpeg" as never }))).toBe("jpeg");
  });

  it("maps webp correctly", () => {
    expect(inferTileType(makeHeader({ tileType: "webp" as never }))).toBe("webp");
  });

  it("maps avif correctly", () => {
    expect(inferTileType(makeHeader({ tileType: "avif" as never }))).toBe("avif");
  });

  it("returns unknown for unrecognized type", () => {
    expect(inferTileType(makeHeader({ tileType: "foo" as never }))).toBe("unknown");
  });
});

describe("inferCompression", () => {
  it("detects gzip", () => {
    expect(inferCompression(makeHeader({ compression: "gzip" as never }))).toBe("gzip");
  });

  it("detects brotli", () => {
    expect(inferCompression(makeHeader({ compression: "brotli" as never }))).toBe("brotli");
  });

  it("detects zstd", () => {
    expect(inferCompression(makeHeader({ compression: "zstd" as never }))).toBe("zstd");
  });

  it("detects none", () => {
    expect(inferCompression(makeHeader({ compression: "none" as never }))).toBe("none");
  });

  it("detects identity as none", () => {
    expect(inferCompression(makeHeader({ compression: "identity" as never }))).toBe("none");
  });

  it("defaults to gzip for mbtiles", () => {
    expect(inferCompression(makeHeader({ format: "mbtiles", compression: "" as never }))).toBe("gzip");
  });

  it("returns unknown for unrecognized compression in pmtiles", () => {
    expect(inferCompression(makeHeader({ compression: "foo" as never }))).toBe("unknown");
  });
});

describe("detectCompression", () => {
  it("detects gzip magic bytes", () => {
    const bytes = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]);
    expect(detectCompression(bytes)).toBe("gzip");
  });

  it("detects zstd magic bytes", () => {
    const bytes = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd]);
    expect(detectCompression(bytes)).toBe("zstd");
  });

  it("returns none for uncompressed data", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(detectCompression(bytes)).toBe("none");
  });

  it("returns none for empty array", () => {
    expect(detectCompression(new Uint8Array(0))).toBe("none");
  });

  it("returns none for single byte", () => {
    expect(detectCompression(new Uint8Array([0x1f]))).toBe("none");
  });
});

describe("bytesKey", () => {
  it("produces consistent hash for same input", () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4, 5]);
    expect(bytesKey(a)).toBe(bytesKey(b));
  });

  it("produces different hash for different input", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([3, 2, 1]);
    expect(bytesKey(a)).not.toBe(bytesKey(b));
  });

  it("includes length in key", () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([1, 2, 3]);
    expect(bytesKey(a)).not.toBe(bytesKey(b));
    expect(bytesKey(a).startsWith("2:")).toBe(true);
    expect(bytesKey(b).startsWith("3:")).toBe(true);
  });

  it("handles empty array", () => {
    const key = bytesKey(new Uint8Array(0));
    expect(key.startsWith("0:")).toBe(true);
  });
});
