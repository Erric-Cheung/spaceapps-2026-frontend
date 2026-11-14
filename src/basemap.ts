import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import type { Theme } from './theme'

// Muted layers for the Protomaps v4 schema: no POIs or buildings, hairline roads.
function basemapLayers(source: string, t: Theme): LayerSpecification[] {
  const s = { source }
  const name: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name']]
  return [
    { id: 'bm-earth', type: 'fill', ...s, 'source-layer': 'earth', paint: { 'fill-color': t.paper } },
    {
      id: 'bm-green', type: 'fill', ...s, 'source-layer': 'landuse',
      filter: ['in', ['get', 'kind'], ['literal', ['park', 'forest', 'wood', 'nature_reserve', 'national_park', 'protected_area', 'golf_course', 'cemetery']]],
      paint: { 'fill-color': t.green, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0, 9, 1] },
    },
    {
      id: 'bm-urban', type: 'fill', ...s, 'source-layer': 'landuse', minzoom: 9,
      filter: ['in', ['get', 'kind'], ['literal', ['residential', 'commercial', 'industrial', 'retail', 'railway', 'military', 'school', 'university', 'hospital']]],
      paint: { 'fill-color': t.urban },
    },
    { id: 'bm-water', type: 'fill', ...s, 'source-layer': 'water', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': t.water } },
    {
      id: 'bm-river', type: 'line', ...s, 'source-layer': 'water', minzoom: 9, filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': t.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 14, 2.4] },
    },
    {
      id: 'bm-boundary-region', type: 'line', ...s, 'source-layer': 'boundaries', filter: ['==', ['get', 'kind'], 'region'],
      paint: { 'line-color': t.faint, 'line-width': 0.7, 'line-dasharray': [3, 2] },
    },
    {
      id: 'bm-boundary-country', type: 'line', ...s, 'source-layer': 'boundaries', filter: ['==', ['get', 'kind'], 'country'],
      paint: { 'line-color': t.muted, 'line-width': 0.9 },
    },
    {
      id: 'bm-road-minor', type: 'line', ...s, 'source-layer': 'roads', minzoom: 11,
      filter: ['in', ['get', 'kind'], ['literal', ['minor_road', 'other']]],
      paint: { 'line-color': t.grid, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 15, 1.6] },
    },
    {
      id: 'bm-road-major', type: 'line', ...s, 'source-layer': 'roads', minzoom: 7, filter: ['==', ['get', 'kind'], 'major_road'],
      paint: { 'line-color': t.faint, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.3, 14, 1.8] },
    },
    {
      id: 'bm-road-highway', type: 'line', ...s, 'source-layer': 'roads', filter: ['==', ['get', 'kind'], 'highway'],
      paint: { 'line-color': t.muted, 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 14, 2.2] },
    },
    {
      id: 'bm-label-region', type: 'symbol', ...s, 'source-layer': 'places', minzoom: 4, maxzoom: 8,
      filter: ['==', ['get', 'kind'], 'region'],
      layout: {
        'text-field': ['upcase', name], 'text-font': t.font.medium, 'text-size': 10.5 * t.textScale,
        'text-letter-spacing': 0.18, 'text-max-width': 8,
      },
      paint: { 'text-color': t.faint, 'text-halo-color': t.paper, 'text-halo-width': 1 },
    },
    {
      id: 'bm-label-place', type: 'symbol', ...s, 'source-layer': 'places', minzoom: 6,
      filter: ['in', ['get', 'kind'], ['literal', ['locality', 'neighbourhood', 'macrohood']]],
      layout: {
        'text-field': name, 'text-font': t.font.medium,
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10 * t.textScale, 14, ['case', ['>', ['coalesce', ['get', 'population_rank'], 0], 8], 15 * t.textScale, 12.5 * t.textScale]],
        'text-letter-spacing': 0.04, 'text-max-width': 8, 'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'population_rank'], 0]],
        'text-padding': 6,
      },
      paint: { 'text-color': t.ink, 'text-opacity': 0.72, 'text-halo-color': t.paper, 'text-halo-width': 1.4 },
    },
  ]
}

/** Area covered by public/maps/basemap.pmtiles (west, south, east, north). */
export const BASEMAP_BOUNDS: [number, number, number, number] = [-83.2, 41.6, -74.3, 48.0]

export function basemapStyle(t: Theme): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'vector',
        url: `pmtiles://${new URL('/maps/basemap.pmtiles', window.location.href).href}`,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>',
      },
    },
    layers: [
      { id: 'bm-background', type: 'background', paint: { 'background-color': t.water } },
      ...basemapLayers('basemap', t),
    ],
  }
}
