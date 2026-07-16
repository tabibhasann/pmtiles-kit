import { describe, expect, it } from "vitest";
import { isAllowedLoopbackHost } from "../src/security";

describe("loopback Host validation", () => {
  it("accepts local addresses", () => {
    for (const value of ["localhost:3000", "viewer.localhost", "127.0.0.1:3000", "[::1]:3000"]) {
      expect(isAllowedLoopbackHost(value)).toBe(true);
    }
  });

  it("rejects DNS-rebinding and malformed hosts", () => {
    for (const value of ["attacker.example", "192.168.1.3:3000", "", undefined]) {
      expect(isAllowedLoopbackHost(value)).toBe(false);
    }
  });
});
