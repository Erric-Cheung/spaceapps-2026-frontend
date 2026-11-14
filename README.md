# SpaceApps frontend

React, TypeScript, Vite, MapLibre GL, and PMTiles. The map loads field boundaries from the
SpaceApps data API, fits the map to their extent, and shows estimated acreage
when a field is selected on the map or from the keyboard-accessible Field dropdown.

## Run locally

Start the data API in one terminal:

```sh
cd ../spaceapps-2026-data
source .venv/bin/activate
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Start the frontend in another terminal, from this directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Vite forwards `/api/*` to
`http://127.0.0.1:8000/*`, so development needs no CORS changes. The frontend uses
`GET /api/fields` for GeoJSON and `GET /api/fields/{id}` for acreage. A loading
message, empty-data message, and retry button cover unavailable boundary data.

The bundled dataset contains 55 USDA NASS Crop Sequence Boundaries fields near
41.37, -91.93 in Iowa. It contains outlines and IDs, without crop history.
These are remotely derived agricultural fields; acreage is estimated.
TidyEarth is not required. To use another region, configure the data API's
`FIELDS_FILE` with a compatible GeoJSON FeatureCollection, then restart the API.

## Basemap

The map uses Fieldpicker's Protomaps vector basemap, styled with a quiet paper
palette, muted roads, water, and place labels. The bundled archive is a 6.9 MiB
subset around the Iowa demo. See [public/maps/README.md](public/maps/README.md)
for coverage, attribution, and regeneration instructions. Field boundaries still
come from the API, independently of the background tiles. Place labels require
access to the Protomaps font endpoint.

## Production hosting

```sh
npm run build
```

Serve `dist/` and configure the host to forward `/api/*` to the data API,
stripping `/api` from the upstream path. Serve `.pmtiles` files with HTTP byte-range
support (206 responses). The Vite development proxy is not part
of the production build. `npm run preview` does not configure this API routing.

## Checks

```sh
npm run build
npm run lint
```
