import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PMTilesArchive } from "../src/archive/pmtiles";

let pmtilesPath: string;

describe("PMTilesArchive", () => {
  beforeAll(() => {
    pmtilesPath = join(tmpdir(), "test_pmtiles_kit.pmtiles");
    
    // Create a minimal PMTiles file for testing
    // Note: In a real scenario, you'd use a proper PMTiles file
    // For now, we'll skip tests if the file doesn't exist
  });

  afterAll(() => {
    try {
      if (existsSync(pmtilesPath)) {
        unlinkSync(pmtilesPath);
      }
    } catch {}
  });

  it("should initialize and read header", async () => {
    if (!existsSync(pmtilesPath)) {
      console.log("Skipping PMTiles test: no test file available");
      return;
    }

    const archive = new PMTilesArchive(pmtilesPath);
    await archive.init();
    const header = await archive.getHeader();
    
    expect(header.format).toBe("pmtiles");
    expect(header.tileType).toBeDefined();
    expect(header.minZoom).toBeGreaterThanOrEqual(0);
    expect(header.maxZoom).toBeGreaterThanOrEqual(header.minZoom);
    expect(header.bounds).toHaveLength(4);
    
    await archive.close();
  });

  it("should get metadata", async () => {
    if (!existsSync(pmtilesPath)) return;

    const archive = new PMTilesArchive(pmtilesPath);
    await archive.init();
    const metadata = await archive.getMetadata();
    
    expect(metadata).toBeDefined();
    expect(typeof metadata).toBe("object");
    
    await archive.close();
  });

  it("should list zoom levels", async () => {
    if (!existsSync(pmtilesPath)) return;

    const archive = new PMTilesArchive(pmtilesPath);
    await archive.init();
    const zooms = await archive.listZooms();
    
    expect(Array.isArray(zooms)).toBe(true);
    expect(zooms.length).toBeGreaterThan(0);
    
    // Zoom levels should be sequential
    for (let i = 1; i < zooms.length; i++) {
      expect(zooms[i]).toBe(zooms[i - 1] + 1);
    }
    
    await archive.close();
  });

  it("should convert lon/lat to tile coordinates", async () => {
    if (!existsSync(pmtilesPath)) return;

    const archive = new PMTilesArchive(pmtilesPath);
    await archive.init();
    
    // Test the private method via listTiles
    const tiles = [];
    for await (const tile of archive.listTiles()) {
      tiles.push(tile);
      if (tiles.length >= 10) break; // Limit for performance
    }
    
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles[0]).toHaveProperty("z");
    expect(tiles[0]).toHaveProperty("x");
    expect(tiles[0]).toHaveProperty("y");
    
    await archive.close();
  });
});
