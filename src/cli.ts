#!/usr/bin/env node

import { Command } from "commander";
import { infoCommand } from "./commands/info";
import { validateCommand } from "./commands/validate";
import { convertCommand } from "./commands/convert";
import { serveCommand } from "./commands/serve";
import { tileCommand } from "./commands/tile";
import { extractCommand, ExtractOptions } from "./commands/extract";
import { scanCommand } from "./commands/scan";
import { compareCommand } from "./commands/compare";
import { writeFileSync } from "fs";

const program = new Command();

program
  .name("pmtiles-kit")
  .description("Swiss-army knife for PMTiles and MBTiles map tile archives")
  .version("0.2.0");

program
  .command("info <file>")
  .description("Show archive header and metadata")
  .option("--json", "Output as JSON")
  .option("--verbose", "Show per-zoom tile counts")
  .action(async (file: string, options: { json?: boolean; verbose?: boolean }) => {
    const output = await infoCommand(file, !!options.json, !!options.verbose);
    console.log(output);
  });

program
  .command("validate <file>")
  .description("Validate archive structure (exit 1 if invalid)")
  .option("--json", "Output as JSON")
  .option("--strict", "Strict mode: treat warnings as errors")
  .action(async (file: string, options: { json?: boolean; strict?: boolean }) => {
    const output = await validateCommand(file, !!options.json, !!options.strict);
    console.log(output);
    if (!options.json && output.startsWith("✗")) {
      process.exit(1);
    }
    if (options.strict && output.includes("⚠")) {
      process.exit(1);
    }
  });

program
  .command("convert <in> <out>")
  .description("Convert between PMTiles and MBTiles")
  .option("--verbose", "Verbose output")
  .action(async (src: string, dst: string, _options: { verbose?: boolean }) => {
    try {
      const output = await convertCommand(src, dst);
      console.log(output);
    } catch (e) {
      console.error("Error:", e);
      process.exit(1);
    }
  });

program
  .command("serve <file>")
  .description("Start a local tile server with MapLibre preview")
  .option("-p, --port <port>", "Port number", "8080")
  .action(async (file: string, options: { port: string }) => {
    await serveCommand(file, parseInt(options.port));
  });

program
  .command("tile <file>")
  .description("Dump a single tile to stdout")
  .requiredOption("-z, --zoom <z>", "Zoom level")
  .requiredOption("-x, --x <x>", "Tile column")
  .requiredOption("-y, --y <y>", "Tile row")
  .option("-o, --output <file>", "Output file path")
  .action(
    async (
      file: string,
      options: { zoom: string; x: string; y: string; output?: string }
    ) => {
      try {
        const tile = await tileCommand(
          file,
          parseInt(options.zoom),
          parseInt(options.x),
          parseInt(options.y)
        );
        if (options.output) {
          writeFileSync(options.output, tile);
          console.log(`Tile written to ${options.output}`);
        } else {
          process.stdout.write(Buffer.from(tile));
        }
      } catch (e) {
        console.error("Error:", e);
        process.exit(1);
      }
    }
  );

program
  .command("extract <in> <out>")
  .description("Subset a PMTiles/MBTiles archive by bbox and/or zoom range")
  .option("--bbox <s,w,n,e>", "Bounding box as 'south,west,north,east'")
  .option("--minzoom <z>", "Minimum zoom level", parseInt)
  .option("--maxzoom <z>", "Maximum zoom level", parseInt)
  .action(async (src: string, dst: string, opts: {
    bbox?: string;
    minzoom?: number;
    maxzoom?: number;
  }) => {
    try {
      const extractOpts: ExtractOptions = {};
      if (opts.bbox) {
        const parts = opts.bbox.split(",").map(Number);
        if (parts.length !== 4 || parts.some(isNaN)) {
          throw new Error("bbox must be 'south,west,north,east'");
        }
        extractOpts.bbox = parts as [number, number, number, number];
      }
      if (opts.minzoom !== undefined) extractOpts.minZoom = opts.minzoom;
      if (opts.maxzoom !== undefined) extractOpts.maxZoom = opts.maxzoom;
      const out = await extractCommand(src, dst, extractOpts);
      console.log(out);
    } catch (e) {
      console.error("Error:", e);
      process.exit(1);
    }
  });

program
  .command("scan <dir>")
  .description("Scan a directory for PMTiles/MBTiles files")
  .option("--json", "Output as JSON")
  .option("--verbose", "Verbose output (show errors per file)")
  .action(async (dir: string, options: { json?: boolean; verbose?: boolean }) => {
    try {
      const output = await scanCommand(dir, !!options.json, !!options.verbose);
      console.log(output);
    } catch (e) {
      console.error("Error:", e);
      process.exit(1);
    }
  });

program
  .command("compare <a> <b>")
  .description("Compare two tile archives")
  .option("--json", "Output as JSON")
  .action(async (a: string, b: string, options: { json?: boolean }) => {
    try {
      const output = await compareCommand(a, b, !!options.json);
      console.log(output);
    } catch (e) {
      console.error("Error:", e);
      process.exit(1);
    }
  });

program.parse();
