import { useState, type FormEvent } from 'react'
import type { FieldFeature } from '../data/fields'
import { crops } from '../data/crops'

type Props = {
  fields: FieldFeature[]
  onClose: () => void
  onSubmit?: (answers: { fieldId: string; crop: string; readyDate: string }[]) => void
}

type FieldAnswer = { crop: string; readyDate: string }

const emptyAnswer: FieldAnswer = { crop: '', readyDate: '' }
const isComplete = (answer: FieldAnswer) => answer.crop !== '' && answer.readyDate !== ''

function FieldDataForm({ fields, onClose, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, FieldAnswer>>({})

  const update = (id: string, patch: Partial<FieldAnswer>) =>
    setAnswers(prev => ({
      ...prev,
      [id]: { ...emptyAnswer, ...prev[id], ...patch },
    }))

  const allComplete =
    fields.length > 0 &&
    fields.every(field => isComplete(answers[field.properties.id] ?? emptyAnswer))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!allComplete) return
    onSubmit?.(
      fields.map(field => {
        const id = field.properties.id
        const answer = answers[id] ?? emptyAnswer
        return { fieldId: id, crop: answer.crop, readyDate: answer.readyDate }
      }),
    )
  }

  return (
    <form className='field-data-form' onSubmit={submit}>
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
              Choose the crop currently growing in each field and the date it will be
              ready to plant something new. All fields are required.
            </p>
          </div>
        </div>

        <div className='field-form-container'>
          {fields.map((field, index) => {
            const id = field.properties.id
            const answer = answers[id] ?? emptyAnswer
            return (
              <fieldset key={id} className='field-card'>
                <legend>Field {index + 1}</legend>

                <label>
                  Current crop
                  <select
                    required
                    value={answer.crop}
                    onChange={e => update(id, { crop: e.target.value })}
                  >
                    <option value=''>Select a crop</option>
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
                    value={answer.readyDate}
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

export default FieldDataForm
