import { openArchive } from "../archive/open";

export async function infoCommand(
  file: string,
  json: boolean
): Promise<string> {
  const archive = await openArchive(file);
  try {
    const header = await archive.getHeader();
    if (json) {
      return JSON.stringify(header, null, 2);
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
    return lines.join("\n");
  } finally {
    await archive.close();
  }
}
