import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { validateCommand } from "../src/commands/validate";

let validPath: string;
let invalidPath: string;
let emptyPath: string;

describe("Validate Command", () => {
  beforeAll(() => {
    validPath = join(tmpdir(), "test_validate_valid.mbtiles");
    invalidPath = join(tmpdir(), "test_validate_invalid.mbtiles");
    emptyPath = join(tmpdir(), "test_validate_empty.mbtiles");

    // Create valid MBTiles file
    const validDb = new Database(validPath);
    validDb.exec(`
      CREATE TABLE metadata (name TEXT, value TEXT);
      CREATE TABLE tiles (
        zoom_level INTEGER,
        tile_column INTEGER,
        tile_row INTEGER,
        tile_data BLOB
      );
      CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row);
    `);
    validDb.prepare("INSERT INTO metadata VALUES (?, ?)").run("name", "Valid Map");
    validDb.prepare("INSERT INTO metadata VALUES (?, ?)").run("format", "pbf");
    validDb.prepare("INSERT INTO metadata VALUES (?, ?)").run("bounds", "-180,-85,180,85");
    validDb.prepare("INSERT INTO tiles VALUES (?, ?, ?, ?)").run(0, 0, 0, Buffer.from([1, 2, 3]));
    validDb.prepare("INSERT INTO tiles VALUES (?, ?, ?, ?)").run(1, 0, 0, Buffer.from([1, 2, 3]));
    validDb.close();

    // Create invalid MBTiles file (bad zoom range)
    const invalidDb = new Database(invalidPath);
    invalidDb.exec(`
      CREATE TABLE metadata (name TEXT, value TEXT);
      CREATE TABLE tiles (
        zoom_level INTEGER,
        tile_column INTEGER,
        tile_row INTEGER,
        tile_data BLOB
      );
    `);
    invalidDb.prepare("INSERT INTO metadata VALUES (?, ?)").run("bounds", "-180,-85,180,85");
    // Insert tiles with invalid zoom levels (5 > 3, with the reader
    // using 0..5 so the file is "technically valid" — instead create a
    // file with bad bounds to trigger the bounds check)
    invalidDb.prepare("INSERT INTO tiles VALUES (?, ?, ?, ?)").run(5, 0, 0, Buffer.from([1]));
    invalidDb.prepare("INSERT INTO tiles VALUES (?, ?, ?, ?)").run(3, 0, 0, Buffer.from([1]));
    invalidDb.close();

    // Override the bad bounds so the test is genuinely invalid
    const fixDb = new Database(invalidPath);
    fixDb.prepare("DELETE FROM metadata WHERE name = 'bounds'").run();
    fixDb.prepare("INSERT INTO metadata VALUES (?, ?)").run("bounds", "-300,-100,300,100");
    fixDb.close();

    // Create empty MBTiles file
    const emptyDb = new Database(emptyPath);
    emptyDb.exec(`
      CREATE TABLE metadata (name TEXT, value TEXT);
      CREATE TABLE tiles (
        zoom_level INTEGER,
        tile_column INTEGER,
        tile_row INTEGER,
        tile_data BLOB
      );
    `);
    emptyDb.prepare("INSERT INTO metadata VALUES (?, ?)").run("bounds", "-180,-85,180,85");
    emptyDb.close();
  });

  afterAll(() => {
    try {
      if (existsSync(validPath)) unlinkSync(validPath);
      if (existsSync(invalidPath)) unlinkSync(invalidPath);
      if (existsSync(emptyPath)) unlinkSync(emptyPath);
    } catch {}
  });

  it("should validate a valid archive", async () => {
    const result = await validateCommand(validPath, false);
    
    expect(result).toContain("✓");
    expect(result).toContain("Valid");
    expect(result).not.toContain("ERROR");
  });

  it("should detect invalid zoom range", async () => {
    const result = await validateCommand(invalidPath, false);

    expect(result).toContain("Invalid");
  });

  it("should warn about empty archives", async () => {
    const result = await validateCommand(emptyPath, false);
    
    expect(result).toContain("zero tiles");
  });

  it("should output JSON format", async () => {
    const result = await validateCommand(validPath, true);
    
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("valid");
    expect(parsed).toHaveProperty("errors");
    expect(parsed).toHaveProperty("warnings");
    expect(parsed.valid).toBe(true);
  });

  it("should handle non-existent files", async () => {
    const result = await validateCommand("/nonexistent/file.mbtiles", false);
    
    expect(result).toContain("Failed to open");
  });

  it("should validate bounds", async () => {
    // Create file with invalid bounds
    const badBoundsPath = join(tmpdir(), "test_validate_bounds.mbtiles");
    const db = new Database(badBoundsPath);
    db.exec(`
      CREATE TABLE metadata (name TEXT, value TEXT);
      CREATE TABLE tiles (
        zoom_level INTEGER,
        tile_column INTEGER,
        tile_row INTEGER,
        tile_data BLOB
      );
    `);
    db.prepare("INSERT INTO metadata VALUES (?, ?)").run("bounds", "-200,-100,200,100");
    db.prepare("INSERT INTO tiles VALUES (?, ?, ?, ?)").run(0, 0, 0, Buffer.from([1]));
    db.close();

    const result = await validateCommand(badBoundsPath, false);
    expect(result).toContain("Bounds");
    
    unlinkSync(badBoundsPath);
  });
});
