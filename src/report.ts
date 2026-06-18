import { ValidationReport } from "./archive/types";

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
