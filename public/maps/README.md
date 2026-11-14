# Demo basemap

`basemap.pmtiles` is a 6.9 MiB subset of the Protomaps archive used by
`~/Documents/fieldpicker/data/basemap.pmtiles`. It covers the Iowa demo area and
surroundings: west -92.6, south 40.7, east -91.2, north 42.0. The original archive
contains overview tiles through zoom 7 and regional detail through zoom 13.
MapLibre overzooms those tiles when viewing individual fields.

Data: OpenStreetMap contributors, ODbL, distributed via Protomaps.
https://www.openstreetmap.org/copyright
https://protomaps.com

The original archive was extracted from the 2026-11-09 Protomaps build; see
Fieldpicker's `pipeline/basemap/README.md`. This app uses its own color palette
and adapts the Protomaps layer styling from Fieldpicker's `src/basemap.ts`.

To regenerate this subset with the PMTiles CLI:

```sh
pmtiles extract ~/Documents/fieldpicker/data/basemap.pmtiles \
  /tmp/spaceapps-basemap.pmtiles --bbox=-92.6,40.7,-91.2,42.0
cp /tmp/spaceapps-basemap.pmtiles public/maps/basemap.pmtiles
```

Replace the archive with broader coverage when adding fields outside this area.
The hosting server must support HTTP byte-range requests (206 responses);
Vite's development server does. Place-name glyphs load from the Protomaps font
endpoint configured in `src/basemap.ts`.
