import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { convertCommand } from "../src/commands/convert";

let srcPath: string;
let dstPath: string;

describe("Convert Command", () => {
  beforeAll(() => {
    srcPath = join(tmpdir(), "test_convert_src.mbtiles");
    dstPath = join(tmpdir(), "test_convert_dst.mbtiles");

    // Create source MBTiles file
    const db = new Database(srcPath);
    db.exec(`
      CREATE TABLE metadata (name TEXT, value TEXT);
      CREATE TABLE tiles (
        zoom_level INTEGER,
        tile_column INTEGER,
        tile_row INTEGER,
        tile_data BLOB
      );
      CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row);
    `);
    
    db.prepare("INSERT INTO metadata VALUES (?, ?)").run("name", "Test Map");
    db.prepare("INSERT INTO metadata VALUES (?, ?)").run("format", "pbf");
    db.prepare("INSERT INTO metadata VALUES (?, ?)").run("bounds", "-180,-85,180,85");
    
    // Insert test tiles
    const insertTile = db.prepare(
      "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)"
    );
    
    for (let z = 0; z < 3; z++) {
      for (let x = 0; x < Math.pow(2, z); x++) {
        for (let y = 0; y < Math.pow(2, z); y++) {
          insertTile.run(z, x, y, Buffer.from([z, x, y, 1, 2, 3]));
        }
      }
    }
    
    db.close();
  });

  afterAll(() => {
    try {
      if (existsSync(srcPath)) unlinkSync(srcPath);
      if (existsSync(dstPath)) unlinkSync(dstPath);
    } catch {}
  });

  it("should convert MBTiles to MBTiles", async () => {
    if (existsSync(dstPath)) unlinkSync(dstPath);

    const result = await convertCommand(srcPath, dstPath);
    
    expect(result).toContain("Converted");
    expect(result).toContain("mbtiles");
    expect(existsSync(dstPath)).toBe(true);
    
    // Verify the converted file
    const db = new Database(dstPath);
    const tileCount = db.prepare("SELECT COUNT(*) as count FROM tiles").get() as any;
    expect(tileCount.count).toBeGreaterThan(0);
    
    // Verify metadata was copied
    const metadata = db.prepare("SELECT * FROM metadata").all() as any[];
    expect(metadata.length).toBeGreaterThan(0);
    
    db.close();
  });

  it("should fail if output file exists", async () => {
    // Create output file
    const db = new Database(dstPath);
    db.exec("CREATE TABLE test (id INTEGER)");
    db.close();

    await expect(convertCommand(srcPath, dstPath)).rejects.toThrow("already exists");
    
    unlinkSync(dstPath);
  });

  it("converts MBTiles to a real PMTiles file (no external CLI required)", async () => {
    if (existsSync(dstPath)) unlinkSync(dstPath);
    const pmtilesDst = dstPath.replace(".mbtiles", ".pmtiles");
    if (existsSync(pmtilesDst)) unlinkSync(pmtilesDst);

    const result = await convertCommand(srcPath, pmtilesDst);

    // No external CLI warning; conversion is a real PMTiles file
    expect(result).toContain("pmtiles");
    expect(result).not.toContain("go-pmtiles");
    expect(existsSync(pmtilesDst)).toBe(true);

    if (existsSync(pmtilesDst)) unlinkSync(pmtilesDst);
  });
});
