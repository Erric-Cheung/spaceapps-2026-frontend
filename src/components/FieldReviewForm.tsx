import { lazy, Suspense, useState, type FormEvent } from 'react'
import type { FieldFeature } from '../data/fields'
import type { CropHistoryResponse } from '../data/cropHistory'
import { crops } from '../data/crops'
import type { HistoryEntry } from '../data/cropHistoryCache'
import { canConfirm, cropAnswer, EMPTY_REVIEW, OTHER_CROP, NO_CROP, UNKNOWN_CROP, type FieldReviewInput } from '../data/fieldReview'
import FieldOutline from './FieldOutline'

const FieldImagerySlider = lazy(() => import('./FieldImagerySlider'))

type Props = {
  fields: FieldFeature[]
  history: CropHistoryResponse | null
  historyEntries: Record<string, HistoryEntry>
  inputs: Record<string, FieldReviewInput>
  onUpdate: (id: string, input: FieldReviewInput) => void
  onRetryHistory: () => void
  onClose: () => void
  onSubmit?: (fieldInputs: { fieldId: string; crop: string; readyDate: string }[]) => void
}

/** One field at a time: mapped evidence, the farmer's answer, and explicit confirmation. */
function FieldReviewForm({ fields, history, historyEntries, inputs, onUpdate, onRetryHistory, onClose, onSubmit }: Props) {
  const [activeId, setActiveId] = useState(fields[0]?.properties.id ?? '')
  const activeIndex = Math.max(0, fields.findIndex(field => field.properties.id === activeId))
  const field = fields[activeIndex]
  const confirmedCount = fields.filter(field => inputs[field.properties.id]?.confirmed).length
  const allConfirmed = fields.length > 0 && confirmedCount === fields.length

  if (!field) return <div className='review-empty'><p>No fields selected.</p><button type='button' className='button-secondary' onClick={onClose}>Back to field selection</button></div>

  const id = field.properties.id
  const input = inputs[id] ?? EMPTY_REVIEW
  const result = history?.results.find(result => result.id === id)
  const fieldHistory = result?.history
  const historyFailed = historyEntries[id]?.status === 'error'
  const summary = fieldHistory?.summary
  const latest = summary?.latestMapped
  const suggestion = summary?.currentCrop
  const suggestedCrop = suggestion?.crop
  const year = summary?.reviewYear
  const options = [...new Set([...crops, ...[suggestedCrop, input.crop].filter((crop): crop is string => typeof crop === 'string' && crop.length > 0 && !crop.startsWith('__'))])]
  const number = field.properties.selectionNumber ?? activeIndex + 1
  const slots = summary?.recentYears ?? []
  const update = (patch: Partial<FieldReviewInput>) => onUpdate(id, { ...input, ...patch, confirmed: false })
  const confirm = () => {
    if (!canConfirm(input)) return
    onUpdate(id, { ...input, confirmed: true })
    const ordered = [...fields.slice(activeIndex + 1), ...fields.slice(0, activeIndex)]
    const next = ordered.find(candidate => !inputs[candidate.properties.id]?.confirmed)
    if (next) setActiveId(next.properties.id)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!allConfirmed) return
    onSubmit?.(fields.map(field => {
      const input = inputs[field.properties.id]
      return { fieldId: field.properties.id, crop: cropAnswer(input), readyDate: input.readyDate }
    }))
  }

  return (
    <form className='field-review-form' onSubmit={submit}>
      <div className='review-heading'>
        <div className='review-topline'>
          <button className='button-secondary review-back' type='button' onClick={onClose}>Back to field selection</button>
          <ol className='review-steps' aria-label='Field planning steps'><li>1. Location</li><li>2. Fields</li><li aria-current='step'>3. Crops</li></ol>
        </div>
        <div className='review-title-row'>
          <div><h2>Confirm your crops</h2><p>Check each field against your records. Change anything that looks wrong.</p></div>
          <div className='review-progress' role='status'>
            <span>{confirmedCount} of {fields.length} fields confirmed</span>
            <progress value={confirmedCount} max={fields.length} aria-label='Fields confirmed' />
          </div>
        </div>
      </div>

      <div className='review-workspace'>
        <nav className='review-field-list' aria-label='Fields to confirm'>
          <label className='review-mobile-field'>Field
            <select value={id} onChange={event => setActiveId(event.target.value)} aria-label='Field to confirm'>
              {fields.map((candidate, index) => <option key={candidate.properties.id} value={candidate.properties.id}>Field {candidate.properties.selectionNumber ?? index + 1}{inputs[candidate.properties.id]?.confirmed ? ' (confirmed)' : ''}</option>)}
            </select>
          </label>
          {fields.map((candidate, index) => {
            const draft = inputs[candidate.properties.id]
            const active = candidate.properties.id === id
            return <button type='button' key={candidate.properties.id} aria-current={active ? 'true' : undefined} onClick={() => setActiveId(candidate.properties.id)}>
              <FieldOutline field={candidate} />
              <span><strong>Field {candidate.properties.selectionNumber ?? index + 1}</strong><small>{draft?.confirmed ? cropAnswer(draft) : 'To check'}</small></span>
              <span className='review-field-state' aria-label={draft?.confirmed ? 'Confirmed' : 'Not confirmed'}>{draft?.confirmed ? 'Done' : ''}</span>
            </button>
          })}
        </nav>

        <section className='review-current' aria-labelledby='review-current-title' key={id}>
          <div className='review-field-heading'>
            <div><p className='review-position'>Field {activeIndex + 1} of {fields.length}</p><h3 id='review-current-title'>Field {number}</h3><p>{field.properties.areaAcres == null ? 'Area unavailable' : `About ${field.properties.areaAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })} acres`}</p></div>
            <FieldOutline field={field} />
          </div>

          <div className='review-columns'>
            <div className='review-evidence'>
              <h4>What the crop maps show</h4>
              {latest ? <>
                <p className='review-mapped-crop'>{latest.groupLabel}<span>mapped in {latest.year}</span></p>
                <p className='review-evidence-note'>{Math.round(latest.share * 100)}% of this outline was classified as {(latest.groupLabel).toLowerCase()}. This is a map estimate, not a confirmed crop record.</p>
                <ol className='review-history-strip' aria-label='Recent mapped crops, oldest to newest'>
                  {slots.map(({ year, observation }) => <li key={year} className={observation ? `crop-tone-${observation.group ?? 'other'}` : 'crop-unmapped'}>
                    <span>{year}</span><strong>{observation ? observation.groupLabel : 'Not mapped'}</strong>
                  </li>)}
                </ol>
                {fieldHistory?.summary?.pattern && <p className='review-pattern'>{fieldHistory.summary.pattern.text}</p>}
              </> : <p className='review-no-history' role='status'>{historyFailed ? 'Crop history is unavailable. You can still confirm what grows here.' : fieldHistory ? fieldHistory.years.length ? 'Field analysis is unavailable. You can enter your crop.' : 'No crop maps are available for this field.' : 'Loading crop history. You can enter your crop now.'}</p>}
              {historyFailed && !fieldHistory && <button type='button' className='button-secondary review-text-button' onClick={onRetryHistory}>Retry crop history</button>}

              {fieldHistory && <details className='review-history-details'>
                <summary>Full history and source</summary>
                <table><caption>Mapped crop by year</caption><thead><tr><th>Year</th><th>Mapped crop</th><th>Share</th></tr></thead><tbody>
                  {summary?.timeline.map(({ year, observation }) => <tr key={year}><td>{year}</td><td>{observation ? observation.groupLabel : 'Not mapped'}</td><td>{observation ? `${Math.round(observation.share * 100)}%` : ''}</td></tr>)}
                </tbody></table>
                {fieldHistory.source && <p><a href={fieldHistory.source.url} target='_blank' rel='noreferrer'>{fieldHistory.source.name}</a> · {fieldHistory.source.resolutionM} m classification</p>}
                <p>{fieldHistory.note}</p>
                {fieldHistory.summary?.notes.map(note => <p key={note}>{note}</p>)}
              </details>}
              <Suspense fallback={<p role='status'>Loading satellite imagery...</p>}>
                <FieldImagerySlider boundary={field.geometry} fieldName={`Field ${number}`} showImagery sampleImagery />
              </Suspense>
            </div>

            <div className='review-answer'>
              <h4>{year ? `Your crop for ${year}` : 'Your latest-season crop'}</h4>
              {suggestedCrop && <div className='review-suggestion'>
                <p>{suggestion?.reason}</p>
                {suggestion?.confidence && <p className='review-suggestion-reason'>Pattern support: {suggestion.confidence}.</p>}
                <button type='button' className='button-secondary review-use-crop' onClick={() => update({ crop: suggestedCrop })}>Use {suggestedCrop.toLowerCase()}</button>
              </div>}
              {suggestion?.status === 'unavailable' && <p className='review-no-history'>{suggestion.reason}</p>}
              <label htmlFor='review-crop'>{suggestedCrop ? 'Or choose a different answer' : 'What grew here in the latest season?'}</label>
              <select id='review-crop' value={input.crop} onChange={event => update({ crop: event.target.value })}>
                <option value=''>Choose a crop</option>
                {options.map(crop => <option key={crop} value={crop}>{crop}</option>)}
                <option value={OTHER_CROP}>Other crop</option><option value={NO_CROP}>Nothing planted</option><option value={UNKNOWN_CROP}>I’m not sure</option>
              </select>
              {input.crop === OTHER_CROP && <><label htmlFor='review-other-crop'>Crop name</label><input id='review-other-crop' value={input.otherCrop} onChange={event => update({ otherCrop: event.target.value })} placeholder='Enter the crop you grew' /></>}
              <label htmlFor='review-ready-date'>Next planting date <span>(optional)</span></label>
              <input id='review-ready-date' type='date' value={input.readyDate} onChange={event => update({ readyDate: event.target.value })} />
              <p className='review-input-hint'>When will this field be available to plant again? Leave blank if you don’t know yet.</p>
              {input.confirmed && <p className='review-confirmed-message' role='status'>Confirmed: {cropAnswer(input)}. You can still change your answer.</p>}
            </div>
          </div>
        </section>
      </div>

      <div className='review-actions'>
        <div className='review-paging'>
          <button type='button' className='button-secondary' disabled={activeIndex === 0} onClick={() => setActiveId(fields[activeIndex - 1].properties.id)}>Previous</button>
          <span>{activeIndex + 1} / {fields.length}</span>
          <button type='button' className='button-secondary' disabled={activeIndex === fields.length - 1} onClick={() => setActiveId(fields[activeIndex + 1].properties.id)}>Next</button>
        </div>
        <div className='review-confirm-action'>
          {allConfirmed && <p className='review-all-confirmed' role='status'>All fields confirmed.</p>}
          {allConfirmed && onSubmit ? <button type='submit' className='review-primary'>Get crop rotation suggestions</button> :
            <button type='button' className='review-primary' disabled={!canConfirm(input) || input.confirmed} onClick={confirm}>{input.confirmed ? 'Field confirmed' : confirmedCount === fields.length - 1 ? 'Confirm field' : 'Confirm field and next'}</button>}
        </div>
      </div>
    </form>
  )
}

export default FieldReviewForm
