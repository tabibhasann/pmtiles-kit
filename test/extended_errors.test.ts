import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { validateCommand } from "../src/commands/validate";
import { infoCommand } from "../src/commands/info";
import { scanCommand } from "../src/commands/scan";
import { compareCommand } from "../src/commands/compare";
import { convertCommand } from "../src/commands/convert";
import { openArchive } from "../src/archive/open";
import { buildPMTilesFixture, buildMBTilesFixture, makeFixtureTiles } from "./fixtures";
import { zxyToTileId, buildPMTiles, writePMTilesFile, readPMTilesHeader } from "../src/archive/writer";
import { inferTileType, inferCompression, detectCompression, bytesKey } from "../src/commands/shared";
import { tmsToXYZ, formatBytes, isGzipped } from "../src/util/bytes";
import { prettyReport } from "../src/report";
import { gzipSync } from "zlib";

describe("Extended error path tests", () => {
  const tmpDir = join(tmpdir(), `pmtiles-kit-ext-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  let pmtilesPath: string;
  let mbtilesPath: string;

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
    pmtilesPath = buildPMTilesFixture();
    mbtilesPath = buildMBTilesFixture();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("validate command error paths", () => {
    it("validate on nonexistent file returns invalid report", async () => {
      const result = await validateCommand(join(tmpDir, "nope.pmtiles"), false);
      expect(result).toContain("Invalid");
    });

    it("validate on nonexistent file with json returns valid JSON", async () => {
      const result = await validateCommand(join(tmpDir, "nope.pmtiles"), true);
      const parsed = JSON.parse(result);
      expect(parsed.valid).toBe(false);
      expect(parsed.errors.length).toBeGreaterThan(0);
    });

    it("validate on valid PMTiles returns valid", async () => {
      const result = await validateCommand(pmtilesPath, false);
      expect(result).toContain("Valid");
    });

    it("validate with json on valid PMTiles returns valid JSON", async () => {
      const result = await validateCommand(pmtilesPath, true);
      const parsed = JSON.parse(result);
      expect(parsed.valid).toBe(true);
    });

    it("validate with strict mode on valid archive passes", async () => {
      const result = await validateCommand(pmtilesPath, false, true);
      expect(result).toContain("Valid");
    });

    it("validate on unsupported file type returns error", async () => {
      const badPath = join(tmpDir, "bad.xyz");
      writeFileSync(badPath, Buffer.from("hello"));
      const result = await validateCommand(badPath, true);
      const parsed = JSON.parse(result);
      expect(parsed.valid).toBe(false);
    });
  });

  describe("info command error paths", () => {
    it("info on valid PMTiles returns header info", async () => {
      const result = await infoCommand(pmtilesPath, false);
      expect(result).toContain("PMTILES");
      expect(result).toContain("Tile count:");
    });

    it("info with json returns valid JSON", async () => {
      const result = await infoCommand(pmtilesPath, true);
      const parsed = JSON.parse(result);
      expect(parsed.format).toBe("pmtiles");
      expect(parsed.tileCount).toBe(5);
    });

    it("info with verbose includes per-zoom counts", async () => {
      const result = await infoCommand(pmtilesPath, false, true);
      expect(result).toContain("Per-zoom");
    });

    it("info on MBTiles returns header info", async () => {
      const result = await infoCommand(mbtilesPath, false);
      expect(result).toContain("MBTILES");
    });

    it("info on nonexistent file throws", async () => {
      await expect(infoCommand(join(tmpDir, "nope.pmtiles"), false)).rejects.toThrow();
    });
  });

  describe("scan command error paths", () => {
    it("scan on non-directory throws", async () => {
      await expect(scanCommand(pmtilesPath)).rejects.toThrow(/Not a directory/i);
    });

    it("scan on empty directory returns zero archives", async () => {
      const emptyDir = join(tmpDir, "empty-scan");
      mkdirSync(emptyDir, { recursive: true });
      const result = await scanCommand(emptyDir, false);
      expect(result).toContain("0 archive(s)");
    });

    it("scan with json on directory with archives", async () => {
      const scanDir = join(tmpDir, "scan-test");
      mkdirSync(scanDir, { recursive: true });
      // Copy fixture into scan dir
      const { copyFileSync } = await import("fs");
      copyFileSync(pmtilesPath, join(scanDir, "test.pmtiles"));
      const result = await scanCommand(scanDir, true);
      const parsed = JSON.parse(result);
      expect(parsed.archives.length).toBe(1);
      expect(parsed.total).toBe(1);
    });
  });

  describe("compare command error paths", () => {
    it("compare identical archives shows zero diffs", async () => {
      const result = await compareCommand(pmtilesPath, pmtilesPath, false);
      expect(result).toContain("Tiles matched:  5");
      expect(result).toContain("Only in A:      0");
    });

    it("compare with json returns valid JSON", async () => {
      const result = await compareCommand(pmtilesPath, pmtilesPath, true);
      const parsed = JSON.parse(result);
      expect(parsed.tilesMatched).toBe(5);
    });

    it("compare nonexistent file A throws", async () => {
      await expect(compareCommand(join(tmpDir, "nope.pmtiles"), pmtilesPath)).rejects.toThrow();
    });
  });

  describe("convert command error paths", () => {
    it("convert to existing output file throws", async () => {
      const existingPath = join(tmpDir, "existing.pmtiles");
      writeFileSync(existingPath, Buffer.from("exists"));
      await expect(convertCommand(pmtilesPath, existingPath)).rejects.toThrow(/already exists/i);
    });

    it("convert PMTiles to MBTiles produces valid archive", async () => {
      const dst = join(tmpDir, "converted.mbtiles");
      const result = await convertCommand(pmtilesPath, dst);
      expect(result).toContain("Converted");
      expect(existsSync(dst)).toBe(true);
      // Verify the converted file is readable
      const archive = await openArchive(dst);
      const header = await archive.getHeader();
      expect(header.format).toBe("mbtiles");
      expect(header.tileCount).toBe(5);
      await archive.close();
    });

    it("convert MBTiles to PMTiles produces valid archive", async () => {
      const dst = join(tmpDir, "converted.pmtiles");
      const result = await convertCommand(mbtilesPath, dst);
      expect(result).toContain("Converted");
      expect(existsSync(dst)).toBe(true);
      const archive = await openArchive(dst);
      const header = await archive.getHeader();
      expect(header.format).toBe("pmtiles");
      expect(header.tileCount).toBe(5);
      await archive.close();
    });
  });

  describe("shared utility error paths", () => {
    it("inferTileType returns unknown for unknown type", () => {
      expect(inferTileType({
        format: "pmtiles",
        tileType: "unknown",
        compression: "none",
        minZoom: 0,
        maxZoom: 2,
        bounds: [-85, -180, 85, 180],
        center: null,
        tileCount: 5,
      })).toBe("unknown");
    });

    it("inferTileType returns mvt for vector", () => {
      expect(inferTileType({
        format: "mbtiles",
        tileType: "vector",
        compression: "gzip",
        minZoom: 0,
        maxZoom: 2,
        bounds: [-85, -180, 85, 180],
        center: null,
        tileCount: 5,
      })).toBe("mvt");
    });

    it("inferCompression returns gzip for mbtiles", () => {
      expect(inferCompression({
        format: "mbtiles",
        tileType: "mvt",
        compression: "unknown",
        minZoom: 0,
        maxZoom: 2,
        bounds: [-85, -180, 85, 180],
        center: null,
        tileCount: 5,
      })).toBe("gzip");
    });

    it("inferCompression returns none for identity", () => {
      expect(inferCompression({
        format: "pmtiles",
        tileType: "png",
        compression: "identity",
        minZoom: 0,
        maxZoom: 2,
        bounds: [-85, -180, 85, 180],
        center: null,
        tileCount: 5,
      })).toBe("none");
    });

    it("detectCompression on empty bytes returns none", () => {
      expect(detectCompression(new Uint8Array(0))).toBe("none");
    });

    it("detectCompression on gzip bytes returns gzip", () => {
      const gzipped = new Uint8Array(gzipSync(Buffer.from("test")));
      expect(detectCompression(gzipped)).toBe("gzip");
    });

    it("detectCompression on plain bytes returns none", () => {
      expect(detectCompression(new Uint8Array([0x00, 0x01, 0x02]))).toBe("none");
    });

    it("bytesKey is deterministic for same input", () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3]);
      expect(bytesKey(a)).toBe(bytesKey(b));
    });

    it("bytesKey differs for different input", () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 4]);
      expect(bytesKey(a)).not.toBe(bytesKey(b));
    });

    it("bytesKey differs for different lengths", () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3, 4]);
      expect(bytesKey(a)).not.toBe(bytesKey(b));
    });
  });

  describe("bytes utility error paths", () => {
    it("tmsToXYZ flips y correctly", () => {
      expect(tmsToXYZ(1, 0)).toBe(1);
      expect(tmsToXYZ(1, 1)).toBe(0);
      expect(tmsToXYZ(2, 0)).toBe(3);
    });

    it("formatBytes formats correctly", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
    });

    it("isGzipped detects gzip magic", () => {
      const gzipped = new Uint8Array(gzipSync(Buffer.from("test")));
      expect(isGzipped(gzipped)).toBe(true);
    });

    it("isGzipped returns false for non-gzip", () => {
      expect(isGzipped(new Uint8Array([0x00, 0x01]))).toBe(false);
    });

    it("isGzipped returns false for empty array", () => {
      expect(isGzipped(new Uint8Array(0))).toBe(false);
    });
  });

  describe("report utility error paths", () => {
    it("prettyReport on valid report", () => {
      const result = prettyReport({ valid: true, errors: [], warnings: [] });
      expect(result).toContain("Valid");
    });

    it("prettyReport on invalid report with errors", () => {
      const result = prettyReport({ valid: false, errors: ["err1"], warnings: ["warn1"] });
      expect(result).toContain("Invalid");
      expect(result).toContain("[ERROR] err1");
      expect(result).toContain("[WARN]  warn1");
    });
  });

  describe("zxyToTileId edge cases", () => {
    it("z=0, x=0, y=0 returns 0", () => {
      expect(zxyToTileId(0, 0, 0)).toBe(0);
    });

    it("z=1, x=0, y=0 returns valid id", () => {
      expect(zxyToTileId(1, 0, 0)).toBe(1);
    });

    it("z=1, x=1, y=1 returns valid id", () => {
      expect(zxyToTileId(1, 1, 1)).toBeGreaterThan(0);
    });

    it("z=26 is the maximum safe zoom", () => {
      expect(() => zxyToTileId(26, 0, 0)).not.toThrow();
    });
  });

  describe("buildPMTiles edge cases", () => {
    it("buildPMTiles with single tile produces valid output", () => {
      const tileBytes = new Uint8Array([1, 2, 3]);
      const entries = [{ tileId: 0, offset: 0, length: 3, runLength: 1 }];
      const result = buildPMTiles(entries, tileBytes, {
        minZoom: 0, maxZoom: 0, minLon: -180, minLat: -85, maxLon: 180, maxLat: 85,
        tileType: "mvt", tileCompression: "gzip", metadata: {},
      });
      expect(result.tileCount).toBe(1);
      expect(result.bytes.length).toBeGreaterThan(127);
    });

    it("buildPMTiles with run-length encoded entries", () => {
      const tileBytes = new Uint8Array([1, 2, 3]);
      const entries = [{ tileId: 0, offset: 0, length: 3, runLength: 3 }];
      const result = buildPMTiles(entries, tileBytes, {
        minZoom: 0, maxZoom: 0, minLon: -180, minLat: -85, maxLon: 180, maxLat: 85,
        tileType: "mvt", tileCompression: "gzip", metadata: {},
      });
      expect(result.tileCount).toBe(3);
    });

    it("writePMTilesFile creates a file on disk", () => {
      const path = join(tmpDir, "write-edge.pmtiles");
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
        tileType: "mvt", tileCompression: "gzip", metadata: { name: "edge-test" },
      });
      expect(result.tileCount).toBe(5);
      expect(existsSync(path)).toBe(true);
      // Verify we can read it back
      const header = readPMTilesHeader(result.bytes);
      expect(header.tileType).toBe("mvt");
    });
  });

  describe("openArchive edge cases", () => {
    it("opens valid PMTiles file", async () => {
      const archive = await openArchive(pmtilesPath);
      const header = await archive.getHeader();
      expect(header.format).toBe("pmtiles");
      expect(header.tileCount).toBe(5);
      await archive.close();
    });

    it("opens valid MBTiles file", async () => {
      const archive = await openArchive(mbtilesPath);
      const header = await archive.getHeader();
      expect(header.format).toBe("mbtiles");
      await archive.close();
    });

    it("getTile returns undefined for nonexistent tile", async () => {
      const archive = await openArchive(pmtilesPath);
      const tile = await archive.getTile(10, 100, 100);
      expect(tile).toBeUndefined();
      await archive.close();
    });

    it("listZooms returns sorted zoom levels", async () => {
      const archive = await openArchive(pmtilesPath);
      const zooms = await archive.listZooms();
      expect(zooms).toEqual([0, 1, 2]);
      await archive.close();
    });

    it("getMetadata returns metadata object", async () => {
      const archive = await openArchive(pmtilesPath);
      const meta = await archive.getMetadata();
      expect(meta).toBeDefined();
      expect(meta.name).toBe("Sample");
      await archive.close();
    });

    it("listTiles iterates all tiles", async () => {
      const archive = await openArchive(pmtilesPath);
      let count = 0;
      for await (const _ of archive.listTiles()) {
        count++;
      }
      expect(count).toBe(5);
      await archive.close();
    });
  });
});
