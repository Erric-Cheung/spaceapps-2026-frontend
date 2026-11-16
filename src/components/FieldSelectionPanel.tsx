import { useState } from 'react'
import { ArrowRight, List } from 'lucide-react'
import type { FieldFeature } from '../data/fields'
import BackButton from './BackButton'
import SelectedFields from './SelectedFields'
import StepNav from './StepNav'

type Props = {
  fields: FieldFeature[]
  highlightedId: string | null
  onContinue: () => void
  onLocate: (field: FieldFeature) => void
  onRemove: (id: string) => void
  onHighlight: (id: string | null) => void
  onBack: () => void
}

/** Field selection guidance, a spatially linked list, and the next step. */
function FieldSelectionPanel({ fields, highlightedId, onContinue, onLocate, onRemove, onHighlight, onBack }: Props) {
  const [expanded, setExpanded] = useState(false)
  const count = fields.length
  const knownAreas = fields.filter(field => field.properties.areaAcres != null)
  const totalAcres = knownAreas.reduce((sum, field) => sum + field.properties.areaAcres!, 0)

  return (
    <div className={`selection-panel${expanded ? ' selection-panel--expanded' : ''}`}>
      <div className='selection-heading'>
        <div className='step-header'>
          <BackButton label='Back to location' onClick={onBack} />
          <StepNav current='fields' />
        </div>
        <h2 data-step-title='' tabIndex={-1}>Choose your fields</h2>
        <p>Select a field on the map. Select it again to remove it.</p>
      </div>

      <div className='selection-summary' id='selection-summary' aria-live='polite' aria-atomic='true'>
        <strong>{count === 0 ? 'No fields selected' : `${count} field${count === 1 ? '' : 's'} selected`}</strong>
        {count > 0 && <span>{knownAreas.length === 0 ? 'Area unavailable' : `About ${totalAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })} acres${knownAreas.length < count ? ' (known areas)' : ' in total'}`}</span>}
      </div>

      <button type='button' className='button-secondary selection-list-toggle' aria-expanded={expanded} aria-controls='selection-details' onClick={() => setExpanded(value => !value)}>
        <List size={16} aria-hidden='true' />
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
          <p>With a keyboard, move to the map, use the arrow keys to move it and plus or minus to zoom, then press Enter to select the field under the centre marker.</p>
          <p>Outlines are estimated field boundaries, not property lines.</p>
        </details>
      </div>

      <div className='selection-actions'>
        <button type='button' className='button-primary selection-continue' disabled={count === 0} aria-describedby={count === 0 ? 'selection-summary' : undefined} onClick={onContinue}>
          Continue to crop confirmation
          <ArrowRight size={18} aria-hidden='true' />
        </button>
      </div>
    </div>
  )
}

export default FieldSelectionPanel
