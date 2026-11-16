import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decodeBytes, defaultSeasonYear, EMPTY_SEASON, fetchFieldSeason, mergeSeason, pictureDays, seasonStory, startIndex,
  type FieldSeasonResponse, type SeasonPoint,
} from '../src/data/fieldSeason.ts'

const point = (sceneId: string, date: string, pixels = true, quality: SeasonPoint['quality'] = 'clear'): SeasonPoint => ({
  date, sceneId, sensor: 'Landsat', quality, description: '', ndvi: 0.5, p10: 0.4, p50: 0.5, p90: 0.6,
  clearShare: 1, cloudShare: 0, snowShare: 0, waterShare: 0, coverageShare: 1, validPixels: 10,
  pixels: pixels ? { rgb: `rgb-${sceneId}`, ndvi: 'n', clear: 'c' } : null,
})

const response = (points: SeasonPoint[], overrides: Partial<FieldSeasonResponse> = {}): FieldSeasonResponse => ({
  id: 'field', year: 2025, status: 'running', message: '', period: { start: '2025-01-01', end: '2025-12-31' },
  progress: { processed: 1, total: 10 },
  grid: { resolutionM: 30, fieldPixels: 4, samplePixels: 2, interiorOnly: true, tile: 'T17TPK', width: 2, height: 2, contextM: 150, fieldMask: 'mask', areaHa: 1 },
  points, segments: [], gaps: [],
  summary: { clearObservations: points.length, partialObservations: 0, otherObservations: 0, peakNdvi: 0.5, peakDate: null, latestNdvi: null, latestDate: null, longestGapDays: 0 },
  axisTicks: [0, 0.5, 1], notes: [], failedScenes: 0, error: null, observationCount: points.length, ...overrides,
})

test('polls the Java season route with pixels, since and an optional retry', async () => {
  const original = globalThis.fetch
  const calls: string[] = []
  globalThis.fetch = async url => { calls.push(String(url)); return Response.json(response([])) }
  try {
    await fetchFieldSeason('field/1', 2025, 12)
    await fetchFieldSeason('field/1', 2025, 0, true)
  } finally {
    globalThis.fetch = original
  }
  assert.deepEqual(calls, [
    '/api/fields/field%2F1/season?year=2025&pixels=true&since=12',
    '/api/fields/field%2F1/season?year=2025&pixels=true&since=0&retry=true',
  ])
})

test('rejects a failed season request', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response('nope', { status: 503 })
  try {
    await assert.rejects(fetchFieldSeason('field', 2025, 0), /503/)
  } finally {
    globalThis.fetch = original
  }
})

test('keeps pictures from earlier polls when later polls send only new ones', () => {
  const first = mergeSeason(EMPTY_SEASON, response([point('a', '2025-06-01'), point('b', '2025-06-10', false)]))
  const second = mergeSeason(first, response([
    { ...point('a', '2025-06-01'), pixels: null }, point('b', '2025-06-10', false), point('c', '2025-07-01'),
  ], { grid: { ...first.response!.grid!, fieldMask: null } }))
  assert.deepEqual(pictureDays(second).map(day => day.sceneId), ['a', 'c'])
  assert.equal(second.pictures.a.rgb, 'rgb-a')
  assert.equal(second.response?.grid?.fieldMask, 'mask')
})

test('starts on the greenest day, falling back to the latest picture', () => {
  const days = [point('a', '2025-06-01'), point('b', '2025-07-20'), point('c', '2025-09-01')]
  assert.equal(startIndex(days, '2025-07-20'), 1)
  assert.equal(startIndex(days, '2025-08-01'), 2)
  assert.equal(startIndex([], null), 0)
})

test('describes the season without diagnosing, and waits for enough pictures', () => {
  const days = ['06-01', '06-15', '07-01', '07-20', '08-10'].map((d, i) => point(String(i), `2025-${d}`))
  assert.deepEqual(seasonStory(response(days.slice(0, 2)), 2), [])
  const done = response(days, {
    status: 'done', summary: { ...response(days).summary, peakDate: '2025-07-20' },
    gaps: [{ start: '2025-01-01', end: '2025-03-01', days: 59 }, { start: '2025-08-10', end: '2025-08-30', days: 20 },
      { start: '2025-10-01', end: '2025-12-31', days: 91 }],
  })
  assert.deepEqual(seasonStory(done, 5), [
    'Satellites looked at this field on 5 days in 2025. 5 of those gave a picture clear enough to show.',
    'It looked greenest on July 20.',
    'The longest stretch without a clear look was 20 days, from August 10 to August 30. Anything that happened then is not shown.',
  ])
})

test('decodes base64 pixel bytes and picks the season with a growing period behind it', () => {
  assert.deepEqual([...decodeBytes('AAEC/w==')], [0, 1, 2, 255])
  assert.equal(defaultSeasonYear(new Date(2026, 3, 30)), 2025)
  assert.equal(defaultSeasonYear(new Date(2026, 4, 1)), 2026)
})
