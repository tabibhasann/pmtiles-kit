import { ValidationReport } from "./archive/types";

/** Format a validation report into a human-readable string with errors and warnings.
 *
 * @param report - The validation report to format
 * @returns A multi-line string with ✓/✗ status and listed errors/warnings
 */
export function prettyReport(report: ValidationReport): string {
  const lines: string[] = [];
  lines.push(report.valid ? "✓ Valid" : "✗ Invalid");
  for (const e of report.errors) {
    lines.push(`  [ERROR] ${e}`);
  }
  for (const w of report.warnings) {
    lines.push(`  [WARN]  ${w}`);
  }
  return lines.join("\n");
}
