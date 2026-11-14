import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'

export type FieldProperties = { id: string; score?: number }
export type FieldFeature = Feature<Polygon | MultiPolygon, FieldProperties>

/** west, south, east, north */
export type BBox = [number, number, number, number]

type Page = FeatureCollection<Polygon | MultiPolygon, FieldProperties> & { hasMore: boolean; nextCursor: number | null }

const PAGE_SIZE = 2000
const MAX_PAGES = 5

/** Field outlines in `bbox` from GET /api/fields, following nextCursor. */
export async function fetchFields(bbox: BBox, signal?: AbortSignal): Promise<FieldFeature[]> {
  const features: FieldFeature[] = []
  let cursor: number | null = 0
  for (let page = 0; cursor !== null && page < MAX_PAGES; page++) {
    const res = await fetch(`/api/fields?bbox=${bbox.map(v => v.toFixed(5)).join(',')}&limit=${PAGE_SIZE}&cursor=${cursor}`, { signal })
    if (!res.ok) throw new Error(`Field API returned ${res.status}`)
    const data: Page = await res.json()
    features.push(...data.features)
    cursor = data.hasMore ? data.nextCursor : null
  }
  return features
}
