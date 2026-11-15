import assert from 'node:assert/strict'
import test from 'node:test'
import { createHistoryCache } from '../src/data/cropHistoryCache.ts'

const tick = () => new Promise(resolve => setImmediate(resolve))

test('history acquisition is bounded, deduplicated, and skips deselected queued fields', async () => {
  const original = globalThis.fetch
  const pending: Array<{ id: string; resolve: (response: Response) => void }> = []
  globalThis.fetch = async (_input, init) => new Promise<Response>(resolve => {
    pending.push({ id: JSON.parse(init!.body as string).ids[0], resolve })
  })
  try {
    const cache = createHistoryCache()
    cache.ensure(['a', 'b', 'c', 'd'])
    cache.ensure(['a', 'b', 'd'])
    assert.deepEqual(pending.map(request => request.id), ['a', 'b'])
    pending[0].resolve(Response.json({ results: [{ id: 'a', status: 'ok', history: {} }] }))
    await tick()
    assert.deepEqual(pending.map(request => request.id), ['a', 'b', 'd'])
    assert.equal(cache.getSnapshot().c, undefined)
    cache.ensure(['a', 'b', 'd'])
    assert.equal(pending.length, 3)
    for (const request of pending.slice(1)) request.resolve(Response.json({ results: [{ id: request.id, status: 'ok', history: {} }] }))
    await tick()
    cache.ensure(['a', 'b', 'd'])
    assert.equal(pending.length, 3)
    assert.equal(cache.getSnapshot().a.status, 'ready')
  } finally { globalThis.fetch = original }
})

test('provider failures can be retried without refetching successful fields', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    if (calls === 1) throw new Error('Provider unavailable')
    return Response.json({ results: [{ id: 'a', status: 'ok', history: {} }] })
  }
  try {
    const cache = createHistoryCache()
    cache.ensure(['a'])
    await tick()
    assert.equal(cache.getSnapshot().a.status, 'error')
    cache.ensure(['a'])
    assert.equal(calls, 1)
    cache.retry(['a'])
    await tick()
    assert.equal(cache.getSnapshot().a.status, 'ready')
    cache.retry(['a'])
    assert.equal(calls, 2)
  } finally { globalThis.fetch = original }
})
