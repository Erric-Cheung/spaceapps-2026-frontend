import type { BBox } from '../data/fields'

/** Re-crop the same provider scene to the map extent, preserving geographic scale. */
export function imageryViewport(imageUrl: string, bounds: BBox, viewport?: BBox) {
  const original = { imageUrl, bounds, fillsViewport: false }
  if (!viewport) return original
  const route = new URL(imageUrl, 'http://localhost')
  const proxied = route.pathname === '/api/imagery/image' || route.pathname === '/imagery/image'
  const source = proxied ? route.searchParams.get('src') : imageUrl
  if (!source) return original
  let provider: URL
  try { provider = new URL(source) } catch { return original }
  if (provider.origin !== 'https://planetarycomputer.microsoft.com'
    || !/^\/api\/data\/v1\/item\/bbox\/[^/]+\.png$/.test(provider.pathname)) return original
  const crop = viewport.map(value => Number(value.toFixed(8))) as BBox
  provider.pathname = `/api/data/v1/item/bbox/${crop.join(',')}.png`
  provider.searchParams.set('coord_crs', 'EPSG:4326')
  provider.searchParams.set('dst_crs', 'EPSG:3857')
  if (proxied) route.searchParams.set('src', provider.href)
  return {
    imageUrl: proxied ? `${route.pathname}${route.search}` : provider.href,
    bounds: crop,
    fillsViewport: true,
  }
}
