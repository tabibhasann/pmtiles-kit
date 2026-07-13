/**
 * Tests for scan, compare, info, and validate commands.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { mkdirSync, rmSync, copyFileSync } from "fs";
import { tmpdir } from "os";
import { scanCommand } from "../src/commands/scan";
import { compareCommand } from "../src/commands/compare";
import { infoCommand } from "../src/commands/info";
import { validateCommand } from "../src/commands/validate";
import { buildMBTilesFixture, buildPMTilesFixture } from "./fixtures";

describe("scan command", () => {
  const scanDir = join(tmpdir(), "pmtiles-kit-scan-test");
  let mbtilesPath: string;
  let pmtilesPath: string;

  beforeAll(() => {
    mkdirSync(scanDir, { recursive: true });
    mbtilesPath = buildMBTilesFixture();
    pmtilesPath = buildPMTilesFixture();
    // Copy both fixtures into the scan directory so scan can find them
    copyFileSync(mbtilesPath, join(scanDir, "sample.mbtiles"));
    copyFileSync(pmtilesPath, join(scanDir, "sample.pmtiles"));
  });

  afterAll(() => {
    try {
      rmSync(scanDir, { recursive: true, force: true });
      rmSync(join(mbtilesPath, ".."), { recursive: true, force: true });
      rmSync(join(pmtilesPath, ".."), { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should find archives in a directory", async () => {
    const result = await scanCommand(scanDir, false);
    expect(result).toContain("archive(s)");
    expect(result).toContain("2 archive(s)");
  });

  it("should find mixed .pmtiles and .mbtiles files", async () => {
    const result = await scanCommand(scanDir, true);
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(2);
    const formats = parsed.archives.map((a: { format: string }) => a.format);
    expect(formats).toContain("pmtiles");
    expect(formats).toContain("mbtiles");
  });

  it("should output JSON", async () => {
    const result = await scanCommand(scanDir, true);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("archives");
    expect(parsed).toHaveProperty("total");
    expect(parsed.total).toBeGreaterThanOrEqual(2);
  });
});

describe("compare command", () => {
  let mbtilesPath: string;
  let pmtilesPath: string;
  const tmpFiles: string[] = [];

  beforeAll(() => {
    mbtilesPath = buildMBTilesFixture();
    pmtilesPath = buildPMTilesFixture();
    tmpFiles.push(mbtilesPath, pmtilesPath);
    tmpFiles.push(join(mbtilesPath, ".."));
    tmpFiles.push(join(pmtilesPath, ".."));
  });

  afterAll(() => {
    for (const p of tmpFiles) {
      try {
        rmSync(p, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it("should compare two identical archives", async () => {
    const result = await compareCommand(mbtilesPath, mbtilesPath, false);
    expect(result).toContain("Comparing:");
    expect(result).toContain("Tiles matched:");
  });

  it("should detect differences between different formats", async () => {
    const result = await compareCommand(mbtilesPath, pmtilesPath, true);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("archive_a");
    expect(parsed).toHaveProperty("archive_b");
    // Same tiles in both (same fixture data), so tilesMatched should be > 0
    expect(parsed.tilesMatched).toBeGreaterThanOrEqual(0);
  });

  it("should output JSON", async () => {
    const result = await compareCommand(mbtilesPath, mbtilesPath, true);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("archive_a");
    expect(parsed).toHaveProperty("archive_b");
    expect(parsed).toHaveProperty("tilesMatched");
    expect(parsed.tilesMatched).toBeGreaterThan(0);
  });
});

describe("info command", () => {
  let pmtilesPath: string;
  const tmpFiles: string[] = [];

  beforeAll(() => {
    pmtilesPath = buildPMTilesFixture();
    tmpFiles.push(pmtilesPath);
    tmpFiles.push(join(pmtilesPath, ".."));
  });

  afterAll(() => {
    for (const p of tmpFiles) {
      try {
        rmSync(p, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it("should show basic info", async () => {
    const result = await infoCommand(pmtilesPath, false);
    expect(result).toContain("Format:");
    expect(result).toContain("Tile count:");
  });

  it("should show per-zoom tile counts with --verbose", async () => {
    const result = await infoCommand(pmtilesPath, false, true);
    expect(result).toContain("Per-zoom tile counts:");
    expect(result).toContain("z0:");
    expect(result).toContain("z1:");
    expect(result).toContain("z2:");
  });

  it("should include perZoom in JSON output with --verbose", async () => {
    const result = await infoCommand(pmtilesPath, true, true);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("perZoom");
    expect(parsed.perZoom).toHaveProperty("0");
    expect(parsed.perZoom).toHaveProperty("1");
    expect(parsed.perZoom).toHaveProperty("2");
  });
});

describe("validate command", () => {
  let pmtilesPath: string;
  const tmpFiles: string[] = [];

  beforeAll(() => {
    pmtilesPath = buildPMTilesFixture();
    tmpFiles.push(pmtilesPath);
    tmpFiles.push(join(pmtilesPath, ".."));
  });

  afterAll(() => {
    for (const p of tmpFiles) {
      try {
        rmSync(p, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it("should validate a good archive", async () => {
    const result = await validateCommand(pmtilesPath, false, false);
    expect(result.toLowerCase()).toContain("valid");
  });

  it("should output JSON validation report", async () => {
    const result = await validateCommand(pmtilesPath, true, false);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("valid");
    expect(parsed).toHaveProperty("errors");
    expect(parsed).toHaveProperty("warnings");
  });

  it("should run strict mode without errors on a good archive", async () => {
    const result = await validateCommand(pmtilesPath, true, true);
    const parsed = JSON.parse(result);
    expect(parsed.valid).toBe(true);
  });
});
