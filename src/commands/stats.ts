/**
 * `stats` command — compute per-zoom-level statistics for a tile archive.
 *
 * Reports tile count, total bytes, min/max/avg tile size per zoom level,
 * and overall archive statistics. Useful for understanding tile
 * distribution and identifying sparse or oversized zoom levels.
 */

import { openArchive } from "../archive/open";

interface ZoomStats {
  zoom: number;
  tileCount: number;
  totalBytes: number;
  minBytes: number;
  maxBytes: number;
  avgBytes: number;
}

/** Compute per-zoom-level statistics for a tile archive.
 *
 * @param file - Path to the archive
 * @param json - If true, output as JSON; otherwise human-readable text
 * @returns A formatted stats report string
 * @throws {Error} If the archive cannot be opened
 */
export async function statsCommand(
  file: string,
  json: boolean = false
): Promise<string> {
  const archive = await openArchive(file);
  try {
    const header = await archive.getHeader();

    const zoomMap = new Map<number, ZoomStats>();

    for await (const { z, x, y } of archive.listTiles()) {
      const tile = await archive.getTile(z, x, y);
      const size = tile ? tile.length : 0;

      let zs = zoomMap.get(z);
      if (!zs) {
        zs = {
          zoom: z,
          tileCount: 0,
          totalBytes: 0,
          minBytes: Infinity,
          maxBytes: 0,
          avgBytes: 0,
        };
        zoomMap.set(z, zs);
      }
      zs.tileCount++;
      zs.totalBytes += size;
      if (size < zs.minBytes) zs.minBytes = size;
      if (size > zs.maxBytes) zs.maxBytes = size;
    }

    const zoomStats = Array.from(zoomMap.values()).sort((a, b) => a.zoom - b.zoom);
    for (const zs of zoomStats) {
      zs.avgBytes = zs.tileCount > 0 ? Math.round(zs.totalBytes / zs.tileCount) : 0;
      if (zs.minBytes === Infinity) zs.minBytes = 0;
    }

    const totalTiles = zoomStats.reduce((s, z) => s + z.tileCount, 0);
    const totalBytes = zoomStats.reduce((s, z) => s + z.totalBytes, 0);

    if (json) {
      return JSON.stringify(
        {
          format: header.format,
          tileType: header.tileType,
          zoomLevels: zoomStats.length,
          totalTiles,
          totalBytes,
          totalSizeMB: +(totalBytes / 1024 / 1024).toFixed(2),
          perZoom: zoomStats,
        },
        null,
        2
      );
    }

    const lines: string[] = [
      `Archive:    ${file}`,
      `Format:     ${header.format.toUpperCase()}`,
      `Tile type:  ${header.tileType}`,
      `Zoom range: ${header.minZoom} – ${header.maxZoom}`,
      `Total tiles: ${totalTiles}`,
      `Total size:  ${(totalBytes / 1024 / 1024).toFixed(2)} MB (${totalBytes} bytes)`,
      "",
      "Per-zoom statistics:",
      `  ${"zoom".padEnd(6)} ${"tiles".padEnd(10)} ${"total".padEnd(12)} ${"min".padEnd(8)} ${"max".padEnd(8)} ${"avg".padEnd(8)}`,
    ];

    for (const zs of zoomStats) {
      lines.push(
        `  z${String(zs.zoom).padEnd(5)} ${String(zs.tileCount).padEnd(10)} ${formatBytes(zs.totalBytes).padEnd(12)} ${formatBytes(zs.minBytes).padEnd(8)} ${formatBytes(zs.maxBytes).padEnd(8)} ${formatBytes(zs.avgBytes).padEnd(8)}`
      );
    }

    return lines.join("\n");
  } finally {
    await archive.close();
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
