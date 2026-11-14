import type { FieldFeature } from '../data/fields'

type Props = { fields: FieldFeature[] }

const fmt = (value: number | undefined, digits: number, unit = '') =>
  value === undefined ? '—' : `${value.toFixed(digits)}${unit}`

function SelectedFields({ fields }: Props) {
  if (fields.length === 0) return null

  const totalAcres = fields.reduce((sum, field) => sum + (field.properties.areaAcres ?? 0), 0)
  const totalHa = fields.reduce((sum, field) => sum + (field.properties.areaHa ?? 0), 0)

  return (
    <div className='selected-fields'>
      <div className='selected-fields-head'>
        <h3>Selected fields ({fields.length})</h3>
        <span className='selected-fields-total'>
          {totalAcres.toFixed(1)} ac
          {totalHa > 0 && ` · ${totalHa.toFixed(2)} ha`}
        </span>
      </div>

      <ul>
        {fields.map((field, index) => {
          const p = field.properties
          return (
            <li key={p.id}>
              <div className='selected-field-name'>Field {index + 1}</div>
              <dl className='selected-field-stats'>
                <div>
                  <dt>Area</dt>
                  <dd>
                    {fmt(p.areaAcres, 1, ' ac')}
                    {p.areaHa !== undefined && ` (${p.areaHa.toFixed(2)} ha)`}
                  </dd>
                </div>
                <div>
                  <dt>Perimeter</dt>
                  <dd>{fmt(p.perimeterM, 0, ' m')}</dd>
                </div>
                <div>
                  <dt>Width</dt>
                  <dd>{fmt(p.widthM, 0, ' m')}</dd>
                </div>
                <div>
                  <dt>Orientation</dt>
                  <dd>{fmt(p.orientationDeg, 0, '°')}</dd>
                </div>
              </dl>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default SelectedFields
