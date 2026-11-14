import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { basemapStyle } from './basemap'
import 'maplibre-gl/dist/maplibre-gl.css'
import './Map.css'

type Field = Feature<Polygon | MultiPolygon, { id: string }>
type LoadState = { kind: 'loading' | 'ready' | 'error'; message: string }

const protocol = new Protocol()
maplibregl.addProtocol('pmtiles', protocol.tile)

function boundsOf(fields: Field[]) {
  const bounds = new maplibregl.LngLatBounds()
  for (const field of fields) {
    const polygons = field.geometry.type === 'Polygon' ? [field.geometry.coordinates] : field.geometry.coordinates
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (const point of ring) bounds.extend([point[0], point[1]])
      }
    }
  }
  return bounds
}

export default function Map() {
  const ref = useRef<HTMLDivElement>(null)
  const selectFieldRef = useRef<(id: string) => void>(() => {})
  const [attempt, setAttempt] = useState(0)
  const [fields, setFields] = useState<Field[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [basemapError, setBasemapError] = useState(false)
  const [status, setStatus] = useState<LoadState>({ kind: 'loading', message: 'Loading field outlines...' })

  useEffect(() => {
    const controller = new AbortController()
    let acreageController: AbortController | undefined
    let popup: maplibregl.Popup | undefined
    const map = new maplibregl.Map({
      container: ref.current!, style: basemapStyle(), center: [-91.93, 41.37], zoom: 13,
      maxZoom: 18, renderWorldCopies: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(ref.current!)
    map.on('error', event => {
      if ('sourceId' in event && event.sourceId === 'basemap') setBasemapError(true)
    })

    async function loadFields() {
      try {
        const response = await fetch('/api/fields', { signal: controller.signal })
        if (!response.ok) throw new Error(`Field API returned ${response.status}`)
        const data: FeatureCollection<Polygon | MultiPolygon, { id: string }> = await response.json()
        if (controller.signal.aborted) return
        if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
          throw new Error('The field API did not return a GeoJSON FeatureCollection')
        }
        map.addSource('fields', { type: 'geojson', data, attribution: 'USDA NASS Crop Sequence Boundaries' })
        map.addLayer({
          id: 'field-fill', type: 'fill', source: 'fields',
          paint: { 'fill-color': '#c9c7ae', 'fill-opacity': 0.55 },
        }, 'places')
        map.addLayer({
          id: 'field-outline', type: 'line', source: 'fields',
          paint: { 'line-color': '#878b68', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 1.6] },
        }, 'places')
        map.addLayer({
          id: 'field-selected', type: 'fill', source: 'fields', filter: ['==', ['get', 'id'], ''],
          paint: { 'fill-color': '#ad643c', 'fill-opacity': 0.35 },
        }, 'places')
        map.addLayer({
          id: 'field-selected-outline', type: 'line', source: 'fields', filter: ['==', ['get', 'id'], ''],
          paint: { 'line-color': '#8c4528', 'line-width': 3 },
        }, 'places')

        async function selectField(field: Field, location: maplibregl.LngLatLike) {
          acreageController?.abort()
          acreageController = new AbortController()
          const signal = acreageController.signal
          const id = String(field.id ?? field.properties.id)
          setSelectedId(id)
          map.setFilter('field-selected', ['==', ['get', 'id'], id])
          map.setFilter('field-selected-outline', ['==', ['get', 'id'], id])
          popup?.remove()
          const content = document.createElement('div')
          const title = document.createElement('strong')
          title.textContent = `Field ${id}`
          const detail = document.createElement('p')
          detail.setAttribute('role', 'status')
          detail.textContent = 'Loading acreage...'
          content.append(title, detail)
          popup = new maplibregl.Popup({ maxWidth: '300px' }).setLngLat(location).setDOMContent(content).addTo(map)
          try {
            const result = await fetch(`/api/fields/${encodeURIComponent(id)}`, { signal })
            if (!result.ok) throw new Error(`Acreage API returned ${result.status}`)
            const area: { acres: number; hectares: number } = await result.json()
            if (signal.aborted) return
            detail.textContent = `${area.acres.toLocaleString()} acres (${area.hectares.toLocaleString()} hectares), estimated`
          } catch {
            if (!signal.aborted) detail.textContent = 'Acreage is unavailable. Select the field again to retry.'
          }
        }

        selectFieldRef.current = id => {
          const field = data.features.find(item => String(item.id ?? item.properties.id) === id)
          if (!field) return
          const bounds = boundsOf([field])
          map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 450, essential: false })
          void selectField(field, bounds.getCenter())
        }
        map.on('click', 'field-fill', event => {
          const id = String(event.features?.[0]?.properties.id)
          const field = data.features.find(item => String(item.id ?? item.properties.id) === id)
          if (field) void selectField(field, event.lngLat)
        })
        map.on('mouseenter', 'field-fill', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'field-fill', () => { map.getCanvas().style.cursor = '' })
        const bounds = boundsOf(data.features)
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 })
        setFields(data.features)
        setStatus({
          kind: 'ready',
          message: data.features.length
            ? `${data.features.length} field outlines loaded. Select a field to see its estimated acreage.`
            : 'No field outlines are available in the configured dataset.',
        })
      } catch {
        if (!controller.signal.aborted) {
          setStatus({ kind: 'error', message: 'Could not load field outlines. Check that the data API is running on port 8000.' })
        }
      }
    }
    map.on('style.load', () => { void loadFields() })

    return () => {
      controller.abort()
      acreageController?.abort()
      selectFieldRef.current = () => {}
      resizeObserver.disconnect()
      popup?.remove()
      map.remove()
    }
  }, [attempt])

  return (
    <section className="field-map" aria-label="Field selection map">
      <div className="field-map-status">
        <p role="status" aria-live="polite">{status.message}</p>
        {status.kind === 'error' && (
          <button type="button" onClick={() => {
            setStatus({ kind: 'loading', message: 'Loading field outlines...' })
            setBasemapError(false)
            setFields([])
            setSelectedId('')
            setAttempt(value => value + 1)
          }}>Retry</button>
        )}
        {fields.length > 0 && (
          <label className="field-map-select">Field
            <select value={selectedId} onChange={event => selectFieldRef.current(event.target.value)}>
              <option value="" disabled>Select on map or choose here</option>
              {fields.map(field => {
                const id = String(field.id ?? field.properties.id)
                return <option key={id} value={id}>{id}</option>
              })}
            </select>
          </label>
        )}
      </div>
      {basemapError && <p className="field-map-warning" role="alert">The background map could not load. Check that /maps/basemap.pmtiles is available.</p>}
      <div ref={ref} className="field-map-canvas" />
    </section>
  )
}
