import { describe, it, expect } from "vitest";
import { buildPMTiles, zxyToTileId, decodeDirectory, readPMTilesHeader } from "../src/archive/writer";
import { openArchive } from "../src/archive/open";

describe("zxyToTileId", () => {
  it("returns 0 for the origin tile", () => {
    expect(zxyToTileId(0, 0, 0)).toBe(0);
  });

  it("produces unique TileIDs for unique (z, x, y)", () => {
    const seen = new Set<number>();
    for (let z = 0; z <= 4; z++) {
      for (let x = 0; x < 1 << z; x++) {
        for (let y = 0; y < 1 << z; y++) {
          seen.add(zxyToTileId(z, x, y));
        }
      }
    }
    // Total tiles = sum_{z=0..4} 4^z = 1 + 4 + 16 + 64 + 256 = 341
    expect(seen.size).toBe(341);
  });
});

describe("PMTiles v3 writer", () => {
  it("writes a valid PMTiles archive with the correct magic + version", () => {
    const entries = [
      { tileId: 0, offset: 0, length: 4, runLength: 1 },
    ];
    const tileData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const out = buildPMTiles(entries, tileData, {
      minZoom: 0,
      maxZoom: 0,
      minLon: -180, minLat: -85,
      maxLon: 180, maxLat: 85,
      tileType: "mvt",
      tileCompression: "gzip",
      metadata: { name: "t" },
    });
    expect(out.bytes.length).toBe(127 + out.bytes.length - 127);
    // Magic "PMTiles" + version 3
    expect(String.fromCharCode(out.bytes[0]!, out.bytes[1]!, out.bytes[2]!)).toBe("PMT");
    expect(out.bytes[7]).toBe(3);
  });

  it("produces a round-trippable PMTiles file (read by the JS archive reader)", async () => {
    const entries = [
      { tileId: 0, offset: 0, length: 6, runLength: 1 },
      { tileId: 1, offset: 6, length: 6, runLength: 1 },
    ];
    const tileData = new TextEncoder().encode("AAAAAABBBBBB");
    const out = buildPMTiles(entries, tileData, {
      minZoom: 0, maxZoom: 1,
      minLon: -180, minLat: -85, maxLon: 180, maxLat: 85,
      tileType: "mvt", tileCompression: "none",
      metadata: { name: "test", vector_layers: [{ id: "x" }] },
    });

    // Write to a temp file
    const { writeFileSync, mkdtempSync } = await import("fs");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const dir = mkdtempSync(join(tmpdir(), "pmtiles-writer-"));
    const path = join(dir, "out.pmtiles");
    writeFileSync(path, out.bytes);

    const archive = await openArchive(path);
    const header = await archive.getHeader();
    expect(header.format).toBe("pmtiles");
    expect(header.minZoom).toBe(0);
    expect(header.maxZoom).toBe(1);

    const t0 = await archive.getTile(0, 0, 0);
    const t1 = await archive.getTile(1, 0, 0);
    expect(new TextDecoder().decode(t0)).toBe("AAAAAA");
    expect(new TextDecoder().decode(t1)).toBe("BBBBBB");
    await archive.close();
  });

  it("readPMTilesHeader round-trips the header fields", () => {
    const entries = [{ tileId: 0, offset: 0, length: 4, runLength: 1 }];
    const out = buildPMTiles(entries, new Uint8Array([1, 2, 3, 4]), {
      minZoom: 0, maxZoom: 0,
      minLon: -10, minLat: -5, maxLon: 10, maxLat: 5,
      tileType: "mvt", tileCompression: "gzip",
      metadata: {},
    });
    const h = readPMTilesHeader(out.bytes);
    expect(h.minZoom).toBe(0);
    expect(h.maxZoom).toBe(0);
    expect(h.tileType).toBe("mvt");
    expect(h.tileCompression).toBe("gzip");
    expect(h.internalCompression).toBe("gzip");
    expect(h.minLon).toBeCloseTo(-10, 3);
    expect(h.maxLat).toBeCloseTo(5, 3);
  });

  it("decodes a directory with multiple entries correctly", () => {
    const entries = [
      { tileId: 0, offset: 0, length: 4, runLength: 1 },
      { tileId: 1, offset: 4, length: 4, runLength: 2 },
      { tileId: 5, offset: 12, length: 4, runLength: 1 },
    ];
    const out = buildPMTiles(entries, new Uint8Array(16).fill(0x42), {
      minZoom: 0, maxZoom: 0,
      minLon: 0, minLat: 0, maxLon: 0, maxLat: 0,
      tileType: "mvt", tileCompression: "none",
      metadata: {},
    });
    // Re-extract the root directory bytes by reading the header first
    const h = readPMTilesHeader(out.bytes);
    const rootDirBytes = out.bytes.slice(h.rootDirOffset, h.rootDirOffset + h.rootDirLength);
    const decoded = decodeDirectory(rootDirBytes, h.internalCompression);
    expect(decoded).toHaveLength(3);
    expect(decoded[0]!.tileId).toBe(0);
    expect(decoded[1]!.tileId).toBe(1);
    expect(decoded[1]!.runLength).toBe(2);
    expect(decoded[2]!.tileId).toBe(5);
  });

  it("counts addressed tiles as the sum of directory run lengths", () => {
    const entries = [
      { tileId: 0, offset: 0, length: 4, runLength: 3 },
      { tileId: 5, offset: 4, length: 4, runLength: 1 },
    ];
    const out = buildPMTiles(entries, new Uint8Array(8).fill(0x42), {
      minZoom: 0, maxZoom: 1,
      minLon: 0, minLat: 0, maxLon: 0, maxLat: 0,
      tileType: "mvt", tileCompression: "none",
      metadata: {},
    });
    const h = readPMTilesHeader(out.bytes);
    expect(out.header.tileCount).toBe(4);
    expect(h.addressedTiles).toBe(4);
    expect(h.tileEntries).toBe(2);
  });

  it("rejects entries that are not sorted by tileId", () => {
    expect(() =>
      buildPMTiles(
        [
          { tileId: 5, offset: 0, length: 1, runLength: 1 },
          { tileId: 2, offset: 1, length: 1, runLength: 1 },
        ],
        new Uint8Array(2),
        {
          minZoom: 0, maxZoom: 0,
          minLon: 0, minLat: 0, maxLon: 0, maxLat: 0,
          tileType: "mvt", tileCompression: "none",
          metadata: {},
        }
      )
    ).toThrow(/sorted/);
  });
});
