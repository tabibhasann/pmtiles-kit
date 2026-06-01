import { describe, it, expect } from "vitest";
import { tmsToXYZ } from "../src/util/bytes";

describe("Y-flip correctness", () => {
  it("MBTiles TMS row maps to XYZ correctly at zoom 5", () => {
    // At zoom 5, there are 32 rows (0-31 TMS, 0-31 XYZ)
    // TMS row 0 (bottom) = XYZ row 31 (top)
    expect(tmsToXYZ(5, 0)).toBe(31);
    // TMS row 31 (top) = XYZ row 0 (bottom)
    expect(tmsToXYZ(5, 31)).toBe(0);
  });

  it("middle rows map correctly", () => {
    expect(tmsToXYZ(10, 512)).toBe(511);
  });

  it("zoom 0 only has one tile", () => {
    expect(tmsToXYZ(0, 0)).toBe(0);
  });
});
