import { openArchive } from "../archive/open";

/** Extract a single tile from an archive and write it to stdout or a file.
 *
 * @param file - Path to the archive
 * @param z - Zoom level
 * @param x - Tile column (XYZ)
 * @param y - Tile row (XYZ)
 * @returns The tile bytes
 * @throws {Error} If the tile doesn't exist or the archive can't be opened
 */
export async function tileCommand(
  file: string,
  z: number,
  x: number,
  y: number
): Promise<Uint8Array> {
  const archive = await openArchive(file);
  try {
    const tile = await archive.getTile(z, x, y);
    if (!tile) {
      throw new Error(`No tile found at z=${z}, x=${x}, y=${y}`);
    }
    return tile;
  } finally {
    await archive.close();
  }
}
