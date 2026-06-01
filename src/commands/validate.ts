import { openArchive } from "../archive/open";
import { ValidationReport } from "../archive/types";
import { prettyReport } from "../report";

export async function validateCommand(
  file: string,
  json: boolean
): Promise<string> {
  const report: ValidationReport = { valid: true, errors: [], warnings: [] };
  let archive;

  try {
    archive = await openArchive(file);
  } catch (e) {
    report.valid = false;
    report.errors.push(`Failed to open archive: ${e}`);
    if (json) return JSON.stringify(report, null, 2);
    return prettyReport(report);
  }

  try {
    const header = await archive.getHeader();

    // Check header sanity
    if (header.minZoom > header.maxZoom) {
      report.errors.push(
        `minZoom (${header.minZoom}) > maxZoom (${header.maxZoom})`
      );
      report.valid = false;
    }

    if (header.minZoom < 0 || header.maxZoom > 24) {
      report.errors.push(
        `Zoom range ${header.minZoom}-${header.maxZoom} outside valid range 0-24`
      );
      report.valid = false;
    }

    const [s, w, n, e] = header.bounds;
    if (s < -90 || n > 90 || w < -180 || e > 180) {
      report.errors.push("Bounds outside valid lat/lon range");
      report.valid = false;
    }

    if (header.tileCount === 0) {
      report.warnings.push("Archive contains zero tiles");
    }

    // Try sampling a few tiles
    const zooms = await archive.listZooms();
    if (zooms.length > 0) {
      const z = zooms[Math.floor(zooms.length / 2)];
      const tile = await archive.getTile(z, 0, 0);
      if (!tile || tile.length === 0) {
        report.errors.push(`No tile data at z=${z}, x=0, y=0`);
        report.valid = false;
      }
    }
  } catch (e) {
    report.valid = false;
    report.errors.push(`Validation error: ${e}`);
  } finally {
    await archive.close();
  }

  if (json) return JSON.stringify(report, null, 2);
  return prettyReport(report);
}
