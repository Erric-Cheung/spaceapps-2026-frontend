import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowUp, Square, Undo2, X } from 'lucide-react'
import { forgetConversation, streamChat, type ChatContext, type ChatProposal } from '../data/chat'
import { activityText, applyEvent, emptyAssistant, settle, type AssistantMessage, type ChatMessage } from '../data/chatThread'

type Props = {
  open: boolean
  onClose: () => void
  context: ChatContext
  /** One sentence saying what the assistant can see, e.g. "Field 1 and Field 2 near Lindsay." */
  contextSummary: string | null
  /** Display name for a field id, e.g. "Field 2". */
  fieldName: (fieldId: string) => string
  suggestions: string[]
}

type Cleared = { messages: ChatMessage[]; conversationId: string | null }

const MAX_LENGTH = 4000
let nextId = 0
const newId = () => `m${++nextId}`

/** Plain text for screen readers: the Markdown marks would otherwise be read aloud. */
const spoken = (markdown: string) => markdown.replace(/[*_`#>|]+/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()

const markdownComponents: Components = {
  a: ({ href, children }) => <a href={href} target='_blank' rel='noreferrer'>{children}</a>,
  table: ({ children }) => <div className='assistant-table'><table>{children}</table></div>,
}

/**
 * The field assistant: a conversation with the backend's AI, streamed as it is written.
 *
 * Opens as a modal dialog (a side sheet on wide screens, full screen on phones), so focus
 * stays inside it and Escape closes it. The conversation survives closing and reopening.
 * Each request carries what is on screen as `context`; the answer streams in as Markdown,
 * data lookups are shown in words while they run, and rotation proposals appear as plans.
 */
function AssistantPanel({ open, onClose, context, contextSummary, fieldName, suggestions }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const controller = useRef<AbortController | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [cleared, setCleared] = useState<Cleared | null>(null)
  const busy = messages.some(message => message.role === 'assistant' && (message.status === 'waiting' || message.status === 'streaming'))
  const current = messages.at(-1)?.role === 'assistant' ? messages.at(-1) as AssistantMessage : null

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      input.current?.focus()
    } else if (!open && element.open) {
      element.close()
    }
  }, [open])

  // Keep the newest text in view while it streams, unless the reader has scrolled up to read.
  useLayoutEffect(() => {
    if (pinned.current && log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages])

  useEffect(() => () => controller.current?.abort(), [])

  const send = async (text: string, history: ChatMessage[] = messages) => {
    const message = text.trim()
    if (!message || busy) return
    if (cleared?.conversationId) forgetConversation(cleared.conversationId)
    setCleared(null)
    // The reply is built here and copied into state after each event, so the final
    // version is known when the stream ends without waiting for React to render.
    let reply = emptyAssistant(newId())
    const show = (next: AssistantMessage) => {
      reply = next
      setMessages(previous => previous.map(item => item.id === next.id ? next : item))
    }
    setMessages([...history, { role: 'user', id: newId(), text: message }, reply])
    setDraft('')
    setAnnouncement('Thinking about your question.')
    pinned.current = true
    const abort = new AbortController()
    controller.current = abort
    try {
      await streamChat({ conversationId, message, context }, abort.signal, event => {
        if (event.type === 'meta') setConversationId(event.conversationId)
        if (event.type === 'tool_call') setAnnouncement(`${event.label}.`)
        show(applyEvent(reply, event))
      })
      if (reply.status !== 'done' && reply.status !== 'error') {
        show({ ...reply, status: 'error', error: 'The answer was cut off. Try again.' })
      }
    } catch (error) {
      if (abort.signal.aborted) {
        show({ ...reply, status: 'stopped', lookups: settle(reply.lookups) })
      } else {
        const text = error instanceof TypeError
          ? 'Could not reach the assistant. Check your connection and try again.'
          : error instanceof Error ? error.message : 'The assistant could not answer. Try again.'
        show({ ...reply, status: 'error', error: text, lookups: settle(reply.lookups) })
      }
    } finally {
      if (controller.current === abort) controller.current = null
      setAnnouncement(reply.status === 'done' ? `Answer: ${spoken(reply.text)}`
        : reply.status === 'stopped' ? 'Stopped.' : `The answer could not be finished. ${reply.error ?? ''}`)
    }
  }

  const retry = () => {
    const index = messages.findLastIndex(message => message.role === 'user')
    if (index < 0) return
    send(messages[index].text, messages.slice(0, index))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    send(draft)
  }

  // Enter sends on a keyboard; on touch screens Enter adds a line and the button sends.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !matchMedia('(pointer: coarse)').matches) {
      event.preventDefault()
      send(draft)
    }
  }

  const startNew = () => {
    controller.current?.abort()
    setCleared({ messages, conversationId })
    setMessages([])
    setConversationId(null)
    setAnnouncement('Started over.')
    input.current?.focus()
  }

  const undoClear = () => {
    if (!cleared) return
    setMessages(cleared.messages)
    setConversationId(cleared.conversationId)
    setCleared(null)
    setAnnouncement('Conversation restored.')
    input.current?.focus()
  }

  return (
    <dialog ref={dialog} className='assistant' aria-labelledby='assistant-title' onClose={onClose}>
      <div className='assistant-header'>
        <h2 id='assistant-title'>Ask about your fields</h2>
        {messages.length > 0 && <button type='button' className='assistant-text-button' onClick={startNew}>Start over</button>}
        <button type='button' className='assistant-close' aria-label='Close' onClick={onClose}>
          <X size={22} aria-hidden='true' />
        </button>
      </div>

      <div
        className='assistant-log'
        ref={log}
        tabIndex={0}
        aria-label='Conversation'
        onScroll={event => {
          const element = event.currentTarget
          pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48
        }}
      >
        <p className='assistant-context'>
          {contextSummary
            ? <>The assistant can see {contextSummary}</>
            : <>Pick a location and some fields first, and the assistant can answer about them. General farming questions work any time.</>}
        </p>

        {cleared && <p className='assistant-undo'>
          Started over.{' '}
          <button type='button' className='assistant-text-button' onClick={undoClear}><Undo2 size={16} aria-hidden='true' />Undo</button>
        </p>}

        {messages.length === 0 && <div className='assistant-empty'>
          <p id='assistant-suggestions-label'>You could ask:</p>
          <ul aria-labelledby='assistant-suggestions-label'>
            {suggestions.map(text => <li key={text}>
              <button type='button' className='assistant-suggestion' onClick={() => send(text)}>{text}</button>
            </li>)}
          </ul>
          <details className='assistant-about'>
            <summary>About the assistant</summary>
            <p>
              It answers using this app's data: field outlines, crop history from satellite crop maps, soil surveys,
              weather records, seasonal outlooks and market prices. It runs the same rotation planner as the Results step.
              Every lookup it makes is listed with its answer.
            </p>
            <p>
              It can still be wrong. Check anything important with your own records or an agronomist.
              Nothing you ask is saved to your fields, and the conversation is forgotten when the server restarts.
            </p>
          </details>
        </div>}

        <ol className='assistant-messages'>
          {messages.map(message => message.role === 'user'
            ? <li key={message.id} className='assistant-message assistant-message--user'>
              <span className='sr-only'>You asked: </span>{message.text}
            </li>
            : <li key={message.id} className='assistant-message'>
              <span className='sr-only'>Assistant: </span>
              <Reply message={message} fieldName={fieldName} onRetry={retry} />
            </li>)}
        </ol>
      </div>

      <p className='sr-only' role='status' aria-live='polite'>{announcement}</p>

      <form className='assistant-compose' onSubmit={submit}>
        {current && busy && <p className='assistant-activity' aria-hidden='true'>{activityText(current)}</p>}
        <div className='assistant-compose-row'>
          <label htmlFor='assistant-input' className='sr-only'>Your question</label>
          <textarea
            id='assistant-input'
            ref={input}
            rows={1}
            maxLength={MAX_LENGTH}
            value={draft}
            placeholder='Ask a question'
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            enterKeyHint='send'
          />
          {busy
            ? <button type='button' className='button-secondary assistant-send' onClick={() => controller.current?.abort()}>
              <Square size={16} aria-hidden='true' />Stop
            </button>
            : <button type='submit' className='button-primary assistant-send' disabled={!draft.trim()}>
              <ArrowUp size={18} aria-hidden='true' />Send
            </button>}
        </div>
      </form>
    </dialog>
  )
}

/** One assistant reply: lookups made, the streamed answer, any plans, and how it ended. */
function Reply({ message, fieldName, onRetry }: { message: AssistantMessage; fieldName: (id: string) => string; onRetry: () => void }) {
  return <>
    {message.lookups.length > 0 && <details className='assistant-lookups'>
      <summary>
        {message.lookups.length === 1 ? '1 lookup' : `${message.lookups.length} lookups`}
        {message.lookups.some(lookup => lookup.status === 'error') ? ', some failed' : ''}
      </summary>
      <ul>
        {message.lookups.map(lookup => <li key={lookup.callId}>
          {lookup.label}
          <span className='assistant-lookup-state'>
            {lookup.status === 'running' ? 'working' : lookup.status === 'error' ? 'failed'
              : `${((lookup.durationMs ?? 0) / 1000).toFixed(1)} s`}
          </span>
        </li>)}
      </ul>
    </details>}

    {message.text && <div className='assistant-answer'>
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents} skipHtml>{message.text}</Markdown>
    </div>}

    {message.proposals.map(proposal => <Proposal key={proposal.proposalId} proposal={proposal} fieldName={fieldName} />)}

    {message.fallback && <p className='assistant-note'>{message.fallback}</p>}
    {message.status === 'stopped' && <p className='assistant-note'>Stopped before the answer was finished.</p>}
    {message.status === 'error' && <div className='assistant-error'>
      <p>{message.error}</p>
      <button type='button' className='button-secondary' onClick={onRetry}>Try again</button>
    </div>}
  </>
}

/** A rotation the assistant worked out with the planner. Nothing is saved; it is shown for comparison. */
function Proposal({ proposal, fieldName }: { proposal: ChatProposal; fieldName: (id: string) => string }) {
  const titleId = `proposal-${proposal.proposalId}`
  return (
    <section className='assistant-proposal' aria-labelledby={titleId}>
      <h3 id={titleId}>{proposal.title || `Rotation for ${fieldName(proposal.fieldId)}`}</h3>
      <p className='assistant-proposal-field'>
        {proposal.title?.includes(fieldName(proposal.fieldId)) ? 'Starting' : `${fieldName(proposal.fieldId)}, starting`} after {proposal.plan.currentCrop.toLowerCase()}
      </p>
      {/* A summary that only spells out the sequence repeats the year list below. */}
      {proposal.summary && !proposal.summary.includes('→') && <p>{proposal.summary}</p>}
      <ol className='results-years assistant-years' aria-label='Crop for each year'>
        {proposal.plan.years.map(year => <li key={year.year}><span>{year.year}</span><strong>{year.crop}</strong></li>)}
      </ol>
      {(proposal.reviewNotes?.length || proposal.disclaimer) && <details className='assistant-proposal-notes'>
        <summary>Notes on this plan</summary>
        {proposal.reviewNotes?.length ? <ul>{proposal.reviewNotes.map(note => <li key={note}>{note}</li>)}</ul> : null}
        {proposal.disclaimer && <p>{proposal.disclaimer}</p>}
      </details>}
    </section>
  )
}

export default AssistantPanel
