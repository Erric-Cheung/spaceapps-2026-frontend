# SpaceApps frontend

React, TypeScript, Vite, MapLibre GL, and PMTiles. A map of Ontario where you click
fields to select them (shift-drag selects a box). Fields load from the SpaceApps API
for the visible area once you zoom in to level 12.

## Run locally

```sh
cp .env.example .env     # API_URL: the SpaceApps data API
npm install
npm run dev
```

The API sends no CORS headers, so the browser calls `/api/*` and Vite forwards it
to `API_URL`. The map uses `GET /fields?bbox=...`, following `nextCursor`.

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
