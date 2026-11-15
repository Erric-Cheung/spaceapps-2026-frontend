import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchCropPlan, mainCrop } from '../src/data/cropPlanning.ts'
import type { FieldFeature } from '../src/data/fields.ts'

const field: FieldFeature = { type: 'Feature', properties: { id: 'field-2', selectionNumber: 2 }, geometry: {
  type: 'MultiPolygon', coordinates: [[[[-80, 44], [-79.99, 44], [-79.99, 44.01], [-80, 44]]]],
} }
const answers = [{ fieldId: 'field-2', crop: 'Corn', readyDate: '2028-04-20' }]
const catalog = { crops: [
  { id: 'corn', name: 'Corn' }, { id: 'soybeans', name: 'Soybeans' }, { id: 'wheat', name: 'Wheat' }, { id: 'alfalfa', name: 'Alfalfa' },
], exampleData: true, note: 'Example figures' }
const years = (crops: string[]) => crops.map((crop, i) => ({ year: 2028 + i, crop, reliability: 0.8, reasons: [`${crop} reason`] }))

/** A stand-in for the dynamic planner: picks the first growable crops in a fixed preference order. */
function dynamicPlanner(requests: { fields: { fieldId: string; currentCrop: string; growableCrops: string[] }[] }[]) {
  return async (url: string, init?: RequestInit) => {
    if (url === '/api/crops') return Response.json(catalog)
    assert.equal(url, '/api/crop-optimization')
    const body = JSON.parse(init!.body as string)
    requests.push(body)
    return Response.json({ planner: 'dynamic-soil-reliability', temporary: true, disclaimer: 'Real planner', plans: body.fields.map(
      (request: { fieldId: string; currentCrop: string; growableCrops: string[] }) => {
        const names = ['alfalfa', 'wheat', 'soybeans', 'corn'].filter(id => request.growableCrops.includes(id))
          .map(id => catalog.crops.find(crop => crop.id === id)!.name)
        const sequence = [names[0], names[1] ?? names[0], names[0], names[1] ?? names[0], names[0]]
        return { fieldId: request.fieldId, currentCrop: request.currentCrop, years: years(sequence), totalSoilScore: names.length, totalIncome: 1000, assumptions: ['Assumed pH'] }
      }) })
  }
}

test('three real options each drop the main crop of the option before', async t => {
  const requests: { fields: { fieldId: string; currentCrop: string; growableCrops: string[] }[] }[] = []
  t.mock.method(globalThis, 'fetch', dynamicPlanner(requests))
  const progress: number[] = []
  const result = await fetchCropPlan([field], answers, {}, new AbortController().signal, p => progress.push(p.round))
  assert.deepEqual(progress, [1, 2, 3])
  assert.deepEqual(requests.map(request => request.fields[0].growableCrops), [
    ['corn', 'soybeans', 'wheat', 'alfalfa'], ['corn', 'soybeans', 'wheat'], ['corn', 'soybeans'],
  ])
  assert.equal(requests[0].fields[0].currentCrop, 'corn')
  const plan = result.fields[0]
  assert.equal(plan.status, 'planned')
  if (plan.status !== 'planned') return
  assert.deepEqual(plan.options.map(option => option.title), ['Best match for this field', 'Without alfalfa', 'Without alfalfa or wheat'])
  assert.equal(new Set(plan.options.map(option => option.years.map(year => year.crop).join())).size, 3)
  assert.deepEqual(plan.assumptions, ['Assumed pH'])
  assert.equal(result.planner, 'dynamic-soil-reliability')
})

test('only an unsure answer starts from the mapped crop; other unknown answers are reported, not replaced', async t => {
  const requests: { fields: { fieldId: string; currentCrop: string; growableCrops: string[] }[] }[] = []
  t.mock.method(globalThis, 'fetch', dynamicPlanner(requests))
  const other: FieldFeature = { ...field, properties: { id: 'field-3' } }
  const fallow: FieldFeature = { ...field, properties: { id: 'field-4' } }
  const result = await fetchCropPlan([field, other, fallow], [
    { fieldId: 'field-2', crop: 'Not sure', readyDate: '2028-04-20' },
    { fieldId: 'field-3', crop: 'Mixed hay', readyDate: '2028-04-20' },
    { fieldId: 'field-4', crop: 'Nothing planted', readyDate: '2028-04-20' },
  ], { 'field-2': 'Soybeans', 'field-3': 'Corn', 'field-4': 'Wheat' }, new AbortController().signal)
  assert.deepEqual(requests[0].fields.map(request => [request.fieldId, request.currentCrop]), [['field-2', 'soybeans']])
  const [mapped, unknown, nothing] = result.fields
  assert.deepEqual(nothing, { fieldId: 'field-4', status: 'unplannable', answer: 'Nothing planted' })
  assert.equal(mapped.status, 'planned')
  if (mapped.status === 'planned') assert.deepEqual([mapped.mappedStart, mapped.startCrop, mapped.answer], [true, 'Soybeans', 'Not sure'])
  assert.deepEqual(unknown, { fieldId: 'field-3', status: 'unplannable', answer: 'Mixed hay' })
})

test('no request is made when no field can be planned', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(catalog))
  const result = await fetchCropPlan([field], [{ ...answers[0], crop: 'Nothing planted' }], {}, new AbortController().signal)
  assert.equal(mock.mock.callCount(), 1)
  assert.equal(result.fields[0].status, 'unplannable')
})

test('planners that already return three alternatives are used in one request', async t => {
  const alternatives = ['Corn', 'Soybeans', 'Wheat'].map((crop, i) => ({ id: `rotation-${i}`, title: `Rotation ${i}`, summary: 'Example',
    years: years(Array(5).fill(crop)), benefits: ['Benefit'], tradeoff: 'Tradeoff' }))
  const mock = t.mock.method(globalThis, 'fetch', async (url: string) => url === '/api/crops' ? Response.json(catalog)
    : Response.json({ planner: 'random-placeholder', temporary: true, disclaimer: 'Random', plans: [{ fieldId: 'field-2', currentCrop: 'Corn', years: alternatives[0].years, alternatives }] }))
  const result = await fetchCropPlan([field], answers, {}, new AbortController().signal)
  assert.equal(mock.mock.callCount(), 2)
  const plan = result.fields[0]
  assert.ok(plan.status === 'planned' && plan.options.length === 3)
})

test('duplicated alternatives are rejected instead of appearing as different options', async t => {
  const option = { id: 'r', title: 'R', summary: '', years: years(Array(5).fill('Corn')), benefits: [], tradeoff: '' }
  t.mock.method(globalThis, 'fetch', async (url: string) => url === '/api/crops' ? Response.json(catalog)
    : Response.json({ planner: 'random-placeholder', temporary: true, disclaimer: '', plans: [{ fieldId: 'field-2', currentCrop: 'Corn', years: option.years, alternatives: [option, option, option] }] }))
  await assert.rejects(fetchCropPlan([field], answers, {}, new AbortController().signal), /three different rotations/)
})

test('incomplete responses and backend failures do not become displayed plans', async t => {
  for (const status of [200, 422, 503]) {
    const mock = t.mock.method(globalThis, 'fetch', async (url: string) => url === '/api/crops'
      ? Response.json(catalog)
      : Response.json({ planner: 'x', temporary: true, disclaimer: '', plans: [] }, { status }))
    await assert.rejects(fetchCropPlan([field], answers, {}, new AbortController().signal), status === 200 ? /incomplete plan/ : status === 422 ? /could not accept/ : /HTTP 503/)
    mock.mock.restore()
  }
})

test('the main crop is the most frequent, ties going to the earliest year', () => {
  assert.equal(mainCrop(years(['Wheat', 'Corn', 'Corn', 'Wheat', 'Soybeans'])), 'Wheat')
  assert.equal(mainCrop(years(['Wheat', 'Corn', 'Corn', 'Oats', 'Soybeans'])), 'Corn')
})
