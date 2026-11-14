import { useState, type FormEvent } from 'react'
import type { FieldFeature } from '../data/fields'
import type { CropHistoryResult, CropHistoryResponse, FieldHistory } from '../data/cropHistory'
import { crops } from '../data/crops'

type Props = {
  fields: FieldFeature[]
  history: CropHistoryResponse | null
  onClose: () => void
  onSubmit?: (fieldInputs: { fieldId: string; crop: string; readyDate: string }[]) => void
}

type FieldInput = { crop: string; readyDate: string }

const BLANK_FIELD_INPUT: FieldInput = { crop: '', readyDate: '' }
const isComplete = (input: FieldInput) => input.crop !== '' && input.readyDate !== ''

/** Most recent crop recorded for the field, if the history has one. */
function latestCrop(history?: FieldHistory): string {
  const cropYears = history?.years.filter(year => year.isCrop && year.crop) ?? []
  if (cropYears.length === 0) return ''
  return cropYears.reduce((latest, year) => (year.year > latest.year ? year : latest)).crop
}

/** Map a history crop name onto one of our dropdown options, else keep it as-is. */
function matchCrop(name: string): string {
  const lower = name.toLowerCase()
  return crops.find(crop => lower.includes(crop.toLowerCase())) ?? name
}

function buildInitialInputs(
  fields: FieldFeature[],
  history: CropHistoryResponse | null,
): Record<string, FieldInput> {
  const resultsById = new Map<string, CropHistoryResult>(
    (history?.results ?? []).map(result => [result.id, result]),
  )
  const inputs: Record<string, FieldInput> = {}
  for (const field of fields) {
    const fieldHistory = resultsById.get(field.properties.id)?.history
    inputs[field.properties.id] = { crop: matchCrop(latestCrop(fieldHistory)), readyDate: '' }
  }
  return inputs
}

/** The most recent years of crop history, newest first. */
function recentYears(history: FieldHistory, count = 5) {
  return [...history.years].sort((a, b) => b.year - a.year).slice(0, count)
}

function FieldReviewForm({ fields, history, onClose, onSubmit }: Props) {
  const [fieldInputs, setFieldInputs] = useState<Record<string, FieldInput>>(
    () => buildInitialInputs(fields, history),
  )

  const resultsById = new Map<string, CropHistoryResult>(
    (history?.results ?? []).map(result => [result.id, result]),
  )
  const hasHistory = [...resultsById.values()].some(result => result.history)
  const historyNote = [...resultsById.values()].find(result => result.history?.note)?.history?.note

  const update = (id: string, patch: Partial<FieldInput>) =>
    setFieldInputs(prev => ({
      ...prev,
      [id]: { ...BLANK_FIELD_INPUT, ...prev[id], ...patch },
    }))

  const allComplete =
    fields.length > 0 &&
    fields.every(field => isComplete(fieldInputs[field.properties.id] ?? BLANK_FIELD_INPUT))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!allComplete) return
    onSubmit?.(
      fields.map(field => {
        const id = field.properties.id
        const input = fieldInputs[id] ?? BLANK_FIELD_INPUT
        return { fieldId: id, crop: input.crop, readyDate: input.readyDate }
      }),
    )
  }

  return (
    <form className='field-review-form' onSubmit={submit}>
      <div className='field-form-scroll'>
        <div className='form-field-header'>
          <div className='form-header-copy'>
            <div className='form-heading'>
              <h2>Tell us about each field</h2>
              <button type='button' className='form-close' aria-label='Close field details' onClick={onClose}>
                <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' aria-hidden='true'>
                  <path d='m6 6 12 12M6 18 18 6' />
                </svg>
              </button>
            </div>
            <p>
              {hasHistory
                ? 'We pre-filled each field from satellite crop history. Check the crop, add the date the field will be ready to plant something new, and adjust anything that looks wrong.'
                : 'Choose the crop currently growing in each field and the date it will be ready to plant something new.'}{' '}
              All fields are required.
            </p>
            {historyNote && <p className='form-history-note'>{historyNote}</p>}
          </div>
        </div>

        <div className='field-form-container'>
          {fields.map((field, index) => {
            const id = field.properties.id
            const input = fieldInputs[id] ?? BLANK_FIELD_INPUT
            const fieldHistory = resultsById.get(id)?.history
            return (
              <fieldset key={id} className='field-card'>
                <legend>Field {index + 1}</legend>

                {fieldHistory && (
                  <div className='field-history'>
                    <p className='field-history-summary'>
                      {fieldHistory.cropYears} years of satellite data ·{' '}
                      {fieldHistory.distinctCrops.length} crops seen
                    </p>
                    <ul className='field-history-years'>
                      {recentYears(fieldHistory).map(year => (
                        <li key={year.year}>
                          <span>{year.year}</span>
                          <b>{year.crop}</b>
                        </li>
                      ))}
                    </ul>
                    <p className='field-history-source'>
                      {fieldHistory.source.name} · {fieldHistory.source.resolutionM} m
                    </p>
                  </div>
                )}

                <label>
                  Current crop
                  <select
                    required
                    value={input.crop}
                    onChange={e => update(id, { crop: e.target.value })}
                  >
                    <option value=''>Select a crop</option>
                    {input.crop && !crops.includes(input.crop) && (
                      <option value={input.crop}>{input.crop}</option>
                    )}
                    {crops.map(crop => (
                      <option key={crop} value={crop}>{crop}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Ready to plant new seeds
                  <input
                    type='date'
                    required
                    value={input.readyDate}
                    onChange={e => update(id, { readyDate: e.target.value })}
                  />
                </label>
              </fieldset>
            )
          })}
        </div>
      </div>

      <div className='form-actions'>
        <button type='submit' className='form-submit' disabled={!allComplete}>
          Get crop rotation suggestions
        </button>
      </div>
    </form>
  )
}

export default FieldReviewForm
