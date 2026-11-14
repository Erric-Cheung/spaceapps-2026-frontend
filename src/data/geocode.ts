export type GeoLocation = { lat: number; lng: number; label?: string }

type NominatimResult = { lat: string; lon: string; display_name: string }

/** Forward-geocode a free-text place name with OpenStreetMap Nominatim. */
export async function geocode(query: string, signal?: AbortSignal): Promise<GeoLocation> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal,
    headers: { 'Accept-Language': navigator.language },
  })
  if (!res.ok) throw new Error(`Geocoder returned ${res.status}`)
  const results: NominatimResult[] = await res.json()
  if (!results.length) throw new Error('No matching location found.')
  const [first] = results
  return { lat: Number(first.lat), lng: Number(first.lon), label: first.display_name }
}
