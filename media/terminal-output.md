```text
$ pmtiles-kit info sample.pmtiles

Format:     PMTILES
Tile type:  mvt
Compression: gzip
Zoom range: 0 – 2
Bounds:     [-85.051129, -180, 85.051129, 180]
Center:     0, 0, 1
Tile count: 5

$ pmtiles-kit validate sample.pmtiles

✓ Valid

$ pmtiles-kit --help

Usage: pmtiles-kit [options] [command]

Swiss-army knife for PMTiles and MBTiles map tile archives

Options:
  -V, --version                 output the version number
  -h, --help                    display help for command

Commands:
  info [options] <file>         Show archive header and metadata
  validate [options] <file>     Validate archive structure (exit 1 if invalid)
  convert [options] <in> <out>  Convert between PMTiles and MBTiles
  serve [options] <file>        Start a local tile server with MapLibre preview
  tile [options] <file>         Dump a single tile to stdout
  extract [options] <in> <out>  Subset a PMTiles/MBTiles archive by bbox and/or
                                zoom range
  scan [options] <dir>          Scan a directory for PMTiles/MBTiles files
  compare [options] <a> <b>     Compare two tile archives
  help [command]                display help for command
```
