import { useState } from 'react'
import Map from './Map.tsx'
import FieldDataForm from './FieldDataForm.tsx'
import LocationStep from './LocationStep.tsx'
import type { FieldFeature } from './data/fields'
import type { GeoLocation } from './data/geocode'

function App() {
  const [selectedFields, setSelectedFields] = useState<FieldFeature[]>([])
  const [location, setLocation] = useState<GeoLocation | null>(null)

  return (
    <>
      <h1>Money Stealer</h1>
      {location ? (
        <>
          <Map
            key={`${location.lat},${location.lng}`}
            location={location}
            onChange={setSelectedFields}
          />
          <FieldDataForm fields={selectedFields} />
        </>
      ) : (
        <LocationStep onLocated={setLocation} />
      )}
    </>
  )
}

export default App
