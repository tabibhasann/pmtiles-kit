import http from "http";
import { openArchive } from "../archive/open";

const VIEWER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>pmtiles-kit Viewer</title>
<script src="https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js"></script>
<link href="https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css" rel="stylesheet">
<style>
  body { margin: 0; padding: 0; }
  #map { position: absolute; top: 0; bottom: 0; width: 100%; }
  .info { position: absolute; top: 10px; right: 10px; background: white; padding: 10px; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.2); font-family: sans-serif; font-size: 12px; z-index: 1000; max-width: 300px; }
</style>
</head>
<body>
<div class="info" id="info"></div>
<div id="map"></div>
<script>
const header = __HEADER__;
const tileJson = __TILEJSON__;

const map = new maplibregl.Map({
  container: "map",
  style: tileJson.style || {
    version: 8,
    sources: {
      tiles: {
        type: "vector",
        tiles: ["/tiles/{z}/{x}/{y}"],
        minzoom: header.minZoom,
        maxzoom: header.maxZoom,
      }
    },
    layers: []
  },
  center: header.center ? [header.center[0], header.center[1]] : [0, 0],
  zoom: header.center ? header.center[2] : 2,
});

map.on("load", () => {
  document.getElementById("info").innerHTML =
    "<b>" + header.format.toUpperCase() + "</b><br>" +
    "Type: " + header.tileType + "<br>" +
    "Zooms: " + header.minZoom + "-" + header.maxZoom + "<br>" +
    "Tiles: " + header.tileCount;
});
</script>
</body>
</html>`;

/** Start a local HTTP server serving tiles from a PMTiles or MBTiles archive. */
export async function serveCommand(
  file: string,
  port: number = 8080
): Promise<void> {
  const archive = await openArchive(file);
  const header = await archive.getHeader();

  const tilesUrl = `http://localhost:${port}/tiles/{z}/{x}/{y}`;

  let style: Record<string, unknown> | null = null;

  if (header.tileType === "vector" && header.vectorLayers?.length) {
    const layers = header.vectorLayers.map((id) => ({
      id,
      type: "fill",
      source: "tiles",
      "source-layer": id,
      paint: {
        "fill-color": "#888",
        "fill-opacity": 0.4,
        "fill-outline-color": "#444",
      },
    }));

    style = {
      version: 8,
      sources: {
        tiles: {
          type: "vector" as const,
          tiles: [tilesUrl],
          minzoom: header.minZoom,
          maxzoom: header.maxZoom,
        },
      },
      layers,
    };
  } else if (header.tileType === "raster") {
    style = {
      version: 8,
      sources: {
        tiles: {
          type: "raster" as const,
          tiles: [tilesUrl],
          minzoom: header.minZoom,
          maxzoom: header.maxZoom,
          tileSize: 256,
        },
      },
      layers: [
        {
          id: "raster",
          type: "raster",
          source: "tiles",
        },
      ],
    };
  }

  const tileJson = JSON.stringify({
    tilejson: "3.0.0",
    tiles: [tilesUrl],
    minzoom: header.minZoom,
    maxzoom: header.maxZoom,
    bounds: header.bounds,
    center: header.center,
    style,
  });

  const viewer = VIEWER_HTML.replace("__HEADER__", JSON.stringify(header)).replace(
    "__TILEJSON__",
    tileJson
  );

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);

    // Serve MapLibre viewer at root
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(viewer);
      return;
    }

    // Serve tile endpoint
    const match = url.pathname.match(/^\/tiles\/(\d+)\/(\d+)\/(\d+)$/);
    if (match) {
      const [, zStr, xStr, yStr] = match;
      const z = parseInt(zStr);
      const x = parseInt(xStr);
      const y = parseInt(yStr);

      try {
        const tile = await archive.getTile(z, x, y);
        if (tile) {
          const contentType =
            header.tileType === "vector" || header.tileType === "mvt"
              ? "application/x-protobuf"
              : header.tileType === "jpeg"
                ? "image/jpeg"
                : header.tileType === "webp"
                  ? "image/webp"
                  : header.tileType === "avif"
                    ? "image/avif"
                    : "image/png";
          res.writeHead(200, {
            "Content-Type": contentType,
            "Content-Encoding": header.compression === "gzip" ? "gzip" : "identity",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(Buffer.from(tile));
        } else {
          res.writeHead(204);
          res.end();
        }
      } catch {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Tile fetch error");
      }
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, () => {
    console.log(`\n  pmtiles-kit viewer: http://localhost:${port}/\n`);
    console.log(`  Tile endpoint: http://localhost:${port}/tiles/{z}/{x}/{y}\n`);
    console.log("  Press Ctrl+C to stop\n");
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    server.close();
    await archive.close();
    process.exit(0);
  });
}
