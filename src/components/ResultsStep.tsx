import { useEffect, useState } from 'react'
import { MapPinned } from 'lucide-react'
import type { FieldFeature } from '../data/fields'
import { fetchCropPlan, type CropPlanResponse, type SubmittedField } from '../data/cropPlanning'
import BackButton from './BackButton'
import FieldOutline from './FieldOutline'
import StepNav from './StepNav'

type Props = {
  fields: FieldFeature[]
  answers: SubmittedField[]
  onBack: () => void
  onStartOver: () => void
}

type PlanState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; result: CropPlanResponse }

/** Displays Java's five-year response, with explicit loading, error and demo states. */
function ResultsStep({ fields, answers, onBack, onStartOver }: Props) {
  const [state, setState] = useState<PlanState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const started = performance.now()
    let revealTimer: ReturnType<typeof setTimeout> | undefined
    fetchCropPlan(fields, answers, controller.signal).then(result => {
      if (controller.signal.aborted) return
      // Keep the random demo's loading state visible for four seconds in total.
      const delay = result.planner === 'random-placeholder' ? Math.max(0, 4000 - (performance.now() - started)) : 0
      revealTimer = setTimeout(() => {
        if (!controller.signal.aborted) setState({ status: 'ready', result })
      }, delay)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not create a plan. Please try again.' })
    })
    return () => { controller.abort(); clearTimeout(revealTimer) }
  }, [fields, answers, attempt])

  return (
    <main className='results-step'>
      <div className='step-header'>
        <BackButton label='Back to crops' onClick={onBack} />
        <StepNav current='results' />
      </div>
      <p className='results-eyebrow'>{answers.length} {answers.length === 1 ? 'field' : 'fields'} confirmed</p>
      <h2>{state.status === 'ready' && state.result.temporary ? 'Compare your demo rotations' : 'Compare five-year rotations'}</h2>
      <p className='results-intro'>Explore three different five-year rotations for each field. Crop choices and explanations are demo examples, not recommendations for your land.</p>

      {state.status === 'loading' && <p className='results-status' role='status'>Preparing rotation options for your {answers.length === 1 ? 'field' : 'fields'}...</p>}
      {state.status === 'error' && <div className='results-status'>
        <p role='alert'>{state.message}</p>
        <button type='button' className='button-primary' onClick={() => { setState({ status: 'loading' }); setAttempt(value => value + 1) }}>Try again</button>
      </div>}
      {state.status === 'ready' && <>
        <div className='results-plans'>
          {state.result.plans.map(plan => {
            const field = fields.find(field => field.properties.id === plan.fieldId)!
            const answer = answers.find(answer => answer.fieldId === plan.fieldId)!
            return <section className='results-field' key={plan.fieldId} aria-labelledby={`plan-${plan.fieldId}`}>
              <div className='results-field-heading'>
                <FieldOutline field={field} />
                <div><h3 id={`plan-${plan.fieldId}`}>Field {field.properties.selectionNumber ?? fields.indexOf(field) + 1}</h3>
                  <p>Latest crop: {plan.currentCrop}. Ready to plant: <time dateTime={answer.readyDate}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${answer.readyDate}T00:00:00Z`))}</time>.</p>
                </div>
              </div>
              <div className='results-rotations'>
                {(plan.alternatives ?? [{ id: 'current', title: 'Five-year rotation', summary: '', years: plan.years, benefits: [], tradeoff: '' }]).map(option => (
                  <section className='results-rotation' key={option.id} aria-labelledby={`rotation-${plan.fieldId}-${option.id}`}>
                    <h4 id={`rotation-${plan.fieldId}-${option.id}`}>{option.title}</h4>
                    {option.summary && <p className='results-rotation-summary'>{option.summary}</p>}
                    <ol className='results-years' aria-label={`${option.title} crop sequence`}>
                      {option.years.map(year => <li key={year.year}><span>{year.year}</span><strong>{year.crop}</strong></li>)}
                    </ol>
                    {option.benefits.length > 0 && <ul className='results-benefits' aria-label='Example reasons to explore this rotation'>
                      {option.benefits.map(benefit => <li key={benefit}>{benefit}</li>)}
                    </ul>}
                    {option.tradeoff && <p className='results-tradeoff'>{option.tradeoff}</p>}
                    {option.years.some(year => year.rationale) && <details className='results-rationale'>
                      <summary>Why these crops follow each other</summary>
                      <ol>{option.years.map(year => <li key={year.year}><strong>{year.year}: {year.crop}</strong><p>{year.rationale}</p></li>)}</ol>
                    </details>}
                  </section>
                ))}
              </div>
            </section>
          })}
        </div>
        <details className='results-details'>
          <summary>About these demo rotations</summary>
          <p>{state.result.disclaimer}</p>
          <p>The demo uses every crop in the backend catalog as a possible choice for each field. It does not check which crops you can grow. Your confirmed crop and planting date are kept with each field.</p>
          <p>The explanations illustrate possible rotation principles. They are not based on an analysis of your field. Returning to this page creates new random options.</p>
        </details>
      </>}
      <div className='results-actions'>
        <button type='button' className='button-secondary' onClick={onStartOver}>
          <MapPinned size={18} aria-hidden='true' />Plan another location
        </button>
      </div>
    </main>
  )
}

export default ResultsStep
