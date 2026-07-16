/**
 * `scan` command — traverse a directory and list all PMTiles/MBTiles files.
 *
 * Recursively searches for .pmtiles and .mbtiles files, reporting their
 * headers in a compact table.
 */

import { readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { openArchive } from "../archive/open";
import { TileArchiveHeader } from "../archive/types";

interface ScanEntry {
  path: string;
  format: string;
  tileType: string;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  sizeBytes: number;
}

function findArchives(dir: string, results: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findArchives(fullPath, results);
    } else {
      const ext = extname(entry).toLowerCase();
      if (ext === ".pmtiles" || ext === ".mbtiles") {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/** Scan a directory for tile archives and report their metadata.
 *
 * @param dir - Directory to scan recursively
 * @param json - If true, output as JSON; otherwise human-readable text
 * @param verbose - If true, include errors for skipped files
 * @returns A formatted scan report string
 * @throws {Error} If the directory doesn't exist
 */
export async function scanCommand(
  dir: string,
  json: boolean = false,
  verbose: boolean = false
): Promise<string> {
  if (!statSync(dir).isDirectory()) {
    throw new Error(`Not a directory: ${dir}`);
  }

  const files = findArchives(dir);
  const entries: ScanEntry[] = [];

  for (const file of files) {
    const stat = statSync(file);
    let header: TileArchiveHeader | null = null;

    try {
      const archive = await openArchive(file);
      header = await archive.getHeader();
      await archive.close();
    } catch (e) {
      if (verbose) {
        console.error(`  Skipping ${file}: ${e}`);
      }
      entries.push({
        path: file,
        format: extname(file).slice(1),
        tileType: "unknown",
        minZoom: 0,
        maxZoom: 0,
        tileCount: 0,
        sizeBytes: stat.size,
      });
      continue;
    }

    entries.push({
      path: file,
      format: header.format,
      tileType: header.tileType,
      minZoom: header.minZoom,
      maxZoom: header.maxZoom,
      tileCount: header.tileCount,
      sizeBytes: stat.size,
    });
  }

  if (json) {
    return JSON.stringify(
      { archives: entries, total: entries.length },
      null,
      2
    );
  }

  const lines: string[] = [
    `Found ${entries.length} archive(s) in ${dir}\n`,
  ];

  for (const e of entries) {
    const sizeMB = (e.sizeBytes / 1024 / 1024).toFixed(1);
    lines.push(
      `  ${e.path}`,
      `    Format: ${e.format}  Type: ${e.tileType}  Zoom: ${e.minZoom}-${e.maxZoom}  Tiles: ${e.tileCount}  Size: ${sizeMB} MB`
    );
    if (verbose) {
      lines.push("");
    }
  }

  return lines.join("\n");
}
