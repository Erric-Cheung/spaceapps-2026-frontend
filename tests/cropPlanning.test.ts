import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchCropPlan } from '../src/data/cropPlanning.ts'
import type { FieldFeature } from '../src/data/fields.ts'

const field: FieldFeature = { type: 'Feature', properties: { id: 'field-2', selectionNumber: 2 }, geometry: {
  type: 'MultiPolygon', coordinates: [[[[-80, 44], [-79.99, 44], [-79.99, 44.01], [-80, 44]]]],
} }
const answers = [{ fieldId: 'field-2', crop: 'Corn', readyDate: '2028-04-20' }]
const response = { planner: 'random-placeholder', temporary: true, disclaimer: 'Random example', plans: [
  { fieldId: 'field-2', currentCrop: 'Corn', years: Array.from({ length: 5 }, (_, i) => ({ year: 2028 + i, crop: 'Soybeans' })) },
] }

test('planning preserves field identity, geometry, confirmed answers and the backend response', async t => {
  const signal = new AbortController().signal
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    assert.equal(init?.signal, signal)
    if (url === '/api/crops') return Response.json({ crops: [{ id: 'corn', name: 'Corn' }, { id: 'soybeans', name: 'Soybeans' }] })
    assert.equal(url, '/api/crop-optimization')
    assert.equal(init?.method, 'POST')
    assert.deepEqual(JSON.parse(init!.body as string), { fields: [{
      fieldId: 'field-2', geometry: field.geometry, currentCrop: 'Corn', readyDate: '2028-04-20', growableCrops: ['corn', 'soybeans'],
    }] })
    return Response.json(response)
  })
  assert.deepEqual(await fetchCropPlan([field], answers, signal), response)
})

test('unsupported farmer answers are rejected without substituting another crop', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ crops: ['Corn', 'Soybeans'] }) })
  await assert.rejects(fetchCropPlan([field], [{ ...answers[0], crop: 'Not sure' }], new AbortController().signal), /Field 2.*Not sure.*not supported/)
  assert.equal(calls, 1)
})

test('incomplete responses and backend failures do not become displayed plans', async t => {
  for (const status of [200, 422, 503]) {
    const mock = t.mock.method(globalThis, 'fetch', async (url: string) => url === '/api/crops'
      ? Response.json({ crops: ['Corn'] })
      : Response.json({ ...response, plans: [] }, { status }))
    await assert.rejects(fetchCropPlan([field], answers, new AbortController().signal), status === 200 ? /incomplete plan/ : status === 422 ? /could not accept/ : /HTTP 503/)
    mock.mock.restore()
  }
})
