import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchCropPlan } from '../src/data/cropPlanning.ts'
import type { FieldFeature } from '../src/data/fields.ts'

const field: FieldFeature = { type: 'Feature', properties: { id: 'field-2', selectionNumber: 2 }, geometry: {
  type: 'MultiPolygon', coordinates: [[[[-80, 44], [-79.99, 44], [-79.99, 44.01], [-80, 44]]]],
} }
const answers = [{ fieldId: 'field-2', crop: 'Corn', readyDate: '2028-04-20' }]
const response = { planner: 'random-placeholder', temporary: true, disclaimer: 'Random example', plans: [
  { fieldId: 'field-2', currentCrop: 'Corn', years: Array.from({ length: 5 }, (_, i) => ({ year: 2028 + i, crop: 'Soybeans' })),
    alternatives: ['Corn', 'Soybeans', 'Wheat'].map((crop, i) => ({ id: `rotation-${i}`, title: `Rotation ${i}`, summary: 'Example sequence',
      years: Array.from({ length: 5 }, (_, y) => ({ year: 2028 + y, crop, rationale: 'Demo reasoning' })), benefits: ['Example benefit'], tradeoff: 'Example tradeoff' })),
  },
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

test('pasture, unknown and custom farmer answers reach Java without substitution', async t => {
  let currentAnswer = ''
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    if (url === '/api/crops') return Response.json({ crops: ['Corn', 'Soybeans', 'Wheat'] })
    const request = JSON.parse(init!.body as string)
    assert.equal(request.fields[0].currentCrop, currentAnswer)
    return Response.json({ ...response, plans: response.plans.map(plan => ({ ...plan, currentCrop: currentAnswer })) })
  })
  for (const crop of ['Pasture', 'Not sure', 'Nothing planted', 'Mixed hay']) {
    currentAnswer = crop
    const result = await fetchCropPlan([field], [{ ...answers[0], crop }], new AbortController().signal)
    assert.equal(result.plans[0].currentCrop, crop)
  }
})

test('duplicated random rotations are rejected instead of appearing as different options', async t => {
  t.mock.method(globalThis, 'fetch', async (url: string) => url === '/api/crops'
    ? Response.json({ crops: ['Corn'] })
    : Response.json({ ...response, plans: [{ ...response.plans[0], alternatives: Array(3).fill(response.plans[0].alternatives[0]) }] }))
  await assert.rejects(fetchCropPlan([field], answers, new AbortController().signal), /three different rotations/)
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
