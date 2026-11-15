import { Trash2 } from 'lucide-react'
import type { FieldFeature } from '../data/fields'
import FieldOutline from './FieldOutline'

type Props = {
  fields: FieldFeature[]
  highlightedId: string | null
  onLocate: (field: FieldFeature) => void
  onRemove: (id: string) => void
  onHighlight: (id: string | null) => void
}

/** Selected field identities and approximate areas, linked to the map. */
function SelectedFields({ fields, highlightedId, onLocate, onRemove, onHighlight }: Props) {
  return (
    <ul className='selected-fields-list' aria-label='Selected fields'>
      {fields.map((field, index) => {
        const p = field.properties
        const number = p.selectionNumber ?? index + 1
        return (
          <li key={p.id} className={highlightedId === p.id ? 'is-highlighted' : undefined}
            onMouseEnter={() => onHighlight(p.id)} onMouseLeave={() => onHighlight(null)}
            onFocus={() => onHighlight(p.id)} onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) onHighlight(null)
            }}>
            <button className='selected-field-locate' type='button' onClick={() => onLocate(field)} aria-label={`Show Field ${number} on map`}>
              <FieldOutline field={field} />
              <span className='selected-field-copy'>
                <strong>Field {number}</strong>
                <span>{p.areaAcres == null ? 'Area unavailable' : `About ${p.areaAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })} acres`}</span>
              </span>
            </button>
            <button className='button-secondary selected-field-remove' type='button' onClick={() => onRemove(p.id)} aria-label={`Remove Field ${number}`}>
              <Trash2 size={16} aria-hidden='true' />
              Remove
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default SelectedFields
