import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

// Protomaps v4 layers, adapted from Documents/fieldpicker/src/basemap.ts.
// These colors are local to this app; no Fieldpicker theme tokens are required.
const colors = {
  paper: '#f3f1e8', water: '#d5ded9', green: '#e2e7d8', urban: '#e8e4dc',
  road: '#d0c9bb', majorRoad: '#a89c86', ink: '#514b40',
}

const layers: LayerSpecification[] = [
  { id: 'background', type: 'background', paint: { 'background-color': colors.water } },
  { id: 'land', type: 'fill', source: 'basemap', 'source-layer': 'earth', paint: { 'fill-color': colors.paper } },
  {
    id: 'green', type: 'fill', source: 'basemap', 'source-layer': 'landuse',
    filter: ['in', ['get', 'kind'], ['literal', ['park', 'forest', 'wood', 'nature_reserve', 'national_park', 'protected_area', 'golf_course', 'cemetery']]],
    paint: { 'fill-color': colors.green },
  },
  {
    id: 'urban', type: 'fill', source: 'basemap', 'source-layer': 'landuse', minzoom: 9,
    filter: ['in', ['get', 'kind'], ['literal', ['residential', 'commercial', 'industrial', 'retail', 'school', 'university', 'hospital']]],
    paint: { 'fill-color': colors.urban },
  },
  {
    id: 'water', type: 'fill', source: 'basemap', 'source-layer': 'water',
    filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': colors.water },
  },
  {
    id: 'rivers', type: 'line', source: 'basemap', 'source-layer': 'water', minzoom: 9,
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': colors.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 15, 2.5] },
  },
  {
    id: 'boundaries', type: 'line', source: 'basemap', 'source-layer': 'boundaries',
    paint: { 'line-color': colors.road, 'line-width': 0.8, 'line-dasharray': [3, 2] },
  },
  {
    id: 'minor-roads', type: 'line', source: 'basemap', 'source-layer': 'roads', minzoom: 11,
    filter: ['in', ['get', 'kind'], ['literal', ['minor_road', 'other']]],
    paint: { 'line-color': colors.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 16, 2] },
  },
  {
    id: 'major-roads', type: 'line', source: 'basemap', 'source-layer': 'roads',
    filter: ['in', ['get', 'kind'], ['literal', ['major_road', 'highway']]],
    paint: { 'line-color': colors.majorRoad, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 15, 2.2], 'line-opacity': 0.75 },
  },
  {
    id: 'places', type: 'symbol', source: 'basemap', 'source-layer': 'places', minzoom: 6,
    filter: ['in', ['get', 'kind'], ['literal', ['locality', 'neighbourhood', 'macrohood']]],
    layout: {
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': ['Noto Sans Medium'], 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 14, 13],
      'text-letter-spacing': 0.04, 'text-max-width': 8, 'text-padding': 6,
    },
    paint: { 'text-color': colors.ink, 'text-halo-color': colors.paper, 'text-halo-width': 1.5 },
  },
]

export function basemapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'vector',
        url: `pmtiles://${new URL('/maps/basemap.pmtiles', window.location.href).href}`,
        attribution: '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | <a href="https://protomaps.com">Protomaps</a>',
      },
    },
    layers,
  }
}
