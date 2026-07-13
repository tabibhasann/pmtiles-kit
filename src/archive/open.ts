import { Archive } from "./types";
import { PMTilesArchive } from "./pmtiles";
import { MBTilesArchive } from "./mbtiles";
import { open } from "fs/promises";
import { HttpRangeSource } from "./http-source";

export async function openArchive(path: string): Promise<Archive> {
  // HTTP(S) support — only PMTiles over HTTP (MBTiles requires SQLite)
  if (path.startsWith("http://") || path.startsWith("https://")) {
    const ext = path.split(".").pop()?.toLowerCase();
    if (ext === "mbtiles" || ext === "sqlite") {
      throw new Error("MBTiles over HTTP is not supported (SQLite requires random-access file I/O). Use PMTiles instead.");
    }
    const source = new HttpRangeSource(path);
    const archive = new PMTilesArchive(path, source);
    await archive.init();
    return archive;
  }

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
    const fh = await open(path, "r");
    const buf = Buffer.alloc(3);
    await fh.read(buf, 0, 3, 0);
    await fh.close();
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
