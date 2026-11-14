import type { BBox } from './fields'

export type Place = {
  id: string
  label: string
  detail: string
  kind: 'address' | 'street' | 'area'
  center: [number, number]
  bbox?: BBox
}

/** Where the map opens. `place` is set when it came from search, so the map can frame it the same way. */
export type GeoLocation = { lat: number; lng: number; label?: string; place?: Place }

export const placeLabel = (p: Place) => (p.detail ? `${p.label}, ${p.detail}` : p.label)
export const toLocation = (p: Place): GeoLocation => ({ lng: p.center[0], lat: p.center[1], label: placeLabel(p), place: p })

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_type: string; osm_id: number; type: string
    name?: string; housenumber?: string; street?: string
    city?: string; county?: string; state?: string
    extent?: [number, number, number, number] // west, north, east, south
  }
}

const URL_BASE = import.meta.env.VITE_GEOCODER_URL
const SOUTHERN_ONTARIO: [number, number] = [-80.5, 43.9]
const LAYERS = ['house', 'street', 'city', 'locality', 'district', 'county']

/** Addresses, roads and places in Canada matching `query`, biased toward `near` ([lng, lat]). */
export async function searchPlaces(query: string, near: [number, number] = SOUTHERN_ONTARIO, signal?: AbortSignal): Promise<Place[]> {
  if (!URL_BASE) throw new Error('VITE_GEOCODER_URL is not set')
  const params = new URLSearchParams({ q: query, limit: '6', lon: String(near[0]), lat: String(near[1]), countrycode: 'CA' })
  for (const layer of LAYERS) params.append('layer', layer)
  const res = await fetch(`${URL_BASE}/api/?${params}`, { signal })
  if (!res.ok) throw new Error(`Geocoder returned ${res.status}`)
  const data: { features: PhotonFeature[] } = await res.json()

  const seen = new Set<string>()
  const places: Place[] = []
  for (const { geometry, properties: p } of data.features) {
    if (p.type === 'house' && !p.housenumber) continue // a landmark, not an address
    const kind = p.type === 'house' ? 'address' : p.type === 'street' ? 'street' : 'area'
    const label = kind === 'address' ? `${p.housenumber} ${p.street ?? p.name}` : (p.name ?? p.street ?? '').replace(/ \(.*\)$/, '') // "Orillia (city)"
    const detail = [p.city !== label ? p.city : undefined, p.state].filter(Boolean).join(', ')
    const key = `${label}|${detail}`
    if (!label || seen.has(key)) continue // the same road or town often comes back more than once
    seen.add(key)
    const e = p.extent
    places.push({
      id: `${p.osm_type}${p.osm_id}`, label, detail, kind, center: geometry.coordinates,
      bbox: e ? [e[0], e[3], e[2], e[1]] : undefined,
    })
  }
  return places
}
