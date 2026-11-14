import { useState } from 'react'
import './App.css'
import Map from './Map.tsx'
import FieldDataForm from './FieldDataForm.tsx'
import type { FieldFeature } from './data/fields'

function App() {
  const [selectedFields, setSelectedFields] = useState<FieldFeature[]>([])

  return (
    <>
      <h1>Money Stealer</h1>
      <Map onChange={setSelectedFields} />
      <FieldDataForm fields={selectedFields} />
    </>
  )
}

export default App
