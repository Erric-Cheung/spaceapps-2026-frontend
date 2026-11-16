import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchFields, type FieldFeature } from '../src/data/fields.ts'

const feature = (id: string): FieldFeature => ({ type: 'Feature', properties: { id }, geometry: {
  type: 'Polygon', coordinates: [[[-80, 44], [-79.99, 44], [-79.99, 44.01], [-80, 44]]],
} })

test('each page is handed over as it arrives, before the last page loads', async t => {
  const pages = [
    { features: [feature('a'), feature('b')], hasMore: true, nextCursor: 2 },
    { features: [feature('c')], hasMore: false, nextCursor: null },
  ]
  const delivered: string[][] = []
  let requests = 0
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    // The first page must already be delivered when the second is requested.
    if (requests === 1) assert.deepEqual(delivered, [['a', 'b']])
    assert.match(url, new RegExp(`cursor=${requests === 0 ? 0 : 2}$`))
    return Response.json({ type: 'FeatureCollection', ...pages[requests++] })
  })
  const all = await fetchFields([-80, 44, -79, 45], undefined, page => delivered.push(page.map(f => f.properties.id)))
  assert.deepEqual(delivered, [['a', 'b'], ['c']])
  assert.deepEqual(all.map(f => f.properties.id), ['a', 'b', 'c'])
})
