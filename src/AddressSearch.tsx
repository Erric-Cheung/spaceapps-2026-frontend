import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { searchPlaces, type Place } from './data/geocode'

type Props = {
  /** Current map centre, so nearby matches rank first. */
  near: () => [number, number]
  onPick: (place: Place) => void
}

// Suggestions appear while typing; Enter picks the highlighted (or first) one.
export default function AddressSearch({ near, onPick }: Props) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const nearRef = useRef(near)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => { nearRef.current = near })

  async function search(text: string) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    try {
      const found = await searchPlaces(text, nearRef.current(), controller.signal)
      setPlaces(found)
      setActive(-1)
      setMessage(found.length ? null : `No matches for "${text}" in Canada. Check the spelling or try a nearby town.`)
      return found
    } catch {
      if (!controller.signal.aborted) setMessage('Search isn’t working right now. Try again in a moment.')
      return []
    }
  }

  const onType = (value: string) => {
    setQuery(value)
    setOpen(true)
    clearTimeout(timer.current)
    const text = value.trim()
    if (text.length < 3) { request.current?.abort(); setPlaces([]); setMessage(null); return }
    timer.current = setTimeout(() => { void search(text) }, 250)
  }

  useEffect(() => () => { clearTimeout(timer.current); request.current?.abort() }, [])

  const pick = (place: Place) => {
    clearTimeout(timer.current)
    request.current?.abort()
    setQuery(place.detail ? `${place.label}, ${place.detail}` : place.label)
    setOpen(false)
    setMessage(null)
    onPick(place)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const text = query.trim()
    if (!text) return
    if (places[active]) return pick(places[active])
    clearTimeout(timer.current)
    const found = places.length ? places : await search(text)
    if (found[0]) pick(found[0])
    else setOpen(true)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' && places.length) { e.preventDefault(); setOpen(true); setActive(i => (i + 1) % places.length) }
    else if (e.key === 'ArrowUp' && places.length) { e.preventDefault(); setActive(i => (i <= 0 ? places.length - 1 : i - 1)) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const showList = open && (places.length > 0 || message)

  return (
    <form className="address-search" role="search" onSubmit={submit}>
      <label htmlFor={`${listId}-input`} className="sr-only">Address or town</label>
      <div className="address-search-row">
        <input
          id={`${listId}-input`} type="search" value={query} placeholder="Address or town, like Orillia"
          autoComplete="off" role="combobox" aria-expanded={!!showList} aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={e => onType(e.target.value)}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}
        />
        <button type="submit">Search</button>
      </div>
      {showList && (
        <div className="address-search-results">
          {message && <p role="status">{message}</p>}
          {places.length > 0 && (
            <ul id={listId} role="listbox" aria-label="Matching places">
              {places.map((p, i) => (
                <li
                  key={p.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                  onMouseDown={e => { e.preventDefault(); pick(p) }} onMouseEnter={() => setActive(i)}
                >
                  <b>{p.label}</b>
                  {p.detail && <span>{p.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  )
}
