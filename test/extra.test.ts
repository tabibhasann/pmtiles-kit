// pmtiles-kit extra tests — zxyToTileId and utility edge cases
import { test, expect } from "vitest";
import { zxyToTileId } from "../src/archive/writer";

// --- zxyToTileId ---

test("zxyToTileId z=0 x=0 y=0 returns 0", () => {
  expect(zxyToTileId(0, 0, 0)).toBe(0);
});

test("zxyToTileId z=1 x=0 y=0 returns 1", () => {
  expect(zxyToTileId(1, 0, 0)).toBe(1);
});

test("zxyToTileId z=1 x=1 y=0 returns 4", () => {
  expect(zxyToTileId(1, 1, 0)).toBe(4);
});

test("zxyToTileId z=1 x=1 y=1 returns 3", () => {
  expect(zxyToTileId(1, 1, 1)).toBe(3);
});

test("zxyToTileId z=1 x=0 y=1 returns 2", () => {
  expect(zxyToTileId(1, 0, 1)).toBe(2);
});

test("zxyToTileId z=2 x=0 y=0 returns 5", () => {
  expect(zxyToTileId(2, 0, 0)).toBe(5);
});

test("zxyToTileId throws for z > 26", () => {
  expect(() => zxyToTileId(27, 0, 0)).toThrow();
});

test("zxyToTileId throws for x out of bounds", () => {
  expect(() => zxyToTileId(1, 2, 0)).toThrow();
});

test("zxyToTileId throws for y out of bounds", () => {
  expect(() => zxyToTileId(1, 0, 2)).toThrow();
});

test("zxyToTileId z=3 produces valid range", () => {
  const id = zxyToTileId(3, 0, 0);
  expect(id).toBe(21);
});

test("zxyToTileId z=4 x=0 y=0 returns 85", () => {
  expect(zxyToTileId(4, 0, 0)).toBe(85);
});

test("zxyToTileId z=5 x=0 y=0 returns 341", () => {
  expect(zxyToTileId(5, 0, 0)).toBe(341);
});

test("zxyToTileId handles max valid z=26", () => {
  expect(() => zxyToTileId(26, 0, 0)).not.toThrow();
});

test("zxyToTileId z=2 all tiles produce unique ids", () => {
  const ids = new Set<number>();
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
      ids.add(zxyToTileId(2, x, y));
    }
  }
  expect(ids.size).toBe(16);
});

test("zxyToTileId z=3 all tiles produce unique ids", () => {
  const ids = new Set<number>();
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      ids.add(zxyToTileId(3, x, y));
    }
  }
  expect(ids.size).toBe(64);
});
