import { useState, type FormEvent } from 'react'
import type { FieldFeature } from '../data/fields'
import type { CropHistoryResult, CropHistoryResponse, FieldHistory } from '../data/cropHistory'
import { crops } from '../data/crops'
import FieldOutline from './FieldOutline'

type Props = {
  fields: FieldFeature[]
  history: CropHistoryResponse | null
  loadingHistory: number
  failedHistory: number
  onRetryHistory: () => void
  onClose: () => void
  onSubmit?: (fieldInputs: { fieldId: string; crop: string; readyDate: string }[]) => void
}

type FieldInput = { crop: string; readyDate: string }

const BLANK_FIELD_INPUT: FieldInput = { crop: '', readyDate: '' }
const isComplete = (input: FieldInput) => input.crop !== '' && input.readyDate !== ''

/** The most recent years of crop history, newest first. */
function recentYears(history: FieldHistory, count = 5) {
  return [...history.years].sort((a, b) => b.year - a.year).slice(0, count)
}

function FieldReviewForm({ fields, history, loadingHistory, failedHistory, onRetryHistory, onClose, onSubmit }: Props) {
  const [fieldInputs, setFieldInputs] = useState<Record<string, FieldInput>>(
    () => Object.fromEntries(fields.map(field => [field.properties.id, { ...BLANK_FIELD_INPUT }])),
  )

  const resultsById = new Map<string, CropHistoryResult>(
    (history?.results ?? []).map(result => [result.id, result]),
  )
  const historyNote = [...resultsById.values()].find(result => result.history?.note)?.history?.note
  // "The newest crop map is 2025 (last season)…": the same for every field, so shown once.
  const mapNote = [...resultsById.values()].find(result => result.history?.summary?.notes.length)?.history?.summary?.notes[0]

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
              Choose the crop currently growing in each field and the date it will be ready to plant something new. Crop maps are estimates for you to check. All fields are required.
            </p>
            {loadingHistory > 0 && <p role='status'>Loading crop history for {loadingHistory} field{loadingHistory === 1 ? '' : 's'}. You can enter crops now.</p>}
            {failedHistory > 0 && <p role='status'>History is unavailable for {failedHistory} field{failedHistory === 1 ? '' : 's'}. You can still enter crops. <button type='button' className='history-retry' onClick={onRetryHistory}>Retry history</button></p>}
            {(mapNote || historyNote) && (
              <p className='form-history-note'>{[mapNote, historyNote].filter(Boolean).join(' ')}</p>
            )}
          </div>
        </div>

        <div className='field-form-container'>
          {fields.map((field, index) => {
            const id = field.properties.id
            const input = fieldInputs[id] ?? BLANK_FIELD_INPUT
            const fieldHistory = resultsById.get(id)?.history
            const summary = fieldHistory?.summary
            const expected = summary?.expectedThisYear
            const lastYear = summary?.lastSeason?.year
            return (
              <fieldset key={id} className='field-card'>
                <legend>Field {field.properties.selectionNumber ?? index + 1}</legend>
                <div className='review-field-identity'><FieldOutline field={field} /><span>{field.properties.areaAcres == null ? 'Area unavailable' : `About ${field.properties.areaAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })} acres`}</span></div>

                {fieldHistory && (
                  <div className='field-history'>
                    <p className='field-history-summary'>
                      {summary && summary.firstYear !== null && lastYear
                        ? `${summary.yearsOfData} years of crop maps, ${summary.firstYear}–${lastYear}`
                        : `${fieldHistory.years.length} years of crop maps`}
                    </p>
                    {summary?.pattern && <p className='field-history-pattern'>{summary.pattern.text}</p>}
                    <ul className='field-history-years'>
                      {recentYears(fieldHistory).map(year => (
                        <li key={year.year}>
                          <span>{year.year === lastYear ? `${year.year}, last season` : year.year}</span>
                          <b>{year.groupLabel ?? year.crop}</b>
                        </li>
                      ))}
                    </ul>
                    {summary?.notes.slice(1).map(note => (
                      <p key={note} className='field-history-flag'>{note}</p>
                    ))}
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
                  {summary && (
                    <span className='field-crop-hint'>
                      {expected
                        ? `The rotation suggests ${expected.crop.toLowerCase()} for ${expected.year} (${expected.confidence} confidence). Please confirm what actually grows here.`
                        : "We couldn't estimate this year's crop, so please choose it."}
                    </span>
                  )}
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
