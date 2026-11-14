import { useState } from 'react'

type Props = {
  count: number
  predicting: boolean
  error: string | null
  onPredict: () => void
}

function FieldSelectionPanel({ count, predicting, error, onPredict }: Props) {
  const [helpOpen, setHelpOpen] = useState(false)
  // Open automatically while nothing is selected; collapse on the first field selection.
  const open = count === 0 || helpOpen

  return (
    <div className='map-panel'>
      <h3>Select your fields</h3>
      <details
        className='field-help'
        open={open}
        onToggle={e => { if (count > 0) setHelpOpen(e.currentTarget.open) }}
      >
        <summary>How to select</summary>
        <ol>
          <li>Drag the map to move around.</li>
          <li>Click a field to select it.</li>
          <li>Shift-drag to select several at once.</li>
        </ol>
      </details>

      <button type='button' disabled={count === 0 || predicting} onClick={onPredict}>
        {predicting
          ? 'Checking field history…'
          : count === 0
            ? 'Select at least one field'
            : `See predictions for ${count} field${count === 1 ? '' : 's'}`}
      </button>
      {error && <p className='location-error' role='alert'>{error}</p>}
    </div>
  )
}

export default FieldSelectionPanel
