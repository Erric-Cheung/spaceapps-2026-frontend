#!/bin/sh
# Downloads the Ontario basemap into public/maps/ (needs the pmtiles CLI: brew install pmtiles).
set -e
BUILD=${BUILD:-$(date -v-1d +%Y%m%d 2>/dev/null || date -d yesterday +%Y%m%d)}
pmtiles extract "https://build.protomaps.com/$BUILD.pmtiles" public/maps/basemap.pmtiles \
  --bbox=-83.2,41.6,-74.3,48.0 --maxzoom=12
