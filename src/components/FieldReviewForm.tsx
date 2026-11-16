import { lazy, Suspense, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { SkeletonBox, Skeleton } from 'skullet/react'
import type { FieldFeature } from '../data/fields'
import type { CropHistoryResponse } from '../data/cropHistory'
import { crops } from '../data/crops'
import type { HistoryEntry } from '../data/cropHistoryCache'
import { canConfirm, cropAnswer, EMPTY_REVIEW, OTHER_CROP, NO_CROP, UNKNOWN_CROP, type FieldReviewInput } from '../data/fieldReview'
import { SAMPLE_SUGGESTION } from '../data/cropHistorySample'
import BackButton from './BackButton'
import CropHistoryEvidence from './CropHistoryEvidence'
import FieldOutline from './FieldOutline'
import StepNav from './StepNav'

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
  const dateInput = useRef<HTMLInputElement>(null)
  // Field changes swap the whole panel, so say what happened for screen reader users.
  const [announcement, setAnnouncement] = useState('')
  const label = (candidate: FieldFeature) => `Field ${candidate.properties.selectionNumber ?? fields.indexOf(candidate) + 1}`
  const show = (nextId: string, prefix = '') => {
    const next = fields.find(candidate => candidate.properties.id === nextId)
    setActiveId(nextId)
    if (next) setAnnouncement(`${prefix}Now showing ${label(next)}, ${fields.indexOf(next) + 1} of ${fields.length}.`)
  }
  const activeIndex = Math.max(0, fields.findIndex(field => field.properties.id === activeId))
  const field = fields[activeIndex]
  const confirmedCount = fields.filter(field => inputs[field.properties.id]?.confirmed).length
  const allConfirmed = fields.length > 0 && confirmedCount === fields.length

  if (!field) return <div className='review-empty'><p>No fields selected.</p><button type='button' className='button-secondary' onClick={onClose}><ArrowLeft size={18} aria-hidden='true' />Back to field selection</button></div>

  const id = field.properties.id
  const result = history?.results.find(result => result.id === id)
  const fieldHistory = result?.history
  const historyStatus = historyEntries[id]?.status
  const historyFailed = historyStatus === 'error'
  const historyLoading = !historyStatus || historyStatus === 'loading'
  const summary = fieldHistory?.summary
  const suggestion = summary?.currentCrop
  const suggestedCrop = suggestion?.crop
  const year = summary?.reviewYear
  const savedInput = inputs[id] ?? EMPTY_REVIEW
  const input = !savedInput.crop && suggestedCrop ? { ...savedInput, crop: suggestedCrop } : savedInput
  const options = [...new Set([...crops, ...[suggestedCrop, input.crop].filter((crop): crop is string => typeof crop === 'string' && crop.length > 0 && !crop.startsWith('__'))])]
  const number = field.properties.selectionNumber ?? activeIndex + 1
  const update = (patch: Partial<FieldReviewInput>) => onUpdate(id, { ...input, ...patch, confirmed: false })
  const confirm = () => {
    if (!canConfirm(input)) return
    onUpdate(id, { ...input, confirmed: true })
    const ordered = [...fields.slice(activeIndex + 1), ...fields.slice(0, activeIndex)]
    const next = ordered.find(candidate => !inputs[candidate.properties.id]?.confirmed)
    const done = `${label(field)} confirmed, ${confirmedCount + 1} of ${fields.length} done. `
    if (next) show(next.properties.id, done)
    else setAnnouncement(`${label(field)} confirmed. All ${fields.length} fields are confirmed. You can now get crop rotation suggestions.`)
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
      <p className='sr-only' role='status'>{announcement}</p>
      <div className='review-heading'>
        <div className='step-header'>
          <BackButton label='Back to fields' onClick={onClose} />
          <StepNav current='form' />
        </div>
        <div className='review-title-row'>
          <div><h2 data-step-title='' tabIndex={-1}>Confirm your crops</h2><p>Check each field against your records. Change anything that looks wrong.</p></div>
          <div className='review-progress'>
            <span>{confirmedCount} of {fields.length} fields confirmed</span>
            <progress value={confirmedCount} max={fields.length} aria-label='Fields confirmed' />
          </div>
        </div>
      </div>

      <div className='review-workspace'>
        <nav className='review-field-list' aria-label='Fields to confirm'>
          <label className='review-mobile-field'>Field
            <select value={id} onChange={event => show(event.target.value)} aria-label='Field to confirm'>
              {fields.map((candidate, index) => <option key={candidate.properties.id} value={candidate.properties.id}>Field {candidate.properties.selectionNumber ?? index + 1}{inputs[candidate.properties.id]?.confirmed ? ' (confirmed)' : ''}</option>)}
            </select>
          </label>
          {fields.map((candidate, index) => {
            const draft = inputs[candidate.properties.id]
            const active = candidate.properties.id === id
            return <button type='button' key={candidate.properties.id} aria-current={active ? 'true' : undefined} onClick={() => show(candidate.properties.id)}>
              <FieldOutline field={candidate} />
              <span><strong>Field {candidate.properties.selectionNumber ?? index + 1}</strong><small>{draft?.confirmed ? cropAnswer(draft) : 'To check'}</small></span>
              <span className='review-field-state'>{draft?.confirmed ? 'Done' : ''}</span>
            </button>
          })}
        </nav>

        <section className='review-current' aria-labelledby='review-current-title' key={id}>
          <div className='review-field-heading'>
            <div><h3 id='review-current-title'>Field {number}</h3><p>{field.properties.areaAcres == null ? 'Area unavailable' : `About ${field.properties.areaAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })} acres`}</p></div>
            <FieldOutline field={field} />
          </div>

          <div className='review-columns'>
            <div className='review-evidence'>
              <h4>What the crop maps show</h4>
              <CropHistoryEvidence history={fieldHistory} loading={historyLoading} failed={historyFailed} onRetry={onRetryHistory} />
              <Suspense fallback={<div className='imagery-chunk-loading' role='status'><span className='sr-only'>Loading satellite imagery</span><SkeletonBox className='imagery-chunk-box' width='100%' height={300} radius={12} /></div>}>
                <FieldImagerySlider boundary={field.geometry} fieldId={id} fieldName={`Field ${number}`} showImagery />
              </Suspense>
            </div>

            <div className='review-answer'>
              <h4>{year ? `Your crop for ${year}` : 'Your latest-season crop'}</h4>
              <Skeleton loading={historyLoading}>
                {historyLoading ? <div className='review-suggestion'>
                  <p>{SAMPLE_SUGGESTION.reason}</p>
                  <p className='review-suggestion-reason'>Pattern support: high.</p>
                </div> : <>
                  {suggestedCrop && <div className='review-suggestion'>
                    <p>{suggestion?.reason}</p>
                    {suggestion?.confidence && <p className='review-suggestion-reason'>Pattern support: {suggestion.confidence}.</p>}
                  </div>}
                  {suggestion?.status === 'unavailable' && <p className='review-no-history'>{suggestion.reason}</p>}
                </>}
              </Skeleton>
              <label htmlFor='review-crop'>{suggestedCrop ? 'Crop' : 'What grew here in the latest season?'} <span className='required-mark' aria-hidden='true'>*</span></label>
              <select id='review-crop' required value={input.crop} onChange={event => update({ crop: event.target.value })}>
                {!suggestedCrop && <option value=''>Choose a crop</option>}
                {options.map(crop => <option key={crop} value={crop}>{crop}</option>)}
                <option value={OTHER_CROP}>Other crop</option><option value={NO_CROP}>Nothing planted</option><option value={UNKNOWN_CROP}>I’m not sure</option>
              </select>
              {input.crop === OTHER_CROP && <><label htmlFor='review-other-crop'>Crop name <span className='required-mark' aria-hidden='true'>*</span></label><input id='review-other-crop' required value={input.otherCrop} onChange={event => update({ otherCrop: event.target.value })} placeholder='Enter the crop you grew' /></>}
              <label htmlFor='review-ready-date'>Next planting date <span className='required-mark' aria-hidden='true'>*</span></label>
              {/* Clicking anywhere on the field opens the picker. Chromium and Safari get our own icon
                  button (their native one is hidden); Firefox keeps its native icon, which opens the
                  picker itself, so a click there must not open it a second time. */}
              <div className='review-date'>
                <input
                  ref={dateInput}
                  id='review-ready-date'
                  type='date'
                  required
                  value={input.readyDate}
                  onClick={() => openPickerAfterClick(dateInput.current)}
                  onChange={event => update({ readyDate: event.target.value })}
                />
                <button type='button' className='review-date-button' tabIndex={-1} aria-hidden='true' onClick={() => { dateInput.current?.focus(); openDatePicker(dateInput.current) }}>
                  <CalendarDays size={20} aria-hidden='true' />
                </button>
              </div>
              <p className='review-input-hint'>When will this field be available to plant again? We use this date to predict the next crop rotation.</p>
              {input.confirmed && <p className='review-confirmed-message'>Confirmed: {cropAnswer(input)}. You can still change your answer.</p>}
            </div>
          </div>
        </section>
      </div>

      <div className='review-actions'>
        <div className='review-paging'>
          <button type='button' className='button-secondary' disabled={activeIndex === 0} onClick={() => show(fields[activeIndex - 1].properties.id)}><ChevronLeft size={18} aria-hidden='true' /><span className='review-paging-label'>Previous</span></button>
          <span>{activeIndex + 1} / {fields.length}</span>
          <button type='button' className='button-secondary' disabled={activeIndex === fields.length - 1} onClick={() => show(fields[activeIndex + 1].properties.id)}><span className='review-paging-label'>Next</span><ChevronRight size={18} aria-hidden='true' /></button>
        </div>
        <div className='review-confirm-action'>
          {allConfirmed && <p className='review-all-confirmed'>All fields confirmed.</p>}
          {allConfirmed && onSubmit ? <button type='submit' className='button-primary review-primary'>Get crop rotation suggestions<ArrowRight size={18} aria-hidden='true' /></button> :
            <button type='button' className='button-primary review-primary' disabled={!canConfirm(input) || input.confirmed} onClick={event => { event.preventDefault(); confirm() }}><Check size={18} aria-hidden='true' />{input.confirmed ? 'Field confirmed' : confirmedCount === fields.length - 1 ? 'Confirm field' : <>Confirm field<span className='review-confirm-next'> and next</span></>}</button>}
        </div>
      </div>
    </form>
  )
}

/** Opens the browser's date picker where supported; typing the date still works everywhere. */
function openDatePicker(input: HTMLInputElement | null) {
  try { input?.showPicker?.() } catch { /* picker unavailable or already open */ }
}

/**
 * After a click on the field, opens the picker unless the browser already did. Firefox opens
 * it from its own icon after the click event, and opening it again would close it.
 */
function openPickerAfterClick(input: HTMLInputElement | null) {
  if (!input) return
  setTimeout(() => {
    let open = false
    try { open = input.matches(':open') } catch { /* :open unsupported: open it ourselves */ }
    if (!open) openDatePicker(input)
  }, 0)
}

export default FieldReviewForm
