import { describe, expect, it } from "vitest";
import {
  buildViewerHtml,
  serializeForInlineScript,
} from "../src/commands/serve";

describe("PMTiles viewer hardening", () => {
  it("serializes archive metadata without closing the script element", () => {
    const attack = "</script><script>alert('archive-xss')</script>\u2028&";
    const serialized = serializeForInlineScript({ layer: attack });

    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u0026");
  });

  it("builds a viewer with a nonce, pinned assets, and no HTML sink", () => {
    const html = buildViewerHtml(
      {
        format: "png",
        tileType: "vector",
        minZoom: 0,
        maxZoom: 1,
        tileCount: 1,
        vectorLayers: ["__TILEJSON__</script>"],
      },
      { style: null },
      "test-nonce"
    );

    expect(html).toContain('nonce="test-nonce"');
    expect(html).toContain("maplibre-gl@4.7.1");
    expect(html).toContain("integrity=\"sha384-");
    expect(html).not.toContain("innerHTML");
    expect(html).not.toContain("__HEADER__");
    expect(html).toContain("__TILEJSON__\\u003c/script\\u003e");
  });
});
