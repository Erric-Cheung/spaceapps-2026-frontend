import type { MultiPolygon, Polygon } from 'geojson'
import type { BBox } from './fields'

export type FieldScene = {
  sceneId: string
  datetime: string
  platform: string
  imageUrl: string
  sceneCloudCoverPct: number | null
}

export type FieldImageryResponse = {
  bbox: BBox
  period: { start: string; end: string }
  images: FieldScene[]
  hasMore: boolean
  dataset: 'hls' | 'sentinel-2'
}

export type ImageryQuery = {
  fieldId?: string
  polygon: Polygon | MultiPolygon
  dataset?: 'hls' | 'sentinel-2'
}

/** Fetches up to 20 quality-screened crops sampled across archive years through the Java API. */
export async function fetchFieldImagery({ fieldId, polygon, dataset = 'hls' }: ImageryQuery, signal?: AbortSignal): Promise<FieldImageryResponse> {
  const response = await fetch(fieldId
    ? `/api/fields/${encodeURIComponent(fieldId)}/imagery?dataset=${dataset}&limit=20`
    : '/api/imagery', {
    method: fieldId ? 'GET' : 'POST',
    headers: { Accept: 'application/json', ...(!fieldId && { 'Content-Type': 'application/json' }) },
    ...(!fieldId && { body: JSON.stringify({ polygon, dataset, limit: 20 }) }),
    signal,
  })
  if (!response.ok) throw new Error(`Imagery API returned ${response.status}`)
  const data: Omit<FieldImageryResponse, 'images'> & { images: (Omit<FieldScene, 'imageUrl'> & { imageUrl: string | null })[] } = await response.json()
  return {
    ...data,
    // Java returns root-relative image routes. Keep PNGs behind the same /api proxy as metadata.
    images: data.images.flatMap(image => image.imageUrl ? [{
      ...image,
      imageUrl: image.imageUrl.startsWith('/imagery/image?') ? `/api${image.imageUrl}` : image.imageUrl,
    }] : []),
  }
}
