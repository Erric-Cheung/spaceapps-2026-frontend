import { useEffect, useRef, useState } from 'react'
import maplibregl, { type ExpressionSpecification, type GeoJSONSource } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import type { FeatureCollection, Point } from 'geojson'
import { basemapStyle, BASEMAP_BOUNDS } from './basemap'
import { fetchFields, type BBox, type FieldFeature } from './data/fields'
import { labelPoint } from './labelPoint'
import { theme as t, themeCssVars } from './theme'
import 'maplibre-gl/dist/maplibre-gl.css'
import './Map.css'

// Click a field to toggle it, shift-drag to box-select. Badges number fields in selection order.
// Fields load from the API for the visible area once zoomed in to FIELD_MINZOOM.

const FIELDS = 'fields'
const NUMBERS = 'field-numbers'
const FIELD_MINZOOM = 12
const START = { center: [-79.52, 44.58] as [number, number], zoom: 12 } // just west of Orillia, Ontario
const LAYER = { fill: 'field-fill', line: 'field-line', hover: 'field-hover', halo: 'field-selected-halo', sel: 'field-selected', num: 'field-num', numText: 'field-num-text' }

maplibregl.addProtocol('pmtiles', new Protocol({ metadata: true }).tile)

const sel: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false]
const hov: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false]
const contains = (outer: BBox, inner: BBox) => outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3]

type Props = { onChange?: (fields: FieldFeature[]) => void }
type Status = 'idle' | 'zoom' | 'loading' | 'error'

export default function Map({ onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const retryRef = useRef(() => {})
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => { onChangeRef.current = onChange })

  useEffect(() => {
    const container = ref.current!
    const selected = new globalThis.Map<string, FieldFeature>()
    const byId = new globalThis.Map<string, FieldFeature>()
    const loaded: BBox[] = []
    let request: AbortController | undefined
    let hoverId: string | null = null

    for (const [k, v] of Object.entries(themeCssVars(t))) container.style.setProperty(k, v)

    const map = new maplibregl.Map({
      container, style: basemapStyle(t), ...START, minZoom: 6, maxZoom: 17, maxBounds: BASEMAP_BOUNDS,
      attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false,
      boxZoom: false, // shift-drag is box *select* here
      fadeDuration: 0, renderWorldCopies: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(container)

    const ready = () => !!map.getLayer(LAYER.fill)
    const state = (id: string, s: Record<string, boolean>) => { if (ready()) map.setFeatureState({ source: FIELDS, id }, s) }
    const numberPoints = (): FeatureCollection<Point> => ({
      type: 'FeatureCollection',
      features: [...selected.values()].map((f, i) => ({
        type: 'Feature', properties: { n: i + 1, id: f.properties.id }, geometry: { type: 'Point', coordinates: labelPoint(f.geometry) },
      })),
    })
    const emitChange = () => {
      (map.getSource(NUMBERS) as GeoJSONSource | undefined)?.setData(numberPoints())
      onChangeRef.current?.([...selected.values()])
    }
    const select = (id: string) => {
      const f = byId.get(id)
      if (!f) return
      selected.set(id, f)
      state(id, { selected: true })
    }
    const toggle = (id: string) => {
      if (selected.has(id)) { selected.delete(id); state(id, { selected: false }) } else select(id)
      emitChange()
    }

    function addLayers() {
      // tolerance 0: no simplification, so neighbouring outlines don't cross at lower zooms
      map.addSource(FIELDS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id', tolerance: 0,
        attribution: 'Fields: Fields of the World 2025 (CC-BY-4.0)' })
      map.addSource(NUMBERS, { type: 'geojson', data: numberPoints() })
      const s = { source: FIELDS, minzoom: FIELD_MINZOOM }
      map.addLayer({ id: LAYER.fill, type: 'fill', ...s, paint: {
        'fill-color': ['case', sel, t.hero, t.field],
        'fill-opacity': ['case', sel, 0.95, hov, 1, 0.85],
      } })
      map.addLayer({ id: LAYER.line, type: 'line', ...s, paint: {
        'line-color': t.fieldLine, 'line-width': ['interpolate', ['linear'], ['zoom'], FIELD_MINZOOM, 0.5, 16, 1.4],
      } })
      map.addLayer({ id: LAYER.hover, type: 'line', ...s, paint: {
        'line-color': t.ink, 'line-width': 1.2, 'line-opacity': ['case', hov, 0.9, 0],
      } })
      map.addLayer({ id: LAYER.halo, type: 'line', ...s, paint: {
        'line-color': t.paper, 'line-width': 4, 'line-opacity': ['case', sel, 0.95, 0],
      } })
      map.addLayer({ id: LAYER.sel, type: 'line', ...s, paint: {
        'line-color': t.ink, 'line-width': 2, 'line-opacity': ['case', sel, 1, 0],
      } })
      map.addLayer({ id: LAYER.num, type: 'circle', source: NUMBERS, minzoom: FIELD_MINZOOM, paint: {
        'circle-radius': 13 * t.textScale, 'circle-color': t.ink, 'circle-stroke-color': t.paper, 'circle-stroke-width': 2,
      } })
      map.addLayer({ id: LAYER.numText, type: 'symbol', source: NUMBERS, minzoom: FIELD_MINZOOM,
        layout: { 'text-field': ['to-string', ['get', 'n']], 'text-font': t.font.medium, 'text-size': 14 * t.textScale, 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': t.paper },
      })
    }

    // Fetch the visible area unless an earlier request already covered it. Fields accumulate,
    // so panning back is instant and selections stay valid.
    async function loadView() {
      if (!ready()) return
      if (map.getZoom() < FIELD_MINZOOM) { request?.abort(); setStatus('zoom'); return }
      const b = map.getBounds()
      const bbox: BBox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
      if (loaded.some(l => contains(l, bbox))) { setStatus('idle'); return }
      request?.abort()
      const controller = new AbortController()
      request = controller
      setStatus('loading')
      try {
        const features = await fetchFields(bbox, controller.signal)
        for (const f of features) byId.set(String(f.properties.id), f)
        loaded.push(bbox);
        (map.getSource(FIELDS) as GeoJSONSource).setData({ type: 'FeatureCollection', features: [...byId.values()] })
        setStatus('idle')
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    }
    retryRef.current = () => { void loadView() }

    map.once('style.load', () => { addLayers(); void loadView() })
    map.on('moveend', () => { void loadView() })

    const pick = (p: maplibregl.PointLike) => (ready() ? map.queryRenderedFeatures(p, { layers: [LAYER.fill] })[0] : undefined)

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
      if (id) state(id, { hover: true })
      map.getCanvas().style.cursor = id ? 'pointer' : ''
    })
    map.on('mouseout', () => {
      if (hoverId) state(hoverId, { hover: false })
      hoverId = null
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
        for (const f of map.queryRenderedFeatures([start, p], { layers: [LAYER.fill] })) select(String(f.properties.id))
        emitChange()
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }
    canvas.addEventListener('mousedown', onMouseDown)

    return () => {
      request?.abort()
      retryRef.current = () => {}
      canvas.removeEventListener('mousedown', onMouseDown)
      resizeObserver.disconnect()
      map.remove()
    }
  }, [])

  return (
    <section className="field-map" aria-label="Field selection map">
      <div ref={ref} className="field-map-canvas fp-root" />
      {status !== 'idle' && (
        <div className="field-map-status" role={status === 'error' ? 'alert' : 'status'}>
          {status === 'zoom' && <p>Zoom in to see fields.</p>}
          {status === 'loading' && <p>Loading fields…</p>}
          {status === 'error' && (
            <>
              <p>Could not load fields.</p>
              <button type="button" onClick={() => retryRef.current()}>Try again</button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
