/**
 * pmtiles-kit — extended utility and report tests
 */
import { describe, it, expect } from "vitest";
import { tmsToXYZ, formatBytes, isGzipped } from "../src/util/bytes";
import { prettyReport } from "../src/report";
import type { ValidationReport } from "../src/archive/types";

describe("formatBytes extended", () => {
  it("formats zero bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats exactly 1024 bytes as KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats exactly 1 MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("formats exactly 1 GB", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
  });

  it("formats large GB values", () => {
    expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe("5.0 GB");
  });

  it("formats 999 bytes as B", () => {
    expect(formatBytes(999)).toBe("999 B");
  });
});

describe("isGzipped extended", () => {
  it("returns false for empty array", () => {
    expect(isGzipped(new Uint8Array([]))).toBe(false);
  });

  it("returns false for single byte", () => {
    expect(isGzipped(new Uint8Array([0x1f]))).toBe(false);
  });

  it("returns true for exactly 2 magic bytes", () => {
    expect(isGzipped(new Uint8Array([0x1f, 0x8b]))).toBe(true);
  });

  it("returns false for wrong magic bytes", () => {
    expect(isGzipped(new Uint8Array([0x00, 0x00, 0x00]))).toBe(false);
  });

  it("returns true for gzip data with content after magic", () => {
    expect(isGzipped(new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x00]))).toBe(true);
  });
});

describe("tmsToXYZ extended", () => {
  it("handles zoom 1", () => {
    expect(tmsToXYZ(1, 0)).toBe(1);
    expect(tmsToXYZ(1, 1)).toBe(0);
  });

  it("handles zoom 2", () => {
    expect(tmsToXYZ(2, 0)).toBe(3);
    expect(tmsToXYZ(2, 1)).toBe(2);
    expect(tmsToXYZ(2, 2)).toBe(1);
    expect(tmsToXYZ(2, 3)).toBe(0);
  });

  it("round-trips at zoom 15", () => {
    const z = 15;
    for (const y of [0, 100, 1000, 16383, 32767]) {
      const xyz = tmsToXYZ(z, y);
      expect(tmsToXYZ(z, xyz)).toBe(y);
    }
  });

  it("max y at zoom z is 2^z - 1", () => {
    for (const z of [0, 1, 5, 10, 14]) {
      const maxY = (1 << z) - 1;
      expect(tmsToXYZ(z, maxY)).toBe(0);
      expect(tmsToXYZ(z, 0)).toBe(maxY);
    }
  });
});

describe("prettyReport extended", () => {
  it("renders valid report with no warnings or errors", () => {
    const r: ValidationReport = { valid: true, errors: [], warnings: [] };
    const out = prettyReport(r);
    expect(out).toBe("✓ Valid");
  });

  it("renders invalid report with only errors", () => {
    const r: ValidationReport = { valid: false, errors: ["err1", "err2"], warnings: [] };
    const out = prettyReport(r);
    expect(out).toContain("✗ Invalid");
    expect(out).toContain("[ERROR] err1");
    expect(out).toContain("[ERROR] err2");
    expect(out).not.toContain("[WARN]");
  });

  it("renders valid report with warnings only", () => {
    const r: ValidationReport = { valid: true, errors: [], warnings: ["w1"] };
    const out = prettyReport(r);
    expect(out).toContain("✓ Valid");
    expect(out).toContain("[WARN]  w1");
  });

  it("renders errors before warnings", () => {
    const r: ValidationReport = { valid: false, errors: ["err"], warnings: ["warn"] };
    const out = prettyReport(r);
    const errIdx = out.indexOf("[ERROR]");
    const warnIdx = out.indexOf("[WARN]");
    expect(errIdx).toBeLessThan(warnIdx);
  });

  it("renders multiple errors and warnings", () => {
    const r: ValidationReport = {
      valid: false,
      errors: ["e1", "e2", "e3"],
      warnings: ["w1", "w2"],
    };
    const out = prettyReport(r);
    expect(out.match(/\[ERROR\]/g)?.length).toBe(3);
    expect(out.match(/\[WARN\]/g)?.length).toBe(2);
  });
});
