import assert from 'node:assert/strict'
import test from 'node:test'
import { imageryViewport } from '../src/lib/imageryViewport.ts'

const field: [number, number, number, number] = [-80, 44, -79.999, 44.001]
const viewport: typeof field = [-80.002, 43.998, -79.997, 44.003]

test('viewport crop preserves the scene and RGB rendering while requesting the exact visible location', () => {
  const source = new URL('https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/-80,44,-79.999,44.001.png')
  source.searchParams.set('collection', 'hls2-l30')
  source.searchParams.set('item', 'HLS.L30.20200715')
  for (const band of ['B04', 'B03', 'B02']) source.searchParams.append('assets', band)
  source.searchParams.set('rescale', '0,3000')
  const result = imageryViewport(`/api/imagery/image?src=${encodeURIComponent(source.href)}`, field, viewport)
  const proxy = new URL(result.imageUrl, 'http://localhost')
  const crop = new URL(proxy.searchParams.get('src')!)
  assert.equal(proxy.pathname, '/api/imagery/image')
  assert.equal(crop.pathname, `/api/data/v1/item/bbox/${viewport.join(',')}.png`)
  assert.equal(crop.searchParams.get('item'), source.searchParams.get('item'))
  assert.equal(crop.searchParams.get('collection'), 'hls2-l30')
  assert.deepEqual(crop.searchParams.getAll('assets'), ['B04', 'B03', 'B02'])
  assert.equal(crop.searchParams.get('rescale'), '0,3000')
  assert.equal(crop.searchParams.get('coord_crs'), 'EPSG:4326')
  assert.equal(crop.searchParams.get('dst_crs'), 'EPSG:3857')
  assert.deepEqual(result.bounds, viewport)
  assert.equal(result.fillsViewport, true)
})

test('supplied images with unknown crop formats keep their true bounds', () => {
  const result = imageryViewport('/images/field.png', field, viewport)
  assert.equal(result.imageUrl, '/images/field.png')
  assert.deepEqual(result.bounds, field)
  assert.equal(result.fillsViewport, false)
})
