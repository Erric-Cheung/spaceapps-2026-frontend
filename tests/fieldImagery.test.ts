import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchFieldImagery } from '../src/data/fieldImagery.ts'

const polygon = { type: 'Polygon' as const, coordinates: [[[-80, 44], [-79.999, 44], [-79.999, 44.001], [-80, 44]]] }
const bbox = [-80, 44, -79.999, 44.001]
const scene = { sceneId: 'landsat', datetime: '2026-10-18T16:35:37Z', platform: 'landsat-9', sceneCloudCoverPct: 0 }

test('stored fields use HLS and preserve the encoded image route through the frontend proxy', async () => {
  const original = globalThis.fetch
  const signal = new AbortController().signal
  const route = '/imagery/image?src=https%3A%2F%2Fprovider.test%2Fcrop.png%3Fa%3D1%26b%3D2'
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/fields/field%2F1/imagery?dataset=hls&limit=20')
    assert.equal(init?.method, 'GET')
    assert.equal(init?.body, undefined)
    assert.equal(init?.signal, signal)
    return Response.json({ bbox, dataset: 'hls', hasMore: true, images: [
      { ...scene, imageUrl: route },
      { ...scene, sceneId: 'sentinel', platform: 'sentinel-2c', imageUrl: route },
      { ...scene, sceneId: 'unservable', imageUrl: null },
    ] })
  }
  try {
    const data = await fetchFieldImagery({ fieldId: 'field/1', polygon }, signal)
    assert.deepEqual(data.bbox, bbox)
    assert.equal(data.hasMore, true)
    assert.deepEqual(data.images.map(image => image.platform), ['landsat-9', 'sentinel-2c'])
    assert.ok(data.images.every(image => image.imageUrl === `/api${route}`))
  } finally { globalThis.fetch = original }
})

test('outlines can request native Sentinel-2 via POST', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/imagery')
    assert.equal(init?.method, 'POST')
    assert.deepEqual(JSON.parse(init!.body as string), { polygon, dataset: 'sentinel-2', limit: 20 })
    return Response.json({ bbox, dataset: 'sentinel-2', hasMore: false, images: [] })
  }
  try {
    assert.deepEqual((await fetchFieldImagery({ polygon, dataset: 'sentinel-2' })).images, [])
  } finally { globalThis.fetch = original }
})

test('catalogue errors and cancelled requests propagate to the caller', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response(null, { status: 502 })
    await assert.rejects(fetchFieldImagery({ fieldId: 'a', polygon }), /Imagery API returned 502/)
    globalThis.fetch = async () => { throw new DOMException('Aborted', 'AbortError') }
    await assert.rejects(fetchFieldImagery({ polygon }), { name: 'AbortError' })
  } finally { globalThis.fetch = original }
})
