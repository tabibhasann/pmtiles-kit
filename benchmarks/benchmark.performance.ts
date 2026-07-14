/**
 * Performance benchmarks for pmtiles-kit.
 * 
 * Measures tile reading, conversion, and validation performance.
 */

import { performance } from 'perf_hooks';
import { MBTilesArchive } from '../src/archive/mbtiles';
import { convertCommand } from '../src/commands/convert';
import { validateCommand } from '../src/commands/validate';
import { infoCommand } from '../src/commands/info';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

interface BenchmarkResult {
  name: string;
  iterations: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  throughput: number;
}

function calculateStats(name: string, times: number[], _unit: string = 'ops'): BenchmarkResult {
  const sorted = [...times].sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const mean = sum / times.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  
  return {
    name,
    iterations: times.length,
    mean,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    throughput: 1000 / mean, // ops per second
  };
}

function printResult(result: BenchmarkResult) {
  console.log(`${result.name}:`);
  console.log(`  Mean: ${result.mean.toFixed(2)}ms`);
  console.log(`  Median: ${result.median.toFixed(2)}ms`);
  console.log(`  Min: ${result.min.toFixed(2)}ms`);
  console.log(`  Max: ${result.max.toFixed(2)}ms`);
  console.log(`  Throughput: ${result.throughput.toFixed(0)} ops/sec`);
  console.log();
}

function createTestMBTiles(numTiles: number): string {
  const tempPath = path.join('/tmp', `benchmark_${Date.now()}.mbtiles`);
  const db = new Database(tempPath);
  
  db.exec(`
    CREATE TABLE metadata (name TEXT, value TEXT);
    CREATE TABLE tiles (
      zoom_level INTEGER,
      tile_column INTEGER,
      tile_row INTEGER,
      tile_data BLOB
    );
    CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row);
  `);
  
  db.prepare("INSERT INTO metadata VALUES (?, ?)").run("name", "Benchmark Test");
  db.prepare("INSERT INTO metadata VALUES (?, ?)").run("format", "pbf");
  db.prepare("INSERT INTO metadata VALUES (?, ?)").run("bounds", "-180,-85,180,85");
  
  const insert = db.prepare(
    "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)"
  );
  
  // Create tiles across multiple zoom levels
  let tileCount = 0;
  for (let z = 0; z <= 5 && tileCount < numTiles; z++) {
    const maxCoord = Math.pow(2, z);
    for (let x = 0; x < maxCoord && tileCount < numTiles; x++) {
      for (let y = 0; y < maxCoord && tileCount < numTiles; y++) {
        const tileSize = 1024 + Math.random() * 10240; // 1KB to 11KB
        insert.run(z, x, y, Buffer.alloc(tileSize));
        tileCount++;
      }
    }
  }
  
  db.close();
  return tempPath;
}

async function benchmarkTileReading() {
  console.log('\n' + '='.repeat(60));
  console.log('TILE READING BENCHMARK');
  console.log('='.repeat(60));
  
  const testFile = createTestMBTiles(1000);
  
  try {
    const archive = new MBTilesArchive(testFile);
    archive.init();
    
    // Benchmark single tile reads
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const z = Math.floor(Math.random() * 5);
      const maxCoord = Math.pow(2, z);
      const x = Math.floor(Math.random() * maxCoord);
      const y = Math.floor(Math.random() * maxCoord);
      
      const start = performance.now();
      await archive.getTile(z, x, y);
      const end = performance.now();
      times.push(end - start);
    }
    
    const result = calculateStats('Single tile read', times);
    printResult(result);
    
    // Benchmark sequential reads
    const seqTimes: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      for (let z = 0; z < 3; z++) {
        for (let x = 0; x < 4; x++) {
          for (let y = 0; y < 4; y++) {
            await archive.getTile(z, x, y);
          }
        }
      }
      const end = performance.now();
      seqTimes.push(end - start);
    }
    
    const seqResult = calculateStats('Sequential reads (48 tiles)', seqTimes);
    printResult(seqResult);
    
    await archive.close();
  } finally {
    fs.unlinkSync(testFile);
  }
}

async function benchmarkTileListing() {
  console.log('='.repeat(60));
  console.log('TILE LISTING BENCHMARK');
  console.log('='.repeat(60));
  
  const sizes = [100, 500, 1000];
  
  for (const size of sizes) {
    const testFile = createTestMBTiles(size);
    
    try {
      const archive = new MBTilesArchive(testFile);
      archive.init();
      
      const times: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        for await (const _tile of archive.listTiles()) {
          // iterate to measure time
        }
        const end = performance.now();
        times.push(end - start);
      }
      
      const result = calculateStats(`List ${size} tiles`, times);
      printResult(result);
      
      await archive.close();
    } finally {
      fs.unlinkSync(testFile);
    }
  }
}

async function benchmarkConversion() {
  console.log('='.repeat(60));
  console.log('CONVERSION BENCHMARK');
  console.log('='.repeat(60));
  
  const sizes = [100, 500, 1000];
  
  for (const size of sizes) {
    const inputFile = createTestMBTiles(size);
    const outputFile = path.join('/tmp', `converted_${Date.now()}.mbtiles`);
    
    try {
      const times: number[] = [];
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        await convertCommand(inputFile, outputFile);
        const end = performance.now();
        times.push(end - start);
        
        // Clean up output
        if (fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile);
        }
      }
      
      const result = calculateStats(`Convert ${size} tiles`, times);
      printResult(result);
    } finally {
      if (fs.existsSync(inputFile)) {
        fs.unlinkSync(inputFile);
      }
      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
      }
    }
  }
}

async function benchmarkValidation() {
  console.log('='.repeat(60));
  console.log('VALIDATION BENCHMARK');
  console.log('='.repeat(60));
  
  const sizes = [100, 500, 1000];
  
  for (const size of sizes) {
    const testFile = createTestMBTiles(size);
    
    try {
      const times: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await validateCommand(testFile, false);
        const end = performance.now();
        times.push(end - start);
      }
      
      const result = calculateStats(`Validate ${size} tiles`, times);
      printResult(result);
    } finally {
      fs.unlinkSync(testFile);
    }
  }
}

async function benchmarkStats() {
  console.log('='.repeat(60));
  console.log('STATISTICS BENCHMARK');
  console.log('='.repeat(60));
  
  const sizes = [100, 500, 1000];
  
  for (const size of sizes) {
    const testFile = createTestMBTiles(size);
    
    try {
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await infoCommand(testFile, false);
        const end = performance.now();
        times.push(end - start);
      }
      
      const result = calculateStats(`Stats for ${size} tiles`, times);
      printResult(result);
    } finally {
      fs.unlinkSync(testFile);
    }
  }
}

async function runAllBenchmarks() {
  console.log('\n' + '='.repeat(60));
  console.log('PMTILES-KIT PERFORMANCE BENCHMARKS');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  
  await benchmarkTileReading();
  await benchmarkTileListing();
  await benchmarkConversion();
  await benchmarkValidation();
  await benchmarkStats();
  
  console.log('='.repeat(60));
  console.log('BENCHMARK COMPLETE');
  console.log(`Finished at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
}

runAllBenchmarks().catch(console.error);
