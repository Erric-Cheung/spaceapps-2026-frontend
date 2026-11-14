import { useState } from 'react'
import AddressSearch from './AddressSearch'
import { toLocation, type GeoLocation } from '../data/geocode'

type Props = { onLocated: (location: GeoLocation) => void }

function LocationStep({ onLocated }: Props) {
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

  return (
    <section className='location-step'>
      <h2>Enter your location to get&nbsp;started</h2>
      <AddressSearch
        className='address-search--page'
        placeholder='City, address, or region'
        buttonLabel='Find fields'
        onPick={place => onLocated(toLocation(place))}
      />
      <button type='button' className='location-geo' onClick={useMyLocation} disabled={busy}>
        Use my location
      </button>
      {error && <p className='location-error' role='alert'>{error}</p>}
    </section>
  )
}

export default LocationStep
