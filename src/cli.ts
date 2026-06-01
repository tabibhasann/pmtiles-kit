#!/usr/bin/env node

import { Command } from "commander";
import { infoCommand } from "./commands/info";
import { validateCommand } from "./commands/validate";
import { convertCommand } from "./commands/convert";
import { serveCommand } from "./commands/serve";
import { tileCommand } from "./commands/tile";
import { writeFileSync } from "fs";

const program = new Command();

program
  .name("pmtiles-kit")
  .description("Swiss-army knife for PMTiles and MBTiles map tile archives")
  .version("0.1.0");

program
  .command("info <file>")
  .description("Show archive header and metadata")
  .option("--json", "Output as JSON")
  .action(async (file: string, options: { json?: boolean }) => {
    const output = await infoCommand(file, !!options.json);
    console.log(output);
  });

program
  .command("validate <file>")
  .description("Validate archive structure (exit 1 if invalid)")
  .option("--json", "Output as JSON")
  .action(async (file: string, options: { json?: boolean }) => {
    const output = await validateCommand(file, !!options.json);
    console.log(output);
    if (!options.json && output.startsWith("✗")) {
      process.exit(1);
    }
  });

program
  .command("convert <in> <out>")
  .description("Convert between PMTiles and MBTiles")
  .action(async (src: string, dst: string) => {
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

program.parse();
