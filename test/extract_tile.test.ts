/**
 * Tests for the `extract` and `tile` commands — both had 0% coverage.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import {
  buildPMTilesFixture,
  buildMBTilesFixture,
} from "./fixtures";
import { extractCommand } from "../src/commands/extract";
import { tileCommand } from "../src/commands/tile";

describe("tileCommand", () => {
  let pmtilesPath: string;

  beforeEach(() => {
    pmtilesPath = buildPMTilesFixture();
  });

  afterEach(() => {
    const dir = dirname(pmtilesPath);
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("extracts an existing tile from a PMTiles archive", async () => {
    const tile = await tileCommand(pmtilesPath, 0, 0, 0);
    expect(tile).toBeInstanceOf(Uint8Array);
    expect(tile.length).toBeGreaterThan(0);
    // PMTiles reader transparently decompresses gzip, so we get raw bytes
    const expected = new TextEncoder().encode("MVT-0-0-0");
    expect(tile.length).toBe(expected.length);
    expect(Array.from(tile)).toEqual(Array.from(expected));
  });

  it("extracts a tile at zoom 1", async () => {
    const tile = await tileCommand(pmtilesPath, 1, 0, 0);
    expect(tile).toBeInstanceOf(Uint8Array);
    expect(tile.length).toBeGreaterThan(0);
  });

  it("extracts a tile at zoom 2", async () => {
    const tile = await tileCommand(pmtilesPath, 2, 2, 1);
    expect(tile).toBeInstanceOf(Uint8Array);
    expect(tile.length).toBeGreaterThan(0);
  });

  it("throws when the tile doesn't exist", async () => {
    await expect(tileCommand(pmtilesPath, 5, 0, 0)).rejects.toThrow(
      "No tile found at z=5"
    );
  });

  it("throws on a non-existent file", async () => {
    await expect(
      tileCommand(join(tmpdir(), "nonexistent.pmtiles"), 0, 0, 0)
    ).rejects.toThrow();
  });

  it("works with MBTiles archives too", async () => {
    const mbtilesPath = buildMBTilesFixture();
    try {
      const tile = await tileCommand(mbtilesPath, 0, 0, 0);
      expect(tile).toBeInstanceOf(Uint8Array);
      expect(tile.length).toBeGreaterThan(0);
    } finally {
      rmSync(dirname(mbtilesPath), { recursive: true, force: true });
    }
  });
});

describe("extractCommand", () => {
  let pmtilesPath: string;
  let outDir: string;

  beforeEach(() => {
    pmtilesPath = buildPMTilesFixture();
    outDir = join(
      tmpdir(),
      `pmtiles-kit-extract-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(outDir, { recursive: true });
  });

  afterEach(() => {
    for (const d of [dirname(pmtilesPath), outDir]) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it("extracts all tiles when no filter is applied", async () => {
    const outPath = join(outDir, "out.pmtiles");
    const result = await extractCommand(pmtilesPath, outPath, {});
    expect(existsSync(outPath)).toBe(true);
    expect(result).toContain("Extracted");
    expect(result).toContain("entries");
  });

  it("filters by zoom range", async () => {
    const outPath = join(outDir, "zoom1.pmtiles");
    const result = await extractCommand(pmtilesPath, outPath, {
      minZoom: 1,
      maxZoom: 1,
    });
    expect(existsSync(outPath)).toBe(true);
    expect(result).toContain("Extracted");
    // Should have fewer tiles than the full archive (only zoom 1)
    expect(result).not.toContain("0 entries");
  });

  it("filters by bounding box", async () => {
    const outPath = join(outDir, "bbox.pmtiles");
    // Small bbox around [0, 0] — should include some tiles
    const result = await extractCommand(pmtilesPath, outPath, {
      bbox: [-1, -1, 1, 1],
    });
    expect(existsSync(outPath)).toBe(true);
    expect(result).toContain("Extracted");
  });

  it("produces a valid PMTiles file", async () => {
    const outPath = join(outDir, "valid.pmtiles");
    await extractCommand(pmtilesPath, outPath, {});
    // Read the first 7 bytes to check the magic
    const { readFileSync } = await import("fs");
    const bytes = readFileSync(outPath);
    const magic = String.fromCharCode(
      bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6]
    );
    expect(magic).toBe("PMTiles");
  });

  it("throws on a non-existent source file", async () => {
    const outPath = join(outDir, "err.pmtiles");
    await expect(
      extractCommand(join(tmpdir(), "nonexistent.pmtiles"), outPath, {})
    ).rejects.toThrow();
  });

  it("works with MBTiles source", async () => {
    const mbtilesPath = buildMBTilesFixture();
    const outPath = join(outDir, "from_mb.pmtiles");
    try {
      const result = await extractCommand(mbtilesPath, outPath, {});
      expect(existsSync(outPath)).toBe(true);
      expect(result).toContain("Extracted");
    } finally {
      rmSync(dirname(mbtilesPath), { recursive: true, force: true });
    }
  });
});
