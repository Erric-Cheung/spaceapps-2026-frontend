import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import type { Polygon, MultiPolygon } from 'geojson'
import { basemapStyle } from '../lib/basemap'
import { theme } from '../lib/theme'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../styles/FieldImagerySlider.css'

export type FieldScene = {
  sceneId: string
  datetime: string
  platform: string
  imageUrl: string
  sceneCloudCoverPct: number
}
type Bounds = [number, number, number, number]
type Props = {
  images?: FieldScene[]
  bbox?: Bounds
  boundary: Polygon | MultiPolygon
  fieldName?: string
  showImagery?: boolean
  sampleImagery?: boolean
}

const emptyImages: FieldScene[] = []

// Supplied HLS crops from [-88.95, 40.45, -88.947, 40.453].
// Sample mode previews these on the selected boundary, not at their original location.
const sampleImages: FieldScene[] = [
  {
    "sceneId": "HLS.S30.T16TCK.2026294T164331.v2.0",
    "datetime": "2026-10-21T16:52:28.634020Z",
    "platform": "sentinel-2c",
    "imageUrl": "https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/-88.95,40.45,-88.947,40.453.png?collection=hls2-s30&item=HLS.S30.T16TCK.2026294T164331.v2.0&max_size=1024&assets=B04&assets=B03&assets=B02&rescale=0%2C3000&nodata=-9999&color_formula=gamma+RGB+1.4",
    "sceneCloudCoverPct": 0
  },
  {
    "sceneId": "HLS.L30.T16TCK.2026291T163537.v2.0",
    "datetime": "2026-10-18T16:35:37.305624Z",
    "platform": "landsat-9",
    "imageUrl": "https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/-88.95,40.45,-88.947,40.453.png?collection=hls2-l30&item=HLS.L30.T16TCK.2026291T163537.v2.0&max_size=1024&assets=B04&assets=B03&assets=B02&rescale=0%2C3000&nodata=-9999&color_formula=gamma+RGB+1.4",
    "sceneCloudCoverPct": 0
  },
  {
    "sceneId": "HLS.S30.T16TCK.2026284T164221.v2.0",
    "datetime": "2026-10-11T16:52:30.164410Z",
    "platform": "sentinel-2c",
    "imageUrl": "https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/-88.95,40.45,-88.947,40.453.png?collection=hls2-s30&item=HLS.S30.T16TCK.2026284T164221.v2.0&max_size=1024&assets=B04&assets=B03&assets=B02&rescale=0%2C3000&nodata=-9999&color_formula=gamma+RGB+1.4",
    "sceneCloudCoverPct": 0
  },
  {
    "sceneId": "HLS.S30.T16TCK.2026279T164149.v2.0",
    "datetime": "2026-10-06T16:52:28.341050Z",
    "platform": "sentinel-2b",
    "imageUrl": "https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/-88.95,40.45,-88.947,40.453.png?collection=hls2-s30&item=HLS.S30.T16TCK.2026279T164149.v2.0&max_size=1024&assets=B04&assets=B03&assets=B02&rescale=0%2C3000&nodata=-9999&color_formula=gamma+RGB+1.4",
    "sceneCloudCoverPct": 0
  },
  {
    "sceneId": "HLS.S30.T16TCK.2026244T163831.v2.0",
    "datetime": "2026-09-01T16:52:26.581820Z",
    "platform": "sentinel-2c",
    "imageUrl": "https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/-88.95,40.45,-88.947,40.453.png?collection=hls2-s30&item=HLS.S30.T16TCK.2026244T163831.v2.0&max_size=1024&assets=B04&assets=B03&assets=B02&rescale=0%2C3000&nodata=-9999&color_formula=gamma+RGB+1.4",
    "sceneCloudCoverPct": 0
  },
  {
    "sceneId": "HLS.L30.T16TCK.2026235T163516.v2.0",
    "datetime": "2026-08-23T16:35:16.379994Z",
    "platform": "landsat-8",
    "imageUrl": "https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/-88.95,40.45,-88.947,40.453.png?collection=hls2-l30&item=HLS.L30.T16TCK.2026235T163516.v2.0&max_size=1024&assets=B04&assets=B03&assets=B02&rescale=0%2C3000&nodata=-9999&color_formula=gamma+RGB+1.4",
    "sceneCloudCoverPct": 0
  }
]

const date = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const satellite = (value: string) => value.replace('sentinel-', 'Sentinel-').replace('landsat-', 'Landsat ')

/** bbox is the image's geographic extent, never the field bounds unless they match the crop. */
export default function FieldImagerySlider({ sampleImagery = false, images = sampleImagery ? sampleImages : emptyImages, bbox: imageBounds, boundary, fieldName = 'Field', showImagery = false }: Props) {
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
  const canShowImage = showImagery && (sampleImagery || !!imageBounds)
  const overlapsField = bbox[0] < fieldBounds[2] && bbox[2] > fieldBounds[0]
    && bbox[1] < fieldBounds[3] && bbox[3] > fieldBounds[1]
  const scenes = useMemo(() => [...images].filter(image => Number.isFinite(Date.parse(image.datetime))).sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime)), [images])
  const [index, setIndex] = useState<number | null>(null)
  const selected = Math.min(index ?? scenes.length - 1, scenes.length - 1)
  const scene = scenes[selected]
  const container = useRef<HTMLDivElement>(null)
  const overlay = useRef<SVGSVGElement>(null)
  const clip = useRef<SVGPathElement>(null)
  const outline = useRef<SVGPathElement>(null)
  const imageFrame = useRef<SVGSVGElement>(null)
  const id = useId().replace(/:/g, '')
  const [mapError, setMapError] = useState(false)
  const [imageResult, setImageResult] = useState<{ url: string; status: 'ready' | 'error' } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const imageStatus = imageResult?.url === scene?.imageUrl ? imageResult?.status : 'loading'

  useEffect(() => {
    if (!container.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({ container: container.current, style: basemapStyle(theme),
        bounds: [[fieldBounds[0], fieldBounds[1]], [fieldBounds[2], fieldBounds[3]]], fitBoundsOptions: { padding: 65 },
        maxZoom: 19, dragRotate: false, pitchWithRotate: false, renderWorldCopies: false,
      })
    } catch {
      // Map construction reports unsupported WebGL synchronously.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapError(true)
      return
    }
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const update = () => {
      const polygons = boundary.type === 'Polygon' ? [boundary.coordinates] : boundary.coordinates
      const path = polygons.flatMap(polygon => polygon.map(ring => ring.map((point, i) => {
        const p = map.project([point[0], point[1]])
        return `${i ? 'L' : 'M'}${p.x},${p.y}`
      }).join(' ') + ' Z')).join(' ')
      clip.current?.setAttribute('d', path)
      outline.current?.setAttribute('d', path)
      const nw = map.project([bbox[0], bbox[3]])
      const se = map.project([bbox[2], bbox[1]])
      imageFrame.current?.setAttribute('x', String(nw.x))
      imageFrame.current?.setAttribute('y', String(nw.y))
      imageFrame.current?.setAttribute('width', String(se.x - nw.x))
      imageFrame.current?.setAttribute('height', String(se.y - nw.y))
      overlay.current?.setAttribute('viewBox', `0 0 ${container.current!.clientWidth} ${container.current!.clientHeight}`)
    }
    map.on('move', update)
    map.on('resize', update)
    map.on('load', update)
    update()
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)
    return () => { observer.disconnect(); map.remove() }
  }, [bbox, boundary, fieldBounds])

  return <section className="imagery" aria-label={`${fieldName} satellite imagery`}>
    <div className="imagery-map">
      <div ref={container} className="imagery-map-canvas" aria-label="Interactive field map" />
      <svg ref={overlay} className="imagery-overlay" aria-hidden="true">
        <defs><clipPath id={id}><path ref={clip} clipRule="evenodd" /></clipPath></defs>
        <g clipPath={`url(#${id})`}><svg ref={imageFrame}>
          {canShowImage && scene && overlapsField && <image key={`${scene.imageUrl}:${attempt}`} href={scene.imageUrl} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" opacity={imageStatus === 'ready' ? 1 : 0} onLoad={() => setImageResult({ url: scene.imageUrl, status: 'ready' })} onError={() => setImageResult({ url: scene.imageUrl, status: 'error' })} />}
        </svg></g>
        <defs><path id={`${id}-outline`} ref={outline} /></defs>
        <use href={`#${id}-outline`} fill="none" stroke="#fff" strokeWidth="5" />
        <use href={`#${id}-outline`} fill="none" stroke="#58402e" strokeWidth="2" />

      </svg>
      {showImagery && !overlapsField && <div className="imagery-image-status" role="status">The supplied imagery does not cover this field. Imagery for this location is needed.</div>}
      {canShowImage && scene && overlapsField && imageStatus !== 'ready' && <div className="imagery-image-status" role={imageStatus === 'error' ? 'alert' : 'status'}>{imageStatus === 'loading' ? 'Loading image...' : <><span>Image unavailable from provider.</span><button type="button" onClick={() => { setImageResult(null); setAttempt(attempt + 1) }}><RotateCcw size={16} aria-hidden="true" />Retry</button></>}</div>}
      {mapError && <p className="imagery-map-error" role="alert">The map could not start. Check that WebGL is enabled in your browser.</p>}
    </div>
    {scene ? <>
      <div className="imagery-details" aria-live="polite">
        <strong>{date(scene.datetime)}</strong>
      </div>
      <div className="imagery-controls">
        <button type="button" aria-label="Previous image" disabled={selected <= 0} onClick={() => setIndex(selected - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <div className="imagery-track">
          <label htmlFor={`${id}-slider`}>Date <span>{selected + 1} / {scenes.length}</span></label>
          <input id={`${id}-slider`} type="range" min="0" max={Math.max(0, scenes.length - 1)} step="1" value={selected} disabled={scenes.length < 2} aria-valuetext={`${date(scene.datetime)}, ${satellite(scene.platform)}`} onChange={event => setIndex(Number(event.target.value))} />
          <div className="imagery-range"><span>{date(scenes[0].datetime)}</span><span>{date(scenes[scenes.length - 1].datetime)}</span></div>
        </div>
        <button type="button" aria-label="Next image" disabled={selected >= scenes.length - 1} onClick={() => setIndex(selected + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
    </> : <p role="status">No dated images are available for this field.</p>}
  </section>
}
