import assert from 'node:assert/strict'
import test from 'node:test'
import { createSseParser, streamChat, type ChatEvent } from '../src/data/chat.ts'
import { activityText, applyEvent, emptyAssistant } from '../src/data/chatThread.ts'

const sse = (event: ChatEvent) => `event:${event.type}\ndata:${JSON.stringify(event)}\n\n`

test('events split across chunks at any point are parsed once, in order', () => {
  const body = sse({ type: 'meta', conversationId: 'c1' }) + sse({ type: 'token', text: 'Hello\nthere' }) + sse({ type: 'done', conversationId: 'c1', model: 'm' })
  for (let size = 1; size <= body.length; size += 7) {
    const parse = createSseParser()
    const events: ChatEvent[] = []
    for (let i = 0; i < body.length; i += size) events.push(...parse(body.slice(i, i + size)))
    assert.deepEqual(events.map(event => event.type), ['meta', 'token', 'done'], `chunk size ${size}`)
    assert.equal((events[1] as { text: string }).text, 'Hello\nthere')
  }
})

test('CRLF line endings, comments and a space after "data:" are accepted', () => {
  const parse = createSseParser()
  const events = parse(': keep-alive\r\n\r\nevent: token\r\ndata: {"type":"token","text":"a"}\r\n\r\n')
  assert.deepEqual(events, [{ type: 'token', text: 'a' }])
})

test('a streamed reply collects text, lookups and proposals, then finishes', () => {
  let reply = emptyAssistant('r')
  assert.equal(activityText(reply), 'Thinking about your question…')
  reply = applyEvent(reply, { type: 'tool_call', callId: 't1', tool: 'getFieldSoil', label: 'Checking the soil' })
  assert.equal(activityText(reply), 'Checking the soil…')
  reply = applyEvent(reply, { type: 'tool_result', callId: 't1', tool: 'getFieldSoil', status: 'ok', durationMs: 1200 })
  reply = applyEvent(reply, { type: 'token', text: 'Loam ' })
  reply = applyEvent(reply, { type: 'token', text: 'soil.' })
  reply = applyEvent(reply, { type: 'done', conversationId: 'c', model: 'm' })
  assert.equal(reply.text, 'Loam soil.')
  assert.equal(reply.status, 'done')
  assert.deepEqual(reply.lookups, [{ callId: 't1', label: 'Checking the soil', status: 'ok', durationMs: 1200 }])
})

test('lookups still running when the reply fails are marked failed', () => {
  let reply = applyEvent(emptyAssistant('r'), { type: 'tool_call', callId: 't1', tool: 'x', label: 'Looking' })
  reply = applyEvent(reply, { type: 'error', code: 'timeout', message: 'Too slow.' })
  assert.equal(reply.status, 'error')
  assert.equal(reply.error, 'Too slow.')
  assert.equal(reply.lookups[0].status, 'error')
})

test('streamChat posts the request and delivers each event as it arrives', async t => {
  const events = [sse({ type: 'meta', conversationId: 'c1' }), sse({ type: 'token', text: 'Hi' }), sse({ type: 'done', conversationId: 'c1', model: 'm' })]
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, '/api/chat/stream')
    assert.deepEqual(JSON.parse(init.body as string), { conversationId: null, message: 'Hello', context: { provinceCode: 'ON' } })
    const encoder = new TextEncoder()
    return new Response(new ReadableStream({ start(controller) { events.forEach(e => controller.enqueue(encoder.encode(e))); controller.close() } }))
  })
  const seen: string[] = []
  await streamChat({ conversationId: null, message: 'Hello', context: { provinceCode: 'ON' } }, new AbortController().signal, event => seen.push(event.type))
  assert.deepEqual(seen, ['meta', 'token', 'done'])
})

test('HTTP errors become plain sentences', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }))
  await assert.rejects(streamChat({ conversationId: null, message: 'x', context: {} }, new AbortController().signal, () => {}),
    /not available on this server yet/)
})
