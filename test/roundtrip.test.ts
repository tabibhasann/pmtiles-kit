/**
 * Y-flip round-trip test: the same XYZ tile should be returned from
 * an MBTiles fixture (TMS internally) and a PMTiles fixture (XYZ internally).
 */

import { describe, it, expect, afterAll } from "vitest";
import { openArchive } from "../src/archive/open";
import { buildMBTilesFixture, buildPMTilesFixture } from "./fixtures";
import { convertCommand } from "../src/commands/convert";
import { join } from "path";
import { rmSync } from "fs";

describe("Y-flip round-trip across formats", () => {
  let mbtilesPath: string;
  let pmtilesPath: string;
  const tmpFiles: string[] = [];

  afterAll(() => {
    for (const p of tmpFiles) {
      try {
        rmSync(p, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it("reads the same XYZ tile from MBTiles and PMTiles fixtures", async () => {
    mbtilesPath = buildMBTilesFixture();
    pmtilesPath = buildPMTilesFixture();
    tmpFiles.push(mbtilesPath, pmtilesPath);
    // Also keep the parent directories for cleanup
    tmpFiles.push(join(mbtilesPath, ".."));
    tmpFiles.push(join(pmtilesPath, ".."));

    const mbt = await openArchive(mbtilesPath);
    const pmt = await openArchive(pmtilesPath);

    // The same XYZ (z, x, y) should return tile bytes from both archives.
    // MBTiles stores vector tiles gzipped (per convention); PMTiles
    // transparently decompresses them via the official library, so we
    // gunzip the MBTiles bytes before comparing.
    const { gunzipSync } = await import("zlib");
    const cases: [number, number, number][] = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 1],
      [2, 2, 1],
      [2, 0, 2],
    ];
    for (const [z, x, y] of cases) {
      const a = await mbt.getTile(z, x, y);
      const b = await pmt.getTile(z, x, y);
      expect(a, `MBTiles missing tile ${z}/${x}/${y}`).toBeDefined();
      expect(b, `PMTiles missing tile ${z}/${x}/${y}`).toBeDefined();
      // Decompress MBTiles bytes, then compare to PMTiles (already decompressed)
      const aDec = gunzipSync(Buffer.from(a!));
      expect(Array.from(aDec), `MBTiles ${z}/${x}/${y}`).toEqual(Array.from(b!));
    }

    await mbt.close();
    await pmt.close();
  });

  it("round-trips MBTiles -> PMTiles -> MBTiles preserving tile bytes", async () => {
    const srcMB = buildMBTilesFixture();
    const outPM = srcMB.replace(".mbtiles", "-out.pmtiles");
    const outMB = srcMB.replace(".mbtiles", "-out.mbtiles");
    tmpFiles.push(srcMB, outPM, outMB);
    tmpFiles.push(join(srcMB, ".."));

    // MBTiles -> PMTiles
    const c1 = await convertCommand(srcMB, outPM);
    expect(c1).toContain("pmtiles");

    // PMTiles -> MBTiles
    const c2 = await convertCommand(outPM, outMB);
    expect(c2).toContain("mbtiles");

    // Read the same tiles from src and round-tripped mbtiles; bytes must match
    const src = await openArchive(srcMB);
    const dst = await openArchive(outMB);
    for await (const { z, x, y } of src.listTiles()) {
      const a = await src.getTile(z, x, y);
      const b = await dst.getTile(z, x, y);
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      // Both are raw gzipped bytes (MBTiles format)
      expect(Array.from(a!)).toEqual(Array.from(b!));
    }
    await src.close();
    await dst.close();
  });
});
