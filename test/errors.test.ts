import { describe, it, expect, afterAll } from "vitest";
import { zxyToTileId, buildPMTiles, readPMTilesHeader, decodeDirectory, writePMTilesFile } from "../src/archive/writer";
import { openArchive } from "../src/archive/open";
import { makeFixtureTiles } from "./fixtures";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Error path tests", () => {
  const tmpDir = join(tmpdir(), `pmtiles-kit-err-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws on tile zoom exceeding max safe limit (26)", () => {
    expect(() => zxyToTileId(27, 0, 0)).toThrow(/zoom level/i);
  });

  it("throws on tile x/y outside zoom level bounds", () => {
    expect(() => zxyToTileId(2, 5, 0)).toThrow(/bounds/i);
    expect(() => zxyToTileId(2, 0, 5)).toThrow(/bounds/i);
  });

  it("throws on PMTiles file too short (< 127 bytes)", () => {
    const tiny = new Uint8Array(50);
    expect(() => readPMTilesHeader(tiny)).toThrow(/too short/i);
  });

  it("throws on invalid PMTiles magic bytes", () => {
    const fake = new Uint8Array(127);
    fake.set([0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47], 0);
    expect(() => readPMTilesHeader(fake)).toThrow(/Not a PMTiles file/i);
  });

  it("throws on unsupported PMTiles version", () => {
    const fake = new Uint8Array(127);
    fake.set([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73], 0);
    fake[7] = 99;
    expect(() => readPMTilesHeader(fake)).toThrow(/Unsupported PMTiles version/i);
  });

  it("throws on unsorted entries in buildPMTiles", () => {
    const entries = [
      { tileId: 5, offset: 0, length: 10, runLength: 1 },
      { tileId: 1, offset: 10, length: 10, runLength: 1 },
    ];
    const tileData = new Uint8Array(20);
    expect(() =>
      buildPMTiles(entries, tileData, {
        minZoom: 0, maxZoom: 1, minLon: -180, minLat: -85, maxLon: 180, maxLat: 85,
        tileType: "mvt", tileCompression: "gzip", metadata: {},
      })
    ).toThrow(/sorted by tileId/i);
  });

  it("throws on unsupported file type in openArchive", async () => {
    const badPath = join(tmpDir, "unknown.xyz");
    writeFileSync(badPath, Buffer.from("hello"));
    await expect(openArchive(badPath)).rejects.toThrow(/Unsupported file type/i);
  });

  it("throws on nonexistent file in openArchive", async () => {
    await expect(openArchive(join(tmpDir, "nonexistent.pmtiles"))).rejects.toThrow();
  });

  it("throws on MBTiles over HTTP", async () => {
    await expect(openArchive("https://example.com/tiles.mbtiles")).rejects.toThrow(/MBTiles over HTTP/i);
  });

  it("decodeDirectory throws on truncated varint data", () => {
    const raw = new Uint8Array([0x80]);
    expect(() => decodeDirectory(raw, "none")).toThrow();
  });

  it("writePMTilesFile writes valid file to disk", () => {
    const path = join(tmpDir, "write-test.pmtiles");
    const tiles = makeFixtureTiles();
    tiles.sort((a, b) => zxyToTileId(a.z, a.x, a.y) - zxyToTileId(b.z, b.x, b.y));
    const entries = tiles.map((t, i) => ({
      tileId: zxyToTileId(t.z, t.x, t.y),
      offset: i * t.bytes.length,
      length: t.bytes.length,
      runLength: 1,
    }));
    const totalLen = tiles.reduce((s, t) => s + t.bytes.length, 0);
    const tileData = new Uint8Array(totalLen);
    let p = 0;
    for (const t of tiles) { tileData.set(t.bytes, p); p += t.bytes.length; }
    const result = writePMTilesFile(path, entries, tileData, {
      minZoom: 0, maxZoom: 2, minLon: -180, minLat: -85, maxLon: 180, maxLat: 85,
      tileType: "mvt", tileCompression: "gzip", metadata: { name: "test" },
    });
    expect(result.tileCount).toBe(5);
    const header = readPMTilesHeader(result.bytes);
    expect(header.tileType).toBe("mvt");
  });

  it("throws on empty entries array in buildPMTiles", () => {
    const tileData = new Uint8Array(0);
    const result = buildPMTiles([], tileData, {
      minZoom: 0, maxZoom: 0, minLon: -180, minLat: -85, maxLon: 180, maxLat: 85,
      tileType: "mvt", tileCompression: "gzip", metadata: {},
    });
    expect(result.tileCount).toBe(0);
  });
});
