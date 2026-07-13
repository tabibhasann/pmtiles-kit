#!/usr/bin/env node
// convert.mjs — Convert MBTiles to PMTiles
import { convertMbtilesToPmtiles } from '../src/index.js';

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error('Usage: node convert.mjs <input.mbtiles> <output.pmtiles>');
  process.exit(1);
}

console.log(`Converting ${input} → ${output}...`);
await convertMbtilesToPmtiles(input, output);
console.log('Done!');
