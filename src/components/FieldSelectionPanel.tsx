import { useState } from 'react'
import type { FieldFeature } from '../data/fields'
import SelectedFields from './SelectedFields'

type Props = {
  fields: FieldFeature[]
  highlightedId: string | null
  onContinue: () => void
  onLocate: (field: FieldFeature) => void
  onRemove: (id: string) => void
  onHighlight: (id: string | null) => void
}

/** Field selection guidance, a spatially linked list, and the next step. */
function FieldSelectionPanel({ fields, highlightedId, onContinue, onLocate, onRemove, onHighlight }: Props) {
  const [expanded, setExpanded] = useState(false)
  const count = fields.length
  const knownAreas = fields.filter(field => field.properties.areaAcres != null)
  const totalAcres = knownAreas.reduce((sum, field) => sum + field.properties.areaAcres!, 0)

  return (
    <div className={`selection-panel${expanded ? ' selection-panel--expanded' : ''}`}>
      <div className='selection-heading'>
        <ol className='selection-steps' aria-label='Field planning steps'>
          <li>1. Location</li><li aria-current='step'>2. Fields</li><li>3. Crops</li>
        </ol>
        <h2>Choose your fields</h2>
        <p>Select a field on the map. Select it again to remove it.</p>
      </div>

      <div className='selection-summary' aria-live='polite' aria-atomic='true'>
        <strong>{count === 0 ? 'No fields selected' : `${count} field${count === 1 ? '' : 's'} selected`}</strong>
        {count > 0 && <span>{knownAreas.length === 0 ? 'Area unavailable' : `About ${totalAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })} acres${knownAreas.length < count ? ' (known areas)' : ' in total'}`}</span>}
      </div>

      <button type='button' className='button-secondary selection-list-toggle' aria-expanded={expanded} aria-controls='selection-details' onClick={() => setExpanded(value => !value)}>
        {expanded ? 'Hide field list' : 'Show field list'}
      </button>

      <div className='selection-details' id='selection-details'>
        {count > 0 && <>
          <p className='selection-list-hint'>Choose a row to find that field on the map.</p>
          <SelectedFields fields={fields} highlightedId={highlightedId} onLocate={onLocate} onRemove={onRemove} onHighlight={onHighlight} />
        </>}
        <details className='field-help'>
          <summary>More ways to select</summary>
          <p>Drag to move the map. Zoom in to see field outlines.</p>
          <p>With a mouse, hold Shift and drag a box to select several fields at once.</p>
          <p>Outlines are estimated field boundaries, not property lines.</p>
        </details>
      </div>

      <div className='selection-actions'>
        <button type='button' className='selection-continue' disabled={count === 0} onClick={onContinue}>Continue to crop confirmation</button>
      </div>
    </div>
  )
}

export default FieldSelectionPanel
