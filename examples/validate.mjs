#!/usr/bin/env node
// validate.mjs — Validate a PMTiles file structure
import { validatePmtiles } from '../src/index.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate.mjs <file.pmtiles>');
  process.exit(1);
}

const result = await validatePmtiles(file);

if (result.valid) {
  console.log(`✓ ${file} is a valid PMTiles file`);
  process.exit(0);
} else {
  console.error(`✗ ${file} has issues:`);
  for (const err of result.errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}
