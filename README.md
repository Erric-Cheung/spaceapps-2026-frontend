# SpaceApps frontend

React, TypeScript, Vite, MapLibre GL, and PMTiles. A map of Ontario where you click
fields to select them (shift-drag selects a box). Fields load from the SpaceApps API
for the visible area once you zoom in to level 12.

## Run locally

```sh
cp .env.example .env     # API_URL: the SpaceApps Java API; VITE_GEOCODER_URL: address search
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
retried. History suggests a crop when a field has no answer yet, but never replaces an answer
the farmer has entered.

Local browser verification at 1440 x 900 and 390 x 844 checked selection, removal,
field location, and consecutive numbering. With history deliberately delayed, opening
crop confirmation took 27 ms in one local run; this measures the screen transition,
not provider latency. A simulated provider failure and successful real-data retry
preserved the crop and planting date entered while waiting.

Run acquisition queue and navigation checks with:

```sh
node --test tests/cropHistoryCache.test.ts tests/mapNavigation.test.ts
```

## Field assistant

Ask a question opens the assistant: a side panel on wide screens, full screen on
phones. It streams answers from the Java API's `POST /chat/stream` and sends what
is on screen as context: the location, the selected fields as "Field 1", "Field 2"
and so on, and only crops the farmer confirmed. A line at the top of the panel says
what the assistant can see. While it works, a status line says which data it is
checking, and each reply lists its lookups, with any that failed. Rotation plans it
proposes appear as a five-year list. Nothing is saved; the conversation lasts until
the page is reloaded, and Start over can be undone.

The panel is a modal dialog, so focus stays inside and Escape closes it. Screen
readers hear progress and the finished answer once, not each streamed word. Enter
sends on a keyboard; on touch screens the Send button does.

Places with no address, such as the example area or Use my current location, are
named after the nearest city on a short Ontario list.

In one local run, the first words of an answer arrived in 3 to 7 seconds. A field
question that ended with a rotation plan took 53 to 100 seconds, mostly in the
satellite, weather and planner lookups.

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
# Field season pictures

The crop confirmation step shows the selected field through its latest growing
season, as NASA HLS (Landsat and Sentinel-2, 30 m) saw it. `FieldSeason` polls
`GET /api/fields/{fieldId}/season?year=YYYY&pixels=true&since=N` every 1.5 s
while the acquisition runs. Each poll returns every daily point with its quality
and greenness, but display pixels only for observations after `since`; the
component keeps earlier pictures by `sceneId` and sends the last
`observationCount` as the next `since`. A whole season takes about a minute the
first time; the first picture usually appears within ten seconds, and pictures
fill in across the year as they arrive.

Pictures are drawn at one block per 30 m square, never smoothed. White stripes
mark cloud or shadow over the field, and the outline follows the squares counted
as the field. The timeline places every satellite pass on a true date scale;
the greenness line joins only clear days and breaks across 20-day gaps. The view
opens on the greenest day, and sentences describe what was measured without
diagnosing causes.

Run season checks with `node --test tests/fieldSeason.test.ts`.

## Local Java planning demo

The results page sends confirmed field IDs, their Polygon or MultiPolygon geometry,
current crops and planting dates to Java's `POST /crop-optimization`. It first loads
`GET /crops` and uses the full catalog as the demo's possible crop choices. This
assumption is disclosed on the page; it does not establish field suitability.
Pasture, unknown answers, nothing planted and custom crop names are preserved by the random
demo. The frontend does not require the current crop to belong to the future-crop catalog.

For a local Java backend, create `.env.local` with:

```dotenv
API_URL=http://127.0.0.1:8094
```

Start Java from `../SpaceApps2026-Backend` with the random planner explicitly selected:

```sh
./mvnw spring-boot:run -Dspring-boot.run.arguments='--server.port=8094 --crop.planner.strategy=random --data.backend.url=http://127.0.0.1:8091'
```

This assumes the Python data service is running on port 8091 for fields and history.
Then run `npm run dev -- --host 127.0.0.1 --port 5175`. The random plan itself needs
no Python calls. The Java project targets JDK 27; local verification used the installed
JDK 26 with `-Djava.version=26`, without changing the project's configured version.

Results show three distinct five-year rotations per field from the Java response. Each has
a sequence summary, example benefits, tradeoffs and expandable year-by-year explanations.
These explanations are illustrative demo content, not field analysis. Results keep crop answers when
returning to the form, and provide retry after a request failure. Random responses
keep the loading sentence visible for at least four seconds in total; leaving the
page cancels the request and reveal timer. Returning to results requests a new plan.

Browser verification used real local Java responses at 1440 x 900 and 390 x 844.
The successful planning HTTP call took 9 ms in one warm run; the deliberate loading
state made the plan visible after 4.36 seconds. An injected HTTP 503 showed the error
state; retry used the live endpoint and displayed exactly its returned crops. Subsequent verification covered pasture confirmation
and three distinct alternatives with explanations.
The mobile document measured 390 px wide, with no horizontal overflow. Screenshots
are in the parent workspace's `output/playwright/`. The results page reuses the
existing application tokens in `src/styles/tokens.css`; no new design system or
licensed assets were introduced.

Run the frontend checks with `npm run build`, `npm run lint` and
`node --test tests/*.test.ts`.

Pasture regression verification selected Pasture in the actual confirmation form,
confirmed it without submitting, then requested results from local Java. The
response kept `currentCrop: Pasture` and displayed three distinct crop sequences
after 4.37 seconds. Desktop and mobile layouts fit their viewport widths.
