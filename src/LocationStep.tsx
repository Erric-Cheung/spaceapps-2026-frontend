import { useState, type FormEvent } from 'react'
import { geocode, type GeoLocation } from './data/geocode'

type Props = { onLocated: (location: GeoLocation) => void }

function LocationStep({ onLocated }: Props) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support geolocation.')
      return
    }
    setBusy(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setBusy(false)
        onLocated({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setBusy(false)
        setError('Could not get your location. Check permissions and try again.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setBusy(true)
    setError(null)
    try {
      onLocated(await geocode(q))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find that location.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className='location-step'>
      <h2>Where are your fields?</h2>
      <form onSubmit={submit}>
        <input
          type='text'
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='City, address, or region'
          aria-label='Location'
        />
        <button type='submit' disabled={busy}>Find fields</button>
      </form>
      <button type='button' className='location-geo' onClick={useMyLocation} disabled={busy}>
        Use my location
      </button>
      {error && <p className='location-error' role='alert'>{error}</p>}
    </section>
  )
}

export default LocationStep
