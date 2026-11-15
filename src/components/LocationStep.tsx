import { useState } from 'react'
import { LocateFixed, Map as MapIcon } from 'lucide-react'
import AddressSearch from './AddressSearch'
import { toLocation, type GeoLocation } from '../data/geocode'

type Props = { onLocated: (location: GeoLocation) => void }

const EXAMPLE_LOCATION: GeoLocation = {
  lat: 44.58,
  lng: -79.52,
  label: 'Example area near Orillia, Ontario',
}

/** Entry point for locating a farmer's land or exploring the available example area. */
function LocationStep({ onLocated }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser. Search for your address or a nearby town instead.')
      return
    }
    setBusy(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setBusy(false)
        onLocated({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      failure => {
        setBusy(false)
        setError(failure.code === 1
          ? 'Location access was declined. You can still search for an address or nearby town.'
          : 'We couldn’t find your location. Try an address or nearby town instead.')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <main className='location-step'>
      <div className='location-topline'>
        <ol className='location-steps' aria-label='Field planning steps'>
          <li aria-current='step'>1. Location</li>
          <li>2. Fields</li>
          <li>3. Crops</li>
        </ol>
      </div>

      <h2>Find your fields</h2>
      <p className='location-intro'>Search for your address or a nearby town. Then choose your fields on the map.</p>
      <p className='location-search-hint'>Address or town in Canada</p>
      <AddressSearch
        className='address-search--page'
        placeholder='For example, Orillia, Ontario'
        buttonLabel='Find fields'
        onPick={place => onLocated(toLocation(place))}
      />
      <button type='button' className='button-secondary location-geo' onClick={useMyLocation} disabled={busy}>
        <LocateFixed size={18} aria-hidden='true' />
        {busy ? 'Finding your location...' : 'Use my current location'}
      </button>
      {error && <p className='location-error' role='alert'>{error}</p>}

      <div className='location-example'>
        <button type='button' className='button-secondary' onClick={() => onLocated(EXAMPLE_LOCATION)}>
          <MapIcon size={18} aria-hidden='true' />
          Explore example fields
        </button>
        <p>Try the map near Orillia, Ontario, without entering a location.</p>
      </div>

    </main>
  )
}

export default LocationStep
