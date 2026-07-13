#!/usr/bin/env node
/**
 * Generate draft release notes from merged PRs since the last tag.
 *
 * Usage:
 *   node scripts/release_notes.js [--since-tag v0.1.0] [--version unreleased] [--output NOTES.md]
 *
 * Requires `gh` (GitHub CLI) to be authenticated.
 */

import { execSync } from "child_process";
import { writeFileSync } from "fs";

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

function getLastTag() {
  return run("git describe --tags --abbrev=0");
}

function getMergedPRs(sinceTag) {
  let cmd = "gh pr list --state merged --limit 100 --json number,title,author,mergedAt";
  if (sinceTag) {
    cmd += ` --search "merged:>=${sinceTag}"`;
  }
  const raw = run(cmd);
  if (!raw) return [];
  try {
    return JSON.parse(raw).map((item) => ({
      number: String(item.number || ""),
      title: item.title || "",
      author: (item.author || {}).login || "",
    }));
  } catch {
    return [];
  }
}

function categorize(prs) {
  const cats = {
    "Breaking Changes": [],
    Features: [],
    "Bug Fixes": [],
    Documentation: [],
    Maintenance: [],
  };
  for (const pr of prs) {
    const t = pr.title;
    if (t.startsWith("BREAKING") || t.startsWith("!")) cats["Breaking Changes"].push(pr);
    else if (t.startsWith("feat") || t.startsWith("add")) cats["Features"].push(pr);
    else if (t.startsWith("fix") || t.startsWith("bug")) cats["Bug Fixes"].push(pr);
    else if (t.startsWith("docs") || t.startsWith("doc")) cats["Documentation"].push(pr);
    else cats["Maintenance"].push(pr);
  }
  return cats;
}

function generateNotes(prs, version) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`## [${version}] - ${today}`, ""];

  const cats = categorize(prs);
  for (const [catName, items] of Object.entries(cats)) {
    if (!items.length) continue;
    lines.push(`### ${catName}`);
    for (const pr of items) {
      lines.push(`- ${pr.title} (#${pr.number}) @${pr.author}`);
    }
    lines.push("");
  }

  if (!prs.length) {
    lines.push("_No merged PRs since last tag._", "");
  }

  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  let sinceTag = null;
  let version = "unreleased";
  let output = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--since-tag" && args[i + 1]) sinceTag = args[++i];
    if (args[i] === "--version" && args[i + 1]) version = args[++i];
    if (args[i] === "--output" && args[i + 1]) output = args[++i];
  }

  const since = sinceTag || getLastTag();
  const prs = getMergedPRs(since);
  const notes = generateNotes(prs, version);

  if (output) {
    writeFileSync(output, notes + "\n");
    console.log(`Written to ${output}`);
  } else {
    console.log(notes);
  }
}

main();
