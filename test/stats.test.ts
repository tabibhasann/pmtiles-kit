/**
 * Tests for the stats command.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { statsCommand } from "../src/commands/stats";
import { buildMBTilesFixture, buildPMTilesFixture } from "./fixtures";

describe("stats command", () => {
  const testDir = join(tmpdir(), `pmtiles-kit-stats-test-${Date.now()}`);
  let mbtilesPath: string;
  let pmtilesPath: string;

  beforeAll(() => {
    mbtilesPath = buildMBTilesFixture();
    pmtilesPath = buildPMTilesFixture();
  });

  afterAll(() => {
    try {
      rmSync(join(mbtilesPath, ".."), { recursive: true, force: true });
      rmSync(join(pmtilesPath, ".."), { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should output text stats for MBTiles", async () => {
    const result = await statsCommand(mbtilesPath, false);
    expect(result).toContain("Format:");
    expect(result).toContain("Per-zoom statistics:");
    expect(result).toContain("z0");
    expect(result).toContain("z1");
    expect(result).toContain("z2");
  });

  it("should output text stats for PMTiles", async () => {
    const result = await statsCommand(pmtilesPath, false);
    expect(result).toContain("Format:");
    expect(result).toContain("Per-zoom statistics:");
  });

  it("should output JSON stats", async () => {
    const result = await statsCommand(mbtilesPath, true);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("format");
    expect(parsed).toHaveProperty("totalTiles");
    expect(parsed).toHaveProperty("totalBytes");
    expect(parsed).toHaveProperty("perZoom");
    expect(Array.isArray(parsed.perZoom)).toBe(true);
    expect(parsed.perZoom.length).toBeGreaterThan(0);
    expect(parsed.perZoom[0]).toHaveProperty("zoom");
    expect(parsed.perZoom[0]).toHaveProperty("tileCount");
    expect(parsed.perZoom[0]).toHaveProperty("avgBytes");
  });

  it("should report correct total tile count in JSON", async () => {
    const result = await statsCommand(mbtilesPath, true);
    const parsed = JSON.parse(result);
    const sumTiles = parsed.perZoom.reduce(
      (s: number, z: { tileCount: number }) => s + z.tileCount,
      0
    );
    expect(parsed.totalTiles).toBe(sumTiles);
  });
});
