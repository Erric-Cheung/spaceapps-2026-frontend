import type { Geometry } from 'geojson'
import type { PlannedYear } from './cropPlanning'

/** What the farmer is looking at, so "this field" needs no explanation. Never shown to the model directly. */
export type ChatContext = {
  selectedFieldId?: string
  fields?: { fieldId: string; name: string; currentCrop?: string; geometry: Geometry }[]
  location?: { lat: number; lon: number }
  provinceCode?: string
  growableCrops?: string[]
}

export type ChatRequest = { conversationId: string | null; message: string; context: ChatContext }

export type ChatProposal = {
  proposalId: string
  fieldId: string
  title: string
  summary: string
  plan: { fieldId: string; currentCrop: string; years: PlannedYear[]; totalSoilScore?: number; totalIncome?: number }
  planner: string
  temporary: boolean
  disclaimer: string
  reviewNotes?: string[]
}

/** One server-sent event from POST /chat/stream; `type` matches the SSE event name. */
export type ChatEvent =
  | { type: 'meta'; conversationId: string }
  | { type: 'model'; model: string; attempt: number }
  | { type: 'fallback'; failedModel: string; reason: string; nextModel: string }
  | { type: 'token'; text: string }
  | { type: 'tool_call'; callId: string; tool: string; label: string }
  | { type: 'tool_result'; callId: string; tool: string; status: 'ok' | 'error'; durationMs: number; message?: string }
  | ({ type: 'proposal' } & ChatProposal)
  | { type: 'error'; code: string; message: string }
  | { type: 'done'; conversationId: string; model: string; finishReason?: string }

/**
 * Incremental parser for a text/event-stream body. Feed it decoded text in any chunk sizes;
 * it returns the events completed so far and keeps the unfinished tail for the next chunk.
 */
export function createSseParser() {
  let buffer = ''
  return (chunk: string): ChatEvent[] => {
    buffer += chunk.replace(/\r\n?/g, '\n')
    const events: ChatEvent[] = []
    let end: number
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const data = block.split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).replace(/^ /, ''))
        .join('\n')
      if (!data) continue
      try {
        events.push(JSON.parse(data) as ChatEvent)
      } catch {
        // A malformed event is skipped; the stream still ends with done or error.
      }
    }
    return events
  }
}

const HTTP_MESSAGES: Record<number, string> = {
  404: 'The assistant is not available on this server yet.',
  422: 'That message is empty or too long. Shorten it and try again.',
}

/**
 * Sends a message to POST /api/chat/stream and calls `onEvent` for each event as it arrives.
 * Resolves when the stream closes. Throws on network or HTTP errors; an `error` event is
 * delivered through `onEvent` like any other.
 */
export async function streamChat(request: ChatRequest, signal: AbortSignal, onEvent: (event: ChatEvent) => void) {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok || !response.body) {
    throw new Error(HTTP_MESSAGES[response.status] ?? `The assistant could not answer (HTTP ${response.status}). Try again in a moment.`)
  }
  const parse = createSseParser()
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    for (const event of parse(value)) onEvent(event)
  }
  for (const event of parse('\n\n')) onEvent(event)
}

/** Asks the backend to forget a conversation. Failures are ignored: memory expires on its own. */
export function forgetConversation(conversationId: string) {
  fetch(`/api/chat/${encodeURIComponent(conversationId)}`, { method: 'DELETE', keepalive: true }).catch(() => {})
}
