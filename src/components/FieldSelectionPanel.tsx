import { useState } from 'react'

type Props = {
  selectedCount: number
  isLoadingPredictions: boolean
  error: string | null
  onPredict: () => void
}

function FieldSelectionPanel({ selectedCount, isLoadingPredictions, error, onPredict }: Props) {
  const [helpOpen, setHelpOpen] = useState(false)
  // Open automatically while nothing is selected; collapse on the first pick.
  const open = selectedCount === 0 || helpOpen

  return (
    <div className='map-panel'>
      <h3>Select your fields</h3>
      <details
        className='field-help'
        open={open}
        onToggle={e => { if (selectedCount > 0) setHelpOpen(e.currentTarget.open) }}
      >
        <summary>How to select</summary>
        <ol>
          <li>Drag the map to move around.</li>
          <li>Click a field to select it.</li>
          <li>Shift-drag to select several at once.</li>
        </ol>
      </details>

      <button type='button' disabled={selectedCount === 0 || isLoadingPredictions} onClick={onPredict}>
        {isLoadingPredictions
          ? 'Checking field history…'
          : selectedCount === 0
            ? 'Select at least one field'
            : `See predictions for ${selectedCount} field${selectedCount === 1 ? '' : 's'}`}
      </button>
      {error && <p className='location-error' role='alert'>{error}</p>}
    </div>
  )
}

export default FieldSelectionPanel
