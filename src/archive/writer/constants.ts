import type { PMTilesCompression, TileType } from "../types";

export const COMPRESSION_TO_NUM: Record<PMTilesCompression, number> = {
  unknown: 0,
  none: 1,
  gzip: 2,
  brotli: 3,
  zstd: 4,
};

export const TILE_TYPE_TO_NUM: Record<TileType, number> = {
  unknown: 0,
  mvt: 1,
  png: 2,
  jpeg: 3,
  webp: 4,
  avif: 5,
  maplibre: 6,
};

export const NUM_TO_COMPRESSION: Record<number, PMTilesCompression> = {
  0: "unknown",
  1: "none",
  2: "gzip",
  3: "brotli",
  4: "zstd",
};

export const NUM_TO_TILE_TYPE: Record<number, TileType> = {
  0: "unknown",
  1: "mvt",
  2: "png",
  3: "jpeg",
  4: "webp",
  5: "avif",
  6: "maplibre",
};

export const TZ_VALUES = [
  0, 1, 5, 21, 85, 341, 1365, 5461, 21845, 87381, 349525, 1398101, 5592405,
  22369621, 89478485, 357913941, 1431655765, 5726623061, 22906492245,
  91625968981, 366503875925, 1466015503701, 5864062014805, 23456248059221,
  93824992236885, 375299968947541, 1501199875790165,
] as const;

export const HEADER_SIZE = 127;
