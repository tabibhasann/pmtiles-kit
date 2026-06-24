import { describe, expect, it } from "vitest";
import {
  buildPMTiles,
  decodeDirectory,
  openArchive,
  readPMTilesHeader,
  writePMTilesFile,
  zxyToTileId,
} from "../src/index";

describe("public API", () => {
  it("exports the documented archive and PMTiles writer helpers", () => {
    expect(typeof openArchive).toBe("function");
    expect(typeof buildPMTiles).toBe("function");
    expect(typeof decodeDirectory).toBe("function");
    expect(typeof readPMTilesHeader).toBe("function");
    expect(typeof writePMTilesFile).toBe("function");
    expect(typeof zxyToTileId).toBe("function");
  });
});
