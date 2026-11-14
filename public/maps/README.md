# Basemap

`basemap.pmtiles` is not committed (about 180 MB). Create it with:

```sh
npm run basemap               # uses yesterday's Protomaps build
BUILD=20261114 npm run basemap # or a specific build date
```

It is a subset of the Protomaps daily build covering southern Ontario (west -83.2,
south 41.6, east -74.3, north 48.0), zoom 0 to 12. MapLibre overzooms the zoom 12
tiles when viewing individual fields. Needs the PMTiles CLI (`brew install pmtiles`).

Data: OpenStreetMap contributors, ODbL, distributed via Protomaps.
https://www.openstreetmap.org/copyright
https://protomaps.com

The hosting server must support HTTP byte-range requests (206 responses);
Vite's development server does.
