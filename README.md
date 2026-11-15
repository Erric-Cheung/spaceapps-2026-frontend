# SpaceApps frontend

React, TypeScript, Vite, MapLibre GL, and PMTiles. A map of Ontario where you click
fields to select them (shift-drag selects a box). Fields load from the SpaceApps API
for the visible area once you zoom in to level 12.

## Run locally

```sh
cp .env.example .env     # API_URL: the SpaceApps data API; VITE_GEOCODER_URL: address search
npm install
npm run dev
```

The API sends no CORS headers, so the browser calls `/api/*` and Vite forwards it
to `API_URL`. The map uses `GET /fields?bbox=...`, following `nextCursor`.

## Selecting fields

Selected fields appear with a north-up outline and approximate acreage. Select a
row to locate its field on the map, or use Remove to deselect it. Field numbers
follow selection order and close any gaps when a field is removed, in both the
list and map. On phones, Show field list expands the selection panel.

Crop history starts loading on selection, with at most two requests in flight.
Results are reused for the session. Continue opens crop confirmation immediately;
missing or failed history never prevents manual entry, and failed requests can be
retried. Current crops start blank and arriving history does not replace entries.

Local browser verification at 1440 x 900 and 390 x 844 checked selection, removal,
field location, and consecutive numbering. With history deliberately delayed, opening
crop confirmation took 27 ms in one local run; this measures the screen transition,
not provider latency. A simulated provider failure and successful real-data retry
preserved the crop and planting date entered while waiting.

Run acquisition queue and navigation checks with:

```sh
node --test tests/cropHistoryCache.test.ts tests/mapNavigation.test.ts
```

## Address search

The search box on the map finds addresses, roads and towns in Canada with
[Photon](https://photon.komoot.io) (OpenStreetMap data, no API key), set by
`VITE_GEOCODER_URL`. Addresses drop a pin at street level; towns zoom in far
enough for fields to load. Rural house numbers missing from OpenStreetMap fall
back to the road.

## Basemap

Vector tiles and fonts come from [OpenFreeMap](https://openfreemap.org) (free, no API
key, worldwide), styled in `src/basemap.ts` with a quiet paper palette. Nothing to
download; the browser fetches only the visible tiles. Map data © OpenStreetMap
contributors, OpenMapTiles.

## Production hosting

```sh
npm run build
```

Serve `dist/` and configure the host to forward `/api/*` to the data API,
stripping `/api` from the upstream path. The Vite development proxy is not part
of the production build. `npm run preview` does not configure this API routing.

## Checks

```sh
npm run build
npm run lint
```

## Map navigation

Camera movement stays within a padded outline of the imported Canada/US/Mexico
regions, including Alaska and Hawaii. The navigation envelope follows country
coasts rather than individual field polygons, leaving room for coastal farms,
islands, lakes and gaps between fields. Its 150 km buffer in Web Mercator gives
roughly 40–150 km of actual offshore room depending on latitude. Zooming out can
still show surrounding ocean; the camera centre cannot wander into the deep ocean
or other continents. Mouse, touch, keyboard and search-driven camera changes use
the same constraint.

`src/data/mapCoverage.ts` is a simplified navigation envelope generated from the
same geoBoundaries country masks and geographic tiles used by the data importer.
It is a navigation aid, not a claim that every location contains a detected field.
Attribution: geoBoundaries; Canada: OpenStreetMap/Wambacher (ODbL 1.0);
US: US Census Bureau (public domain); Mexico: geoBoundaries/World Bank (CC-BY-4.0).
Source metadata: https://www.geoboundaries.org/api/current/gbOpen/.

Run navigation checks with `node --test tests/mapNavigation.test.ts` on Node 22.18+
or a newer Node version with native TypeScript support.
