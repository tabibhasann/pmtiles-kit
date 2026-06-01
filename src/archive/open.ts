import { Archive } from "./types";
import { PMTilesArchive } from "./pmtiles";
import { MBTilesArchive } from "./mbtiles";
import { readFileSync } from "fs";

export async function openArchive(path: string): Promise<Archive> {
  const ext = path.split(".").pop()?.toLowerCase();

  // Detect format by extension first, then by magic bytes
  if (ext === "mbtiles" || ext === "sqlite") {
    const archive = new MBTilesArchive(path);
    archive.init();
    return archive;
  }

  if (ext === "pmtiles") {
    const archive = new PMTilesArchive(path);
    await archive.init();
    return archive;
  }

  // Try magic bytes
  try {
    const buf = readFileSync(path);
    const magic = String.fromCharCode(buf[0], buf[1], buf[2]);
    if (magic === "PMT") {
      const archive = new PMTilesArchive(path);
      await archive.init();
      return archive;
    }
    if (magic === "SQL") {
      const archive = new MBTilesArchive(path);
      archive.init();
      return archive;
    }
  } catch {
    // fall through
  }

  throw new Error(
    `Unsupported file type: ${path}. Expected .pmtiles or .mbtiles.`
  );
}
