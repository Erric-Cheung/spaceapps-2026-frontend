import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
import { RotateCcw } from 'lucide-react'
import maplibregl, { type ExpressionSpecification, type GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import AddressSearch from './AddressSearch'
import { basemapStyle } from '../lib/basemap'
import type { GeoLocation, Place } from '../data/geocode'
import { fetchFields, type BBox, type FieldFeature } from '../data/fields'
import { labelPoint } from '../lib/labelPoint'
import { constrainMapCenter } from '../lib/mapNavigation'
import { createFieldReveal, ENTERING_FIELDS, ENTERING_LAYERS } from '../lib/fieldReveal'
import { theme as t, themeCssVars } from '../lib/theme'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../styles/Map.css'

// Click a field to toggle it, shift-drag to box-select. Badges number fields in selection order.
// Fields load from the API for the visible area once zoomed in to FIELD_MINZOOM.

const FIELDS = 'fields'
const NUMBERS = 'field-numbers'
const FIELD_MINZOOM = 12
const MIN_ZOOM = 10 // don't zoom out to the whole country; the search bar gets you around
const START = { center: [-79.52, 44.58] as [number, number], zoom: 12 } // just west of Orillia, Ontario
const LAYER = { fill: 'field-fill', line: 'field-line', hover: 'field-hover', halo: 'field-selected-halo', sel: 'field-selected', num: 'field-num', numText: 'field-num-text' }

const sel: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false]
const hov: ExpressionSpecification = ['any', ['boolean', ['feature-state', 'hover'], false], ['boolean', ['feature-state', 'inspect'], false]]
const contains = (outer: BBox, inner: BBox) => outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3]

// Addresses get a pin at street level; towns and roads are framed by their extent.
function showPlace(map: maplibregl.Map, place: Place, pinRef: RefObject<maplibregl.Marker | null>, duration: number) {
  pinRef.current?.remove()
  pinRef.current = null
  // Never land zoomed out past FIELD_MINZOOM, or no fields would load.
  const fitted = place.bbox && place.kind !== 'address' ? map.cameraForBounds(place.bbox, { padding: 40, maxZoom: 15 }) : undefined
  map.flyTo({
    center: fitted?.center ?? place.center,
    zoom: place.kind === 'address' ? 16 : Math.max(fitted?.zoom ?? 14, FIELD_MINZOOM),
    duration,
  })
  if (place.kind === 'address') {
    const el = document.createElement('div')
    el.className = 'address-pin'
    pinRef.current = new maplibregl.Marker({ element: el }).setLngLat(place.center).addTo(map)
  }
}

/** Selection controls shared with the field list. */
export type FieldMapHandle = {
  removeField: (id: string) => void
  focusField: (field: FieldFeature) => void
  highlightField: (id: string | null) => void
}

type Props = {
  ref?: Ref<FieldMapHandle>
  onHoverField?: (id: string | null) => void
  onChange?: (fields: FieldFeature[]) => void
  location?: GeoLocation
  children?: ReactNode
}
type Status = 'idle' | 'zoom' | 'loading' | 'error'

export default function Map({ ref: controlRef, onChange, onHoverField, location, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onHoverRef = useRef(onHoverField)
  const controls = useRef<FieldMapHandle>({ removeField: () => {}, focusField: () => {}, highlightField: () => {} })
  useImperativeHandle(controlRef, () => ({
    removeField: id => controls.current.removeField(id),
    focusField: field => controls.current.focusField(field),
    highlightField: id => controls.current.highlightField(id),
  }), [])
  const retryRef = useRef(() => {})
  const mapRef = useRef<maplibregl.Map | null>(null)
  const pinRef = useRef<maplibregl.Marker | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => { onChangeRef.current = onChange; onHoverRef.current = onHoverField })

  useEffect(() => {
    const container = ref.current!
    const selected = new globalThis.Map<string, FieldFeature>()
    const byId = new globalThis.Map<string, FieldFeature>()
    const loaded: BBox[] = []
    let inspectedId: string | null = null
    let request: AbortController | undefined
    let hoverId: string | null = null
    let reveal: ReturnType<typeof createFieldReveal> | undefined
    let disposed = false

    for (const [k, v] of Object.entries(themeCssVars(t))) container.style.setProperty(k, v)

    const start = location
      ? { center: [location.lng, location.lat] as [number, number], zoom: 13 }
      : START
    const map = new maplibregl.Map({
      container, style: basemapStyle(t), ...start, center: constrainMapCenter(start.center), minZoom: MIN_ZOOM, maxZoom: 17,
      transformCameraUpdate: ({ center }) => ({ center: new maplibregl.LngLat(...constrainMapCenter([center.lng, center.lat])) }),
      attributionControl: { compact: true, customAttribution: 'Search: <a href="https://photon.komoot.io">Photon</a> | <a href="https://www.geoboundaries.org/">geoBoundaries</a>' }, dragRotate: false, pitchWithRotate: false,
      boxZoom: false, // shift-drag is box *select* here
      fadeDuration: 0, renderWorldCopies: false,
    })
    mapRef.current = map
    if (location?.place) showPlace(map, location.place, pinRef, 0)
    // Compact attribution opens expanded and covers the bottom of a phone-sized map; start it collapsed.
    map.once('load', () => container.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show'))
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(container)

    let resolveLayers: () => void
    const layersReady = new Promise<void>(resolve => { resolveLayers = resolve })
    const ready = () => !!map.getLayer(LAYER.fill)
    const state = (id: string, s: Record<string, boolean>) => {
      if (!ready()) return
      map.setFeatureState({ source: FIELDS, id }, s)
      map.setFeatureState({ source: ENTERING_FIELDS, id }, s)
    }
    const numberPoints = (): FeatureCollection<Point> => ({
      type: 'FeatureCollection',
      features: [...selected.values()].map(f => ({
        type: 'Feature', properties: { n: f.properties.selectionNumber, id: f.properties.id }, geometry: { type: 'Point', coordinates: labelPoint(f.geometry) },
      })),
    })
    const emitChange = () => {
      let number = 1
      for (const [id, field] of selected) {
        selected.set(id, { ...field, properties: { ...field.properties, selectionNumber: number++ } })
      }
      (map.getSource(NUMBERS) as GeoJSONSource | undefined)?.setData(numberPoints())
      onChangeRef.current?.([...selected.values()])
    }
    const select = (id: string) => {
      const f = byId.get(id)
      if (!f || selected.has(id)) return
      selected.set(id, { ...f, properties: { ...f.properties, selectionNumber: selected.size + 1 } })
      state(id, { selected: true })
    }
    const toggle = (id: string) => {
      if (selected.has(id)) { selected.delete(id); state(id, { selected: false }) } else select(id)
      emitChange()
    }

    controls.current = {
      removeField: id => {
        if (!selected.has(id)) return
        selected.delete(id)
        state(id, { selected: false, inspect: false })
        emitChange()
        onHoverRef.current?.(null)
      },
      focusField: field => {
        const polygons = field.geometry.type === 'Polygon' ? [field.geometry.coordinates] : field.geometry.coordinates
        const bounds = new maplibregl.LngLatBounds()
        for (const polygon of polygons) for (const ring of polygon) for (const point of ring) bounds.extend([point[0], point[1]])
        const small = container.clientWidth < 600
        map.fitBounds(bounds, { padding: { top: 90, bottom: 55, left: small ? 35 : 65, right: small ? 35 : 65 }, maxZoom: 16, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500 })
      },
      highlightField: id => {
        if (inspectedId) state(inspectedId, { inspect: false })
        inspectedId = id
        if (id) state(id, { inspect: true })
      },
    }

    function addLayers() {
      // tolerance 0: no simplification, so neighbouring outlines don't cross at lower zooms
      map.addSource(FIELDS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id', tolerance: 0,
        attribution: 'Fields: Fields of the World 2025 (CC-BY-4.0)' })
      map.addSource(ENTERING_FIELDS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id', tolerance: 0 })
      map.addSource(NUMBERS, { type: 'geojson', data: numberPoints() })
      const addFieldLayers = (source: string, ids: Pick<typeof LAYER, 'fill' | 'line' | 'hover' | 'halo' | 'sel'>, entering = false) => {
        const s = { source, minzoom: FIELD_MINZOOM }
        map.addLayer({ id: ids.fill, type: 'fill', ...s, paint: {
          'fill-color': ['case', sel, t.hero, t.field],
          'fill-opacity': entering ? 0 : ['case', sel, 0.95, hov, 1, 0.85],
        } })
        map.addLayer({ id: ids.line, type: 'line', ...s, paint: {
          'line-color': t.fieldLine, 'line-width': ['interpolate', ['linear'], ['zoom'], FIELD_MINZOOM, 0.5, 16, 1.4],
          'line-opacity': entering ? 0 : 1,
        } })
        map.addLayer({ id: ids.hover, type: 'line', ...s, paint: {
          'line-color': t.ink, 'line-width': 1.2, 'line-opacity': ['case', hov, 0.9, 0],
        } })
        map.addLayer({ id: ids.halo, type: 'line', ...s, paint: {
          'line-color': t.paper, 'line-width': 4, 'line-opacity': ['case', sel, 0.95, 0],
        } })
        map.addLayer({ id: ids.sel, type: 'line', ...s, paint: {
          'line-color': t.ink, 'line-width': ['case', hov, 4, 2], 'line-opacity': ['case', sel, 1, 0],
        } })
      }
      addFieldLayers(FIELDS, LAYER)
      addFieldLayers(ENTERING_FIELDS, ENTERING_LAYERS, true)
      map.addLayer({ id: LAYER.num, type: 'circle', source: NUMBERS, minzoom: FIELD_MINZOOM, paint: {
        'circle-radius': 13 * t.textScale, 'circle-color': t.ink, 'circle-stroke-color': t.paper, 'circle-stroke-width': 2,
      } })
      map.addLayer({ id: LAYER.numText, type: 'symbol', source: NUMBERS, minzoom: FIELD_MINZOOM,
        layout: { 'text-field': ['to-string', ['get', 'n']], 'text-font': t.font.bold, 'text-size': 14 * t.textScale, 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': t.paper },
      })
      reveal = createFieldReveal(map, FIELDS)
      resolveLayers()
    }

    // Fetch the visible area unless an earlier request already covered it. Fields accumulate,
    // so panning back is instant and selections stay valid.
    async function loadView() {
      if (disposed) return
      if (map.getZoom() < FIELD_MINZOOM) { request?.abort(); setStatus('zoom'); return }
      const b = map.getBounds()
      const bbox: BBox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
      if (loaded.some(l => contains(l, bbox))) { setStatus('idle'); return }
      request?.abort()
      const controller = new AbortController()
      request = controller
      setStatus('loading')
      // Draw each page as it arrives instead of waiting for the whole area.
      const show = (features: FieldFeature[]) => {
        void layersReady.then(() => {
          if (controller.signal.aborted || disposed) return
          const fresh = features.filter(f => !byId.has(String(f.properties.id)))
          for (const f of fresh) byId.set(String(f.properties.id), f)
          reveal?.add(fresh)
        })
      }
      try {
        await fetchFields(bbox, controller.signal, show)
        await layersReady
        if (controller.signal.aborted || disposed) return
        loaded.push(bbox)
        setStatus('idle')
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    }
    retryRef.current = () => { void loadView() }

    map.once('style.load', addLayers)
    map.on('moveend', () => { void loadView() })
    // Fetch fields alongside the basemap style/tiles, without blocking either.
    void loadView()

    const pick = (p: maplibregl.PointLike) => (ready() ? map.queryRenderedFeatures(p, { layers: [LAYER.fill, ENTERING_LAYERS.fill] })[0] : undefined)

    map.on('click', e => {
      const f = pick(e.point)
      if (f) toggle(String(f.properties.id))
    })
    map.on('mousemove', e => {
      const f = pick(e.point)
      const id = f ? String(f.properties.id) : null
      if (id === hoverId) return
      if (hoverId) state(hoverId, { hover: false })
      hoverId = id
      onHoverRef.current?.(id)
      if (id) state(id, { hover: true })
      map.getCanvas().style.cursor = id ? 'pointer' : ''
    })
    map.on('mouseout', () => {
      if (hoverId) state(hoverId, { hover: false })
      hoverId = null
      onHoverRef.current?.(null)
    })

    // Shift-drag: select every field inside the box.
    const canvas = map.getCanvasContainer()
    const onMouseDown = (e: MouseEvent) => {
      if (!e.shiftKey || e.button !== 0 || map.getZoom() < FIELD_MINZOOM) return
      e.preventDefault()
      map.dragPan.disable()
      const r = canvas.getBoundingClientRect()
      const start = new maplibregl.Point(e.clientX - r.left, e.clientY - r.top)
      const el = document.createElement('div')
      el.className = 'fp-box'
      canvas.appendChild(el)
      const move = (ev: MouseEvent) => {
        const p = new maplibregl.Point(ev.clientX - r.left, ev.clientY - r.top)
        Object.assign(el.style, {
          left: `${Math.min(start.x, p.x)}px`, top: `${Math.min(start.y, p.y)}px`,
          width: `${Math.abs(p.x - start.x)}px`, height: `${Math.abs(p.y - start.y)}px`,
        })
      }
      const up = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        map.dragPan.enable()
        el.remove()
        const p = new maplibregl.Point(ev.clientX - r.left, ev.clientY - r.top)
        if (Math.abs(p.x - start.x) < 4 && Math.abs(p.y - start.y) < 4) return
        if (!ready()) return
        for (const f of map.queryRenderedFeatures([start, p], { layers: [LAYER.fill, ENTERING_LAYERS.fill] })) select(String(f.properties.id))
        emitChange()
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }
    canvas.addEventListener('mousedown', onMouseDown)

    return () => {
      disposed = true
      request?.abort()
      resolveLayers()
      reveal?.destroy()
      retryRef.current = () => {}
      controls.current = { removeField: () => {}, focusField: () => {}, highlightField: () => {} }
      canvas.removeEventListener('mousedown', onMouseDown)
      resizeObserver.disconnect()
      mapRef.current = null
      pinRef.current = null
      map.remove()
    }
  }, [location])

  const goTo = (place: Place) => { if (mapRef.current) showPlace(mapRef.current, place, pinRef, 1200) }
  const mapCenter = (): [number, number] => {
    const c = mapRef.current?.getCenter()
    return c ? [c.lng, c.lat] : START.center
  }

  return (
    <section className="field-map" aria-label="Field selection map">
      <div ref={ref} className="field-map-canvas fp-root" />
      <AddressSearch near={mapCenter} onPick={goTo} initialQuery={location?.label} />
      {children}
      {status === 'loading' && <div className="field-map-progress" aria-hidden="true" />}
      <p className="sr-only" role="status">{status === 'loading' ? 'Loading fields' : status === 'zoom' ? 'Zoom in to see fields.' : ''}</p>
      {(status === 'zoom' || status === 'error') && (
        <div className="field-map-status" role={status === 'error' ? 'alert' : undefined}>
          {status === 'zoom' && <p>Zoom in to see fields.</p>}
          {status === 'error' && (
            <>
              <p>Could not load fields.</p>
              <button type="button" className="button-primary" onClick={() => retryRef.current()}><RotateCcw size={16} aria-hidden="true" />Try again</button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
