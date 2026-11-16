import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import { Skeleton } from 'skullet/react'
import type { Polygon, MultiPolygon } from 'geojson'
import { basemapStyle } from '../lib/basemap'
import { theme } from '../lib/theme'
import { imageryViewport } from '../lib/imageryViewport'
import { fetchFieldImagery, type FieldImageryResponse, type FieldScene, type ImageryQuery } from '../data/fieldImagery'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../styles/FieldImagerySlider.css'

export type { FieldScene } from '../data/fieldImagery'
type Bounds = [number, number, number, number]
type Props = {
  images?: FieldScene[]
  bbox?: Bounds
  boundary: Polygon | MultiPolygon
  fieldName?: string
  showImagery?: boolean
  fieldId?: string
}

const emptyImages: FieldScene[] = []

type Timeline = { scenes: FieldScene[]; selected: number; period?: { start: string; end: string } }

/** Layout-only stand-in for the date controls: twenty sampled scenes across five years. Never shown as text. */
const SAMPLE_TIMELINE: Timeline = {
  scenes: Array.from({ length: 20 }, (_, i) => ({
    sceneId: `sample-${i}`, datetime: `${2021 + Math.floor(i / 4)}-0${5 + (i % 4)}-14T00:00:00Z`,
    platform: 'sentinel-2b', imageUrl: '', sceneCloudCoverPct: 12,
  })),
  selected: 19,
  period: { start: '2021-05-01', end: '2025-09-30' },
}

const date = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const satellite = (value: string) => value.replace('sentinel-', 'Sentinel-').replace('landsat-', 'Landsat ')

/** Loads field-specific imagery unless crops and their geographic bounds are supplied. */
export default function FieldImagerySlider({ images: suppliedImages, bbox: suppliedBounds, boundary, fieldId, fieldName = 'Field', showImagery = false }: Props) {
  const query = useMemo<ImageryQuery>(() => ({ fieldId, polygon: boundary }), [fieldId, boundary])
  const [requestAttempt, setRequestAttempt] = useState(0)
  const [result, setResult] = useState<{ query: ImageryQuery; attempt: number; data?: FieldImageryResponse; error?: boolean } | null>(null)
  const shouldFetch = showImagery && suppliedImages === undefined
  const currentResult = result?.query === query && result.attempt === requestAttempt ? result : null
  const loading = shouldFetch && !currentResult
  const failed = shouldFetch && currentResult?.error
  const images = suppliedImages ?? (shouldFetch ? currentResult?.data?.images : undefined) ?? emptyImages
  const period = shouldFetch ? currentResult?.data?.period : undefined
  const imageBounds = suppliedBounds ?? (shouldFetch ? currentResult?.data?.bbox : undefined)

  useEffect(() => {
    if (!shouldFetch) return
    const controller = new AbortController()
    fetchFieldImagery(query, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ query, attempt: requestAttempt, data })
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ query, attempt: requestAttempt, error: true })
    })
    return () => controller.abort()
  }, [query, shouldFetch, requestAttempt])

  const fieldBounds = useMemo<Bounds>(() => {
    const polygons = boundary.type === 'Polygon' ? [boundary.coordinates] : boundary.coordinates
    const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity]
    for (const polygon of polygons) for (const ring of polygon) for (const [lng, lat] of ring) {
      bounds[0] = Math.min(bounds[0], lng)
      bounds[1] = Math.min(bounds[1], lat)
      bounds[2] = Math.max(bounds[2], lng)
      bounds[3] = Math.max(bounds[3], lat)
    }
    return bounds
  }, [boundary])
  const bbox = imageBounds ?? fieldBounds
  const canShowImage = showImagery && !!imageBounds
  const overlapsField = bbox[0] < fieldBounds[2] && bbox[2] > fieldBounds[0]
    && bbox[1] < fieldBounds[3] && bbox[3] > fieldBounds[1]
  const scenes = useMemo(() => [...images].filter(image => Number.isFinite(Date.parse(image.datetime))).sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime)), [images])
  const [index, setIndex] = useState<number | null>(null)
  const selected = Math.min(index ?? scenes.length - 1, scenes.length - 1)
  const scene = scenes[selected]
  const container = useRef<HTMLDivElement>(null)
  const overlay = useRef<SVGSVGElement>(null)
  const outline = useRef<SVGPathElement>(null)
  const [mapView, setMapView] = useState<{
    boundary: Polygon | MultiPolygon
    sourceBounds: Bounds
    bounds: Bounds
    frame: { x: number; y: number; width: number; height: number }
  } | null>(null)
  const view = mapView?.boundary === boundary && mapView.sourceBounds === bbox ? mapView : null
  const crop = scene ? imageryViewport(scene.imageUrl, bbox, view?.bounds) : null
  const displayedUrl = crop?.imageUrl
  const id = useId().replace(/:/g, '')
  const [mapError, setMapError] = useState(false)
  const [imageResult, setImageResult] = useState<{ url: string; status: 'ready' | 'error' } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const imageStatus = imageResult?.url === displayedUrl ? imageResult?.status : 'loading'

  useEffect(() => {
    if (!container.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({ container: container.current, style: basemapStyle(theme),
        bounds: [[fieldBounds[0], fieldBounds[1]], [fieldBounds[2], fieldBounds[3]]], fitBoundsOptions: { padding: 60 },
        maxZoom: 19, interactive: false, renderWorldCopies: false, attributionControl: { compact: true },
      })
    } catch {
      // Map construction reports unsupported WebGL synchronously.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapError(true)
      return
    }
    const update = () => {
      const polygons = boundary.type === 'Polygon' ? [boundary.coordinates] : boundary.coordinates
      const path = polygons.flatMap(polygon => polygon.map(ring => ring.map((point, i) => {
        const p = map.project([point[0], point[1]])
        return `${i ? 'L' : 'M'}${p.x},${p.y}`
      }).join(' ') + ' Z')).join(' ')
      outline.current?.setAttribute('d', path)
      const nw = map.project([bbox[0], bbox[3]])
      const se = map.project([bbox[2], bbox[1]])
      const visible = map.getBounds()
      const bounds: Bounds = [visible.getWest(), visible.getSouth(), visible.getEast(), visible.getNorth()]
      const frame = { x: nw.x, y: nw.y, width: se.x - nw.x, height: se.y - nw.y }
      setMapView(previous => previous?.boundary === boundary && previous.sourceBounds === bbox
        && previous.bounds.every((value, i) => value === bounds[i]) ? previous
        : { boundary, sourceBounds: bbox, bounds, frame })
      overlay.current?.setAttribute('viewBox', `0 0 ${container.current!.clientWidth} ${container.current!.clientHeight}`)
    }
    map.on('move', update)
    map.on('resize', update)
    map.on('load', update)
    // Compact attribution opens expanded over the field; start it collapsed.
    map.once('load', () => container.current?.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show'))
    const observer = new ResizeObserver(() => {
      map.resize()
      map.fitBounds([[fieldBounds[0], fieldBounds[1]], [fieldBounds[2], fieldBounds[3]]], { padding: 60, duration: 0 })
    })
    observer.observe(container.current)
    return () => { observer.disconnect(); map.remove() }
  }, [bbox, boundary, fieldBounds])

  return <section className="imagery" aria-label={`${fieldName} satellite imagery`}>
    <div className="imagery-map">
      <div ref={container} className="imagery-map-canvas" role="img" aria-label={`${fieldName} location map, movement locked`} />
      <svg ref={overlay} className="imagery-overlay" aria-hidden="true">
        {/* Crop pixels and outline share the map's geographic extent and projection. */}
        <svg x={crop?.fillsViewport ? 0 : view?.frame.x} y={crop?.fillsViewport ? 0 : view?.frame.y}
          width={crop?.fillsViewport ? '100%' : view?.frame.width} height={crop?.fillsViewport ? '100%' : view?.frame.height}>
          {canShowImage && view && displayedUrl && overlapsField && <image key={`${displayedUrl}:${attempt}`} href={displayedUrl} width="100%" height="100%" preserveAspectRatio="none" opacity={imageStatus === 'ready' ? 1 : 0} onLoad={() => setImageResult({ url: displayedUrl, status: 'ready' })} onError={() => setImageResult({ url: displayedUrl, status: 'error' })} />}
        </svg>
        <defs><path id={`${id}-outline`} ref={outline} /></defs>
        <use href={`#${id}-outline`} fill="none" stroke="#fff" strokeWidth="5" />
        <use href={`#${id}-outline`} fill="none" stroke="#58402e" strokeWidth="2" />

      </svg>
      {loading && <div className="imagery-image-status" role="status">Checking historical satellite imagery...</div>}
      {failed && <div className="imagery-image-status" role="alert"><span>Satellite imagery could not be loaded.</span><button type="button" className="button-secondary" onClick={() => setRequestAttempt(value => value + 1)}><RotateCcw size={16} aria-hidden="true" />Retry imagery</button></div>}
      {showImagery && !overlapsField && <div className="imagery-image-status" role="status">The supplied imagery does not cover this field. Imagery for this location is needed.</div>}
      {canShowImage && scene && overlapsField && imageStatus !== 'ready' && <div className="imagery-image-status" role={imageStatus === 'error' ? 'alert' : 'status'}>{imageStatus === 'loading' ? 'Loading image...' : <><span>Image unavailable from provider.</span><button type="button" className="button-secondary" onClick={() => { setImageResult(null); setAttempt(attempt + 1) }}><RotateCcw size={16} aria-hidden="true" />Retry</button></>}</div>}
      {mapError && <p className="imagery-map-error" role="alert">The map could not start. Check that WebGL is enabled in your browser.</p>}
    </div>
    {loading || scene ? <Skeleton data={loading ? null : { scenes, selected, period }} sample={SAMPLE_TIMELINE} label="Loading satellite image dates">
      {({ scenes, selected, period }: Timeline) => {
        const scene = scenes[selected]
        return <>
          <div className="imagery-details" aria-live="polite">
            <strong>{date(scene.datetime)}</strong>
            <span>{satellite(scene.platform)}{scene.sceneCloudCoverPct != null && ` · ${scene.sceneCloudCoverPct}% scene cloud cover`}</span>
          </div>
          <div className="imagery-controls">
            <button type="button" className="button-secondary" aria-label="Previous image" disabled={selected <= 0} onClick={() => setIndex(selected - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
            <div className="imagery-track">
              <label htmlFor={`${id}-slider`}>Date <span>{selected + 1} / {scenes.length}</span></label>
              <input id={`${id}-slider`} type="range" min="0" max={Math.max(0, scenes.length - 1)} step="1" value={selected} disabled={scenes.length < 2} aria-valuetext={`${date(scene.datetime)}, ${satellite(scene.platform)}`} onChange={event => setIndex(Number(event.target.value))} />
              <div className="imagery-range"><span>{date(scenes[0].datetime)}</span><span>{date(scenes[scenes.length - 1].datetime)}</span></div>
            </div>
            <button type="button" className="button-secondary" aria-label="Next image" disabled={selected >= scenes.length - 1} onClick={() => setIndex(selected + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
          </div>
          {period && <p className="imagery-note">Clear images sampled across {period.start.slice(0, 4)}–{period.end.slice(0, 4)}. Some years may have no selected image.</p>}
        </>
      }}
    </Skeleton> : !failed && <p role="status">{shouldFetch ? 'No sampled images passed the field quality checks for this period.' : 'No dated images are available for this field.'}</p>}
  </section>
}
