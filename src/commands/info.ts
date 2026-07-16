import { openArchive } from "../archive/open";

/** Print archive metadata (header, bounds, tile count) as text or JSON.
 *
 * @param file - Path to the archive
 * @param json - If true, output as JSON; otherwise human-readable text
 * @param verbose - If true, include per-zoom tile counts
 * @returns A formatted info string
 * @throws {Error} If the archive cannot be opened
 */
export async function infoCommand(
  file: string,
  json: boolean,
  verbose: boolean = false
): Promise<string> {
  const archive = await openArchive(file);
  try {
    const header = await archive.getHeader();

    let perZoom: Record<number, number> | undefined;
    if (verbose) {
      perZoom = {};
      for await (const { z } of archive.listTiles()) {
        perZoom[z] = (perZoom[z] ?? 0) + 1;
      }
    }

    if (json) {
      const output: Record<string, unknown> = { ...header };
      if (perZoom) output.perZoom = perZoom;
      return JSON.stringify(output, null, 2);
    }

    const lines = [
      `Format:     ${header.format.toUpperCase()}`,
      `Tile type:  ${header.tileType}`,
      `Compression: ${header.compression}`,
      `Zoom range: ${header.minZoom} – ${header.maxZoom}`,
      `Bounds:     [${header.bounds.join(", ")}]`,
      `Center:     ${header.center ? header.center.join(", ") : "not set"}`,
      `Tile count: ${header.tileCount}`,
    ];
    if (header.vectorLayers?.length) {
      lines.push(`Vector layers: ${header.vectorLayers.join(", ")}`);
    }
    if (perZoom) {
      lines.push("", "Per-zoom tile counts:");
      for (const z of Object.keys(perZoom).map(Number).sort((a, b) => a - b)) {
        lines.push(`  z${z}: ${perZoom[z]} tiles`);
      }
    }
    return lines.join("\n");
  } finally {
    await archive.close();
  }
}
