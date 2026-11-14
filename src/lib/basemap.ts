import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import type { Theme } from './theme'

// Hosted OpenMapTiles vector tiles: free, no API key, worldwide. Only the visible tiles download.
const TILES = 'https://tiles.openfreemap.org/planet'
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'

// Muted layers: no POIs or buildings, hairline roads.
function basemapLayers(source: string, t: Theme): LayerSpecification[] {
  const s = { source }
  const name: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name']]
  const line: ExpressionSpecification = ['==', ['geometry-type'], 'LineString']
  return [
    { id: 'bm-background', type: 'background', paint: { 'background-color': t.paper } },
    {
      id: 'bm-wood', type: 'fill', ...s, 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-color': t.green, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0, 9, 1] },
    },
    { id: 'bm-park', type: 'fill', ...s, 'source-layer': 'park', paint: { 'fill-color': t.green } },
    {
      id: 'bm-urban', type: 'fill', ...s, 'source-layer': 'landuse', minzoom: 9,
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'retail', 'railway', 'military', 'school', 'university', 'hospital']]],
      paint: { 'fill-color': t.urban },
    },
    { id: 'bm-water', type: 'fill', ...s, 'source-layer': 'water', paint: { 'fill-color': t.water } },
    {
      id: 'bm-river', type: 'line', ...s, 'source-layer': 'waterway', minzoom: 9,
      paint: { 'line-color': t.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 14, 2.4] },
    },
    {
      id: 'bm-boundary-region', type: 'line', ...s, 'source-layer': 'boundary', minzoom: 5,
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': t.faint, 'line-width': 0.7, 'line-dasharray': [3, 2] },
    },
    {
      id: 'bm-boundary-country', type: 'line', ...s, 'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': t.muted, 'line-width': 0.9 },
    },
    {
      id: 'bm-road-minor', type: 'line', ...s, 'source-layer': 'transportation', minzoom: 11,
      filter: ['all', line, ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track']]]],
      paint: { 'line-color': t.grid, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 15, 1.6] },
    },
    {
      id: 'bm-road-major', type: 'line', ...s, 'source-layer': 'transportation', minzoom: 7,
      filter: ['all', line, ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'tertiary']]]],
      paint: { 'line-color': t.faint, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.3, 14, 1.8] },
    },
    {
      id: 'bm-road-highway', type: 'line', ...s, 'source-layer': 'transportation',
      filter: ['all', line, ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]]],
      paint: { 'line-color': t.muted, 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 14, 2.2] },
    },
    {
      id: 'bm-label-region', type: 'symbol', ...s, 'source-layer': 'place', minzoom: 4, maxzoom: 8,
      filter: ['==', ['get', 'class'], 'state'],
      layout: {
        'text-field': ['upcase', name], 'text-font': t.font.regular, 'text-size': 10.5 * t.textScale,
        'text-letter-spacing': 0.18, 'text-max-width': 8,
      },
      paint: { 'text-color': t.faint, 'text-halo-color': t.paper, 'text-halo-width': 1 },
    },
    {
      id: 'bm-label-place', type: 'symbol', ...s, 'source-layer': 'place', minzoom: 6,
      filter: ['any',
        ['in', ['get', 'class'], ['literal', ['city', 'town']]],
        ['all', ['==', ['get', 'class'], 'village'], ['>=', ['zoom'], 10]],
        ['all', ['==', ['get', 'class'], 'hamlet'], ['>=', ['zoom'], 12]]],
      layout: {
        'text-field': name, 'text-font': t.font.regular,
        'text-size': ['match', ['get', 'class'], 'city', 15 * t.textScale, 'town', 13 * t.textScale, 12 * t.textScale],
        'text-letter-spacing': 0.04, 'text-max-width': 8, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
        'text-padding': 6,
      },
      paint: { 'text-color': t.ink, 'text-opacity': 0.72, 'text-halo-color': t.paper, 'text-halo-width': 1.4 },
    },
  ]
}

export function basemapStyle(t: Theme): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: { basemap: { type: 'vector', url: TILES } },
    layers: basemapLayers('basemap', t),
  }
}
