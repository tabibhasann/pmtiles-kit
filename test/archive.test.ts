import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { MBTilesArchive } from "../src/archive/mbtiles";

let dbPath: string;

describe("MBTilesArchive", () => {
  beforeAll(() => {
    dbPath = join(tmpdir(), "test_pmtiles_kit.mbtiles");

    const fileDb = new Database(dbPath);
    fileDb.exec(`
      CREATE TABLE metadata (name TEXT, value TEXT);
      CREATE TABLE tiles (
        zoom_level INTEGER,
        tile_column INTEGER,
        tile_row INTEGER,
        tile_data BLOB
      );
      CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row);
    `);
    fileDb.prepare("INSERT INTO metadata VALUES (?, ?)").run("name", "Test Map");
    fileDb.prepare("INSERT INTO metadata VALUES (?, ?)").run("format", "pbf");
    fileDb.prepare("INSERT INTO metadata VALUES (?, ?)").run(
      "bounds",
      "-85,-180,85,180"
    );
    fileDb
      .prepare(
        "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)"
      )
      .run(0, 0, 0, Buffer.from([1, 2, 3, 4]));
    fileDb.close();
  });

  afterAll(() => {
    try {
      unlinkSync(dbPath);
    } catch {}
  });

  it("should open and read header", async () => {
    if (!existsSync(dbPath)) return;

    const a = new MBTilesArchive(dbPath);
    a.init();
    const header = await a.getHeader();
    expect(header.format).toBe("mbtiles");
    expect(header.tileType).toBe("vector");
    expect(header.minZoom).toBe(0);
    expect(header.tileCount).toBeGreaterThan(0);
    await a.close();
  });

  it("should get tile (XYZ convention)", async () => {
    if (!existsSync(dbPath)) return;

    const a = new MBTilesArchive(dbPath);
    a.init();
    const tile = await a.getTile(0, 0, 0);
    expect(tile).toBeDefined();
    expect(tile![0]).toBe(1);
    await a.close();
  });

  it("should return undefined for missing tile", async () => {
    if (!existsSync(dbPath)) return;

    const a = new MBTilesArchive(dbPath);
    a.init();
    const tile = await a.getTile(1, 0, 0);
    expect(tile).toBeUndefined();
    await a.close();
  });
});
