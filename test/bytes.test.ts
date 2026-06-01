import { describe, it, expect } from "vitest";
import { tmsToXYZ, formatBytes, isGzipped } from "../src/util/bytes";

describe("tmsToXYZ", () => {
  it("converts TMS Y to XYZ Y", () => {
    expect(tmsToXYZ(10, 0)).toBe(1023);
    expect(tmsToXYZ(10, 1023)).toBe(0);
    expect(tmsToXYZ(0, 0)).toBe(0);
  });

  it("round-trips correctly", () => {
    for (const z of [0, 1, 5, 10]) {
      for (const y of [0, 3, Math.floor((1 << z) / 2)]) {
        const xyz = tmsToXYZ(z, y);
        const tms = tmsToXYZ(z, xyz);
        expect(tms).toBe(y);
      }
    }
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1500)).toBe("1.5 KB");
    expect(formatBytes(1500000)).toBe("1.4 MB");
  });
});

describe("isGzipped", () => {
  it("detects gzip magic bytes", () => {
    expect(isGzipped(new Uint8Array([0x1f, 0x8b, 0x00]))).toBe(true);
    expect(isGzipped(new Uint8Array([0x00, 0x00]))).toBe(false);
  });
});
