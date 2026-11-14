import { useState } from 'react'
import './App.css'
import type { FieldFeature } from './data/fields'
import { crops } from './data/crops'

type Props = { fields: FieldFeature[] }

type FieldAnswer = { crop: string; readyDate: string }

const emptyAnswer: FieldAnswer = { crop: '', readyDate: '' }

function FieldDataForm({ fields }: Props) {
  const [answers, setAnswers] = useState<Record<string, FieldAnswer>>({})

  const update = (id: string, patch: Partial<FieldAnswer>) =>
    setAnswers(prev => ({
      ...prev,
      [id]: { ...emptyAnswer, ...prev[id], ...patch },
    }))

  return (
    <>
      <h2>Field Data</h2>
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
                  value={answer.readyDate}
                  onChange={e => update(id, { readyDate: e.target.value })}
                />
              </label>
            </fieldset>
          )
        })}
      </div>
    </>
  )
}

export default FieldDataForm
