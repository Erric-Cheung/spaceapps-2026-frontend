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
      const delay = result.temporary ? Math.max(0, 4000 - (performance.now() - started)) : 0
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
      <h2>{state.status === 'ready' && state.result.temporary ? 'Your five-year demo plan' : 'Your five-year crop plan'}</h2>
      <p className='results-intro'>For now, the Java backend picks crops at random. These plans are for trying the app, not for making planting decisions.</p>

      {state.status === 'loading' && <p className='results-status' role='status'>Creating a five-year plan for your {answers.length === 1 ? 'field' : 'fields'}...</p>}
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
              <ol className='results-years' aria-label='Five-year crop sequence'>
                {plan.years.map(year => <li key={year.year}><span>{year.year}</span><strong>{year.crop}</strong></li>)}
              </ol>
            </section>
          })}
        </div>
        <details className='results-details'>
          <summary>About this plan</summary>
          <p>{state.result.disclaimer}</p>
          <p>The demo uses every crop in the backend catalog as a possible choice for each field. It does not check which crops you can grow. Your confirmed crop, planting date and field outline are sent to the Java backend.</p>
          <p>Planner: {state.result.planner}. Returning to this page creates a new plan; the random choices may change.</p>
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
