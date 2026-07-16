import http from "http";
import { randomBytes } from "crypto";
import { openArchive } from "../archive/open";
import { isAllowedLoopbackHost } from "../security";

const MAPLIBRE_VERSION = "4.7.1";
const MAPLIBRE_JS_INTEGRITY =
  "sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj";
const MAPLIBRE_CSS_INTEGRITY =
  "sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V";

const VIEWER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>pmtiles-kit Viewer</title>
<script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js" integrity="${MAPLIBRE_JS_INTEGRITY}" crossorigin="anonymous"></script>
<link href="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" rel="stylesheet" integrity="${MAPLIBRE_CSS_INTEGRITY}" crossorigin="anonymous">
<style>
  body { margin: 0; padding: 0; }
  #map { position: absolute; top: 0; bottom: 0; width: 100%; }
  .info { position: absolute; top: 10px; right: 10px; background: white; padding: 10px; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.2); font-family: sans-serif; font-size: 12px; z-index: 1000; max-width: 300px; }
</style>
</head>
<body>
<div class="info" id="info"></div>
<div id="map"></div>
<script nonce="__NONCE__">
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
  const info = document.getElementById("info");
  const format = document.createElement("strong");
  format.textContent = String(header.format).toUpperCase();
  info.append(
    format,
    document.createElement("br"),
    document.createTextNode("Type: " + String(header.tileType)),
    document.createElement("br"),
    document.createTextNode("Zooms: " + String(header.minZoom) + "-" + String(header.maxZoom)),
    document.createElement("br"),
    document.createTextNode("Tiles: " + String(header.tileCount)),
  );
});
</script>
</body>
</html>`;

/** Serialize untrusted archive metadata for safe embedding in a JavaScript script block.
 *
 * @param value - The value to serialize
 * @returns A JSON string with HTML-unsafe characters escaped
 */
export function serializeForInlineScript(value: unknown): string {
  const json = JSON.stringify(value) ?? "null";
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Build the viewer document without rescanning inserted values for placeholders.
 *
 * @param header - The archive header object
 * @param tileJson - The TileJSON object
 * @param nonce - CSP nonce for the script tag
 * @returns A complete HTML document string
 */
export function buildViewerHtml(
  header: unknown,
  tileJson: unknown,
  nonce: string
): string {
  const replacements: Record<string, string> = {
    __HEADER__: serializeForInlineScript(header),
    __TILEJSON__: serializeForInlineScript(tileJson),
    __NONCE__: nonce,
  };
  return VIEWER_HTML.replace(
    /__(?:HEADER|TILEJSON|NONCE)__/g,
    (placeholder) => replacements[placeholder]
  );
}

/** Start a local HTTP server serving tiles from a PMTiles or MBTiles archive.
 *
 * @param file - Path to the archive
 * @param port - Port to listen on (default 8080)
 * @throws {Error} If the archive cannot be opened
 */
export async function serveCommand(
  file: string,
  port: number = 8080
): Promise<void> {
  const archive = await openArchive(file);
  const header = await archive.getHeader();

  const tilesUrl = "/tiles/{z}/{x}/{y}";

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

  const tileJson = {
    tilejson: "3.0.0",
    tiles: [tilesUrl],
    minzoom: header.minZoom,
    maxzoom: header.maxZoom,
    bounds: header.bounds,
    center: header.center,
    style,
  };

  const nonce = randomBytes(18).toString("base64url");
  const viewer = buildViewerHtml(header, tileJson, nonce);
  const viewerHeaders = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": [
      "default-src 'none'",
      `script-src 'nonce-${nonce}' https://unpkg.com`,
      "style-src 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "worker-src blob:",
      "font-src data:",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };

  const server = http.createServer(async (req, res) => {
    if (!isAllowedLoopbackHost(req.headers.host)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden host");
      return;
    }
    const url = new URL(req.url || "/", `http://localhost:${port}`);

    // Serve MapLibre viewer at root
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, viewerHeaders);
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

  server.listen(port, "127.0.0.1", () => {
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
