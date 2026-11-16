import type { ChatEvent, ChatProposal } from './chat'

export type Lookup = { callId: string; label: string; status: 'running' | 'ok' | 'error'; durationMs?: number }

export type AssistantMessage = {
  role: 'assistant'
  id: string
  text: string
  lookups: Lookup[]
  proposals: ChatProposal[]
  status: 'waiting' | 'streaming' | 'done' | 'error' | 'stopped'
  error?: string
  /** Set when the first model failed and another answered instead. */
  fallback?: string
}

export type UserMessage = { role: 'user'; id: string; text: string }
export type ChatMessage = UserMessage | AssistantMessage

export const emptyAssistant = (id: string): AssistantMessage =>
  ({ role: 'assistant', id, text: '', lookups: [], proposals: [], status: 'waiting' })

/** Applies one streamed event to the reply being written. Returns the same object when nothing changed. */
export function applyEvent(message: AssistantMessage, event: ChatEvent): AssistantMessage {
  switch (event.type) {
    case 'token':
      return { ...message, status: 'streaming', text: message.text + event.text }
    case 'tool_call':
      return { ...message, status: 'streaming', lookups: [...message.lookups, { callId: event.callId, label: event.label, status: 'running' }] }
    case 'tool_result':
      return {
        ...message,
        lookups: message.lookups.map(lookup => lookup.callId === event.callId
          ? { ...lookup, status: event.status, durationMs: event.durationMs }
          : lookup),
      }
    case 'proposal': {
      const proposal: ChatProposal = {
        proposalId: event.proposalId, fieldId: event.fieldId, title: event.title, summary: event.summary,
        plan: event.plan, planner: event.planner, temporary: event.temporary, disclaimer: event.disclaimer,
        reviewNotes: event.reviewNotes,
      }
      return { ...message, status: 'streaming', proposals: [...message.proposals, proposal] }
    }
    case 'fallback':
      return { ...message, fallback: 'The first assistant model did not respond, so a backup model answered.' }
    case 'error':
      return { ...message, status: 'error', error: event.message, lookups: settle(message.lookups) }
    case 'done':
      return { ...message, status: 'done', lookups: settle(message.lookups) }
    default:
      return message
  }
}

/** Lookups still running when a reply ends never finished; mark them as failed rather than leave them spinning. */
export const settle = (lookups: Lookup[]) => lookups.some(lookup => lookup.status === 'running')
  ? lookups.map(lookup => lookup.status === 'running' ? { ...lookup, status: 'error' as const } : lookup)
  : lookups

/** Words for what the assistant is doing right now, for the status line and screen readers. */
export function activityText(message: AssistantMessage) {
  const running = message.lookups.filter(lookup => lookup.status === 'running')
  if (running.length) return `${running[running.length - 1].label}…`
  if (message.status === 'waiting') return 'Thinking about your question…'
  return message.text ? 'Writing the answer…' : 'Reading the results…'
}
