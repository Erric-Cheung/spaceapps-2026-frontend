import type { GeoJSONSource, Map as MapLibreMap, MapSourceDataEvent } from 'maplibre-gl'
import type { FieldFeature } from '../data/fields'

export const ENTERING_FIELDS = 'fields-entering'
export const ENTERING_LAYERS = {
  fill: 'field-entering-fill', line: 'field-entering-line', hover: 'field-entering-hover',
  halo: 'field-entering-halo', sel: 'field-entering-selected',
}

// Two constant-opacity layers let MapLibre animate on its render loop, without
// React updates or per-feature JavaScript animation. Existing fields stay still.
export function createFieldReveal(map: MapLibreMap, source: string) {
  const settled = new globalThis.Map<string, FieldFeature>()
  const queued = new globalThis.Map<string, FieldFeature>()
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let active = false
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let onSource: ((event: MapSourceDataEvent) => void) | undefined
  let onRender: (() => void) | undefined

  const data = (features: FieldFeature[]) => ({ type: 'FeatureCollection' as const, features })
  const update = (id: string, features: FieldFeature[]) => (map.getSource(id) as GeoJSONSource).setData(data(features))
  const opacity = (fill: number, line: number, duration: number) => {
    map.setPaintProperty(ENTERING_LAYERS.fill, 'fill-opacity-transition', { duration, delay: 0 })
    map.setPaintProperty(ENTERING_LAYERS.line, 'line-opacity-transition', { duration, delay: 0 })
    map.setPaintProperty(ENTERING_LAYERS.fill, 'fill-opacity', fill)
    map.setPaintProperty(ENTERING_LAYERS.line, 'line-opacity', line)
  }
  const whenLoaded = (id: string, done: () => void) => {
    let receivedContent = false
    onSource = event => {
      if (event.sourceId !== id) return
      if (event.sourceDataType === 'content') receivedContent = true
      // Content means the worker has parsed GeoJSON; individual tile events
      // arrive afterwards. Waiting for both on the same event can stall forever.
      if (!receivedContent || !event.isSourceLoaded) return
      map.off('sourcedata', onSource!)
      onSource = undefined
      done()
    }
    map.on('sourcedata', onSource)
  }

  function flush() {
    if (active || disposed || !queued.size) return
    active = true
    const batch = [...queued.values()]
    queued.clear()
    opacity(0, 0, 0)
    map.removeFeatureState({ source: ENTERING_FIELDS })
    for (const layer of Object.values(ENTERING_LAYERS)) map.setLayoutProperty(layer, 'visibility', 'visible')

    whenLoaded(ENTERING_FIELDS, () => {
      // Start on the first actual frame containing the geometry, rather than
      // letting the transition finish while a worker is still parsing it.
      onRender = () => {
        onRender = undefined
        const duration = motion.matches ? 0 : 180
        opacity(0.85, 1, duration)
        const merge = () => {
          timer = undefined
          for (const field of batch) settled.set(String(field.properties.id), field)
          whenLoaded(source, () => {
            // Swap on source readiness, before painting, to avoid double fill.
            for (const layer of Object.values(ENTERING_LAYERS)) map.setLayoutProperty(layer, 'visibility', 'none')
            active = false
            flush()
          })
          update(source, [...settled.values()])
        }
        if (duration) timer = setTimeout(merge, duration)
        else merge()
      }
      map.once('render', onRender)
      map.triggerRepaint()
    })
    update(ENTERING_FIELDS, batch)
  }

  return {
    add(features: FieldFeature[]) {
      for (const field of features) queued.set(String(field.properties.id), field)
      flush()
    },
    destroy() {
      disposed = true
      clearTimeout(timer)
      if (onSource) map.off('sourcedata', onSource)
      if (onRender) map.off('render', onRender)
    },
  }
}
