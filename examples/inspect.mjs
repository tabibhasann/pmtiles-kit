#!/usr/bin/env node
// inspect.mjs — Inspect a PMTiles file and print summary
import { readPmtiles } from '../src/index.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node inspect.mjs <file.pmtiles>');
  process.exit(1);
}

const { header, metadata } = await readPmtiles(file);

console.log('PMTiles Inspection Report');
console.log('=========================');
console.log(`Format:     ${header.format}`);
console.log(`Zoom range: ${header.minZoom} - ${header.maxZoom}`);
console.log(`Bounds:     ${header.minLon}, ${header.minLat} → ${header.maxLon}, ${header.maxLat}`);
console.log(`Center:     ${header.centerLon}, ${header.centerLat}, z${header.centerZoom}`);
console.log(`Tile count: ${header.tileCount}`);
console.log(`Metadata:   ${JSON.stringify(metadata, null, 2)}`);
