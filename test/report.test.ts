import { describe, it, expect } from "vitest";
import { prettyReport } from "../src/report";

describe("prettyReport", () => {
  it("renders valid report", () => {
    const out = prettyReport({ valid: true, errors: [], warnings: [] });
    expect(out).toContain("✓ Valid");
  });

  it("renders invalid report with errors", () => {
    const out = prettyReport({
      valid: false,
      errors: ["Header corrupt"],
      warnings: ["Low tile count"],
    });
    expect(out).toContain("✗ Invalid");
    expect(out).toContain("Header corrupt");
    expect(out).toContain("Low tile count");
  });
});
