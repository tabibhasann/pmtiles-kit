/**
 * `compare` command — compare two tile archives.
 *
 * Reports differences in headers, tile sets, and tile bytes.
 */

import { openArchive } from "../archive/open";
import { TileArchiveHeader } from "../archive/types";

interface CompareResult {
  headerDiffs: { field: string; a: unknown; b: unknown }[];
  tilesOnlyInA: { z: number; x: number; y: number }[];
  tilesOnlyInB: { z: number; x: number; y: number }[];
  tileByteDiffs: { z: number; x: number; y: number; aSize: number; bSize: number }[];
  tilesMatched: number;
}

async function compareArchives(
  pathA: string,
  pathB: string
): Promise<{ result: CompareResult; headerA: TileArchiveHeader; headerB: TileArchiveHeader }> {
  const archA = await openArchive(pathA);
  const archB = await openArchive(pathB);
  const headerA = await archA.getHeader();
  const headerB = await archB.getHeader();

  const headerDiffs: { field: string; a: unknown; b: unknown }[] = [];
  const fields: (keyof TileArchiveHeader)[] = [
    "format",
    "tileType",
    "compression",
    "minZoom",
    "maxZoom",
    "tileCount",
  ];
  for (const f of fields) {
    if (headerA[f] !== headerB[f]) {
      headerDiffs.push({ field: f, a: headerA[f], b: headerB[f] });
    }
  }

  const tilesA = new Map<string, { z: number; x: number; y: number }>();
  const tilesB = new Map<string, { z: number; x: number; y: number }>();

  for await (const t of archA.listTiles()) {
    tilesA.set(`${t.z}/${t.x}/${t.y}`, t);
  }
  for await (const t of archB.listTiles()) {
    tilesB.set(`${t.z}/${t.x}/${t.y}`, t);
  }

  const tilesOnlyInA: { z: number; x: number; y: number }[] = [];
  const tilesOnlyInB: { z: number; x: number; y: number }[] = [];
  const tileByteDiffs: { z: number; x: number; y: number; aSize: number; bSize: number }[] = [];
  let tilesMatched = 0;

  for (const [key, t] of tilesA) {
    if (!tilesB.has(key)) {
      tilesOnlyInA.push(t);
      continue;
    }
    const a = await archA.getTile(t.z, t.x, t.y);
    const b = await archB.getTile(t.z, t.x, t.y);
    if (a && b) {
      if (a.length !== b.length || !a.every((v, i) => v === b[i])) {
        tileByteDiffs.push({ ...t, aSize: a.length, bSize: b.length });
      } else {
        tilesMatched++;
      }
    }
  }

  for (const [key, t] of tilesB) {
    if (!tilesA.has(key)) {
      tilesOnlyInB.push(t);
    }
  }

  await archA.close();
  await archB.close();

  return {
    result: { headerDiffs, tilesOnlyInA, tilesOnlyInB, tileByteDiffs, tilesMatched },
    headerA,
    headerB,
  };
}

/** Compare two archives tile-by-tile and report differences. */
export async function compareCommand(
  pathA: string,
  pathB: string,
  json: boolean = false
): Promise<string> {
  const { result, headerA, headerB } = await compareArchives(pathA, pathB);

  if (json) {
    return JSON.stringify(
      {
        archive_a: pathA,
        archive_b: pathB,
        header_a: headerA,
        header_b: headerB,
        ...result,
      },
      null,
      2
    );
  }

  const lines: string[] = [
    `Comparing: ${pathA} vs ${pathB}\n`,
    `  Tiles matched:  ${result.tilesMatched}`,
    `  Only in A:      ${result.tilesOnlyInA.length}`,
    `  Only in B:      ${result.tilesOnlyInB.length}`,
    `  Byte diffs:     ${result.tileByteDiffs.length}`,
    `  Header diffs:   ${result.headerDiffs.length}`,
  ];

  if (result.headerDiffs.length > 0) {
    lines.push("\n  Header differences:");
    for (const d of result.headerDiffs) {
      lines.push(`    ${d.field}: A=${d.a}  B=${d.b}`);
    }
  }

  if (result.tilesOnlyInA.length > 0 && result.tilesOnlyInA.length <= 20) {
    lines.push("\n  Tiles only in A:");
    for (const t of result.tilesOnlyInA.slice(0, 20)) {
      lines.push(`    ${t.z}/${t.x}/${t.y}`);
    }
  }

  if (result.tilesOnlyInB.length > 0 && result.tilesOnlyInB.length <= 20) {
    lines.push("\n  Tiles only in B:");
    for (const t of result.tilesOnlyInB.slice(0, 20)) {
      lines.push(`    ${t.z}/${t.x}/${t.y}`);
    }
  }

  return lines.join("\n");
}
