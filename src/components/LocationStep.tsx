import { useState } from 'react'
import { LocateFixed, Map as MapIcon } from 'lucide-react'
import AddressSearch from './AddressSearch'
import StepNav from './StepNav'
import { toLocation, type GeoLocation } from '../data/geocode'
import { nearestCity } from '../data/nearestCity'

type Props = { onLocated: (location: GeoLocation) => void }

/** A point with no address is named after the nearest city, e.g. "Orillia, Ontario". */
const named = (lat: number, lng: number): GeoLocation => {
  const city = nearestCity(lat, lng)
  return { lat, lng, label: city ? `${city}, Ontario` : undefined }
}

const EXAMPLE_LOCATION = named(44.58, -79.52)

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
        onLocated(named(pos.coords.latitude, pos.coords.longitude))
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
      <div className='step-header location-topline'>
        <StepNav current='location' />
      </div>

      <h2 data-step-title='' tabIndex={-1}>Find your fields</h2>
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
