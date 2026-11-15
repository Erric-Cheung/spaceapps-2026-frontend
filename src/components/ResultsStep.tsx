import { useEffect, useMemo, useRef, useState } from 'react'
import { Skeleton, SkulletProvider } from 'skullet/react'
import { MapPinned } from 'lucide-react'
import type { FieldFeature } from '../data/fields'
import { fetchCropPlan, type CropPlanResult, type PlanProgress, type RotationChoice, type SubmittedField } from '../data/cropPlanning'
import BackButton from './BackButton'
import FieldOutline from './FieldOutline'
import StepNav from './StepNav'

type Props = {
  fields: FieldFeature[]
  answers: SubmittedField[]
  /** Crop the map shows for each field, used only when the farmer answered "I'm not sure". */
  mappedCrops: Record<string, string | null | undefined>
  onBack: () => void
  onStartOver: () => void
}

type PlanState =
  | { status: 'loading'; progress: PlanProgress | null }
  | { status: 'error'; message: string }
  | { status: 'ready'; result: CropPlanResult }

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })

/** Mean of each year's climate-and-soil fit, as a whole number out of 100. */
function fitOutOf100(option: RotationChoice) {
  const values = option.years.flatMap(year => year.reliability == null ? [] : [year.reliability])
  return values.length ? Math.round(100 * values.reduce((sum, value) => sum + value, 0) / values.length) : null
}

function loadingText(progress: PlanProgress | null, count: number) {
  const fields = count === 1 ? 'your field' : `your ${count} fields`
  if (!progress || progress.round === 1) return `Checking soil, climate and crop history for ${fields}. The first time, this can take up to a minute.`
  return `Finding rotation ${progress.round} of ${progress.rounds}.`
}

/** Compares three five-year rotations per field, each the planner's best under a plain constraint. */
function ResultsStep({ fields, answers, mappedCrops, onBack, onStartOver }: Props) {
  const [state, setState] = useState<PlanState>({ status: 'loading', progress: null })
  const [attempt, setAttempt] = useState(0)
  // Read once per request; history arriving later must not restart a plan already in progress.
  const mapped = useRef(mappedCrops)
  useEffect(() => { mapped.current = mappedCrops })

  useEffect(() => {
    const controller = new AbortController()
    fetchCropPlan(fields, answers, mapped.current, controller.signal, progress => {
      if (!controller.signal.aborted) setState({ status: 'loading', progress })
    }).then(result => {
      if (!controller.signal.aborted) setState({ status: 'ready', result })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not create a plan. Please try again.' })
    })
    return () => controller.abort()
  }, [fields, answers, attempt])

  const result = state.status === 'ready' ? state.result : null
  const sample = useMemo(() => sampleResult(answers), [answers])
  return (
    <main className='results-step'>
      <div className='step-header'>
        <BackButton label='Back to crops' onClick={onBack} />
        <StepNav current='results' />
      </div>
      <p className='results-eyebrow'>{answers.length} {answers.length === 1 ? 'field' : 'fields'} confirmed</p>
      <h2>Compare three five-year rotations</h2>
      <p className='results-intro'>
        Each option is the planner's best rotation for your field's soil, climate and crop history.
        The second and third leave out the main crop of the one before, in case you would rather not grow it.
      </p>

      {state.status === 'loading' && <p className='results-progress' role='status'>{loadingText(state.progress, answers.length)}</p>}
      {state.status === 'error' && <div className='results-status'>
        <p role='alert'>{state.message}</p>
        <button type='button' className='button-primary' onClick={() => { setState({ status: 'loading', progress: null }); setAttempt(value => value + 1) }}>Try again</button>
      </div>}

      {state.status !== 'error' && <SkulletProvider theme={SKULLET_THEME} mode='light'>
        <Skeleton data={result} sample={sample} id={`results-${answers.length}`} label='Loading rotation options'>
          {result => <ResultsBody result={result} fields={fields} answers={answers} />}
        </Skeleton>
      </SkulletProvider>}
      <div className='results-actions'>
        <button type='button' className='button-secondary' onClick={onStartOver}>
          <MapPinned size={18} aria-hidden='true' />Plan another location
        </button>
      </div>
    </main>
  )
}

/** Every field's three options and the notes about them; also drawn from a sample as the loading skeleton. */
function ResultsBody({ result, fields, answers }: { result: CropPlanResult; fields: FieldFeature[]; answers: SubmittedField[] }) {
  return (
      <>
        <div className='results-plans'>
          {result.fields.map(plan => {
            const field = fields.find(field => field.properties.id === plan.fieldId)!
            const answer = answers.find(answer => answer.fieldId === plan.fieldId)!
            const number = field.properties.selectionNumber ?? fields.indexOf(field) + 1
            return <section className='results-field' key={plan.fieldId} aria-labelledby={`plan-${plan.fieldId}`}>
              <div className='results-field-heading'>
                <FieldOutline field={field} />
                <div>
                  <h3 id={`plan-${plan.fieldId}`}>Field {number}</h3>
                  <p>
                    Your crop: {plan.answer}. Ready to plant: <time dateTime={answer.readyDate}>{dateFormat.format(new Date(`${answer.readyDate}T00:00:00Z`))}</time>.
                  </p>
                </div>
              </div>

              {plan.status === 'unplannable' && <p className='results-note'>
                The planner can't start from "{plan.answer}" yet. It needs the crop that grew here last, from this list:
                {' '}{result.catalog.map(crop => crop.name).join(', ')}. Go back to crops to choose the closest one.
              </p>}

              {plan.status === 'planned' && <>
                {plan.mappedStart && <p className='results-note'>
                  You weren't sure what grew here, so these plans start from the crop the map shows: {plan.startCrop}.
                </p>}
                <ComparisonTable fieldId={plan.fieldId} options={plan.options} />
                <div className='results-rotations'>
                  {plan.options.map((option, index) => (
                    <section className='results-rotation' key={option.id} aria-labelledby={`rotation-${plan.fieldId}-${option.id}`}>
                      <h4 id={`rotation-${plan.fieldId}-${option.id}`}><span className='results-option-number'>{index + 1}</span>{option.title}</h4>
                      {option.summary && <p className='results-rotation-summary'>{option.summary}</p>}
                      <ol className='results-years' aria-label={`${option.title}: crop for each year`}>
                        {option.years.map(year => <li key={year.year}><span>{year.year}</span><strong>{year.crop}</strong></li>)}
                      </ol>
                      {option.benefits.length > 0 && <ul className='results-benefits'>
                        {option.benefits.map(benefit => <li key={benefit}>{benefit}</li>)}
                      </ul>}
                      {option.tradeoff && <p className='results-tradeoff'>{option.tradeoff}</p>}
                      {option.years.some(year => year.reasons?.length || year.rationale) && <details className='results-rationale'>
                        <summary>Why each crop was chosen</summary>
                        {/* Closed disclosures are not on screen, so the skeleton must not draw them. */}
                        <div skullet-ignore=''><ol>{option.years.map(year => <li key={year.year}>
                          <strong>{year.year}: {year.crop}</strong>
                          {year.reasons?.length
                            ? <ul>{year.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
                            : <p>{year.rationale}</p>}
                        </li>)}</ol></div>
                      </details>}
                    </section>
                  ))}
                </div>
                {plan.assumptions.length > 0 && <details className='results-rationale'>
                  <summary>What the planner had to assume for this field</summary>
                  <div skullet-ignore=''><ul className='results-assumptions'>{plan.assumptions.map(item => <li key={item}>{item}</li>)}</ul></div>
                </details>}
              </>}
            </section>
          })}
        </div>
        <details className='results-details'>
          <summary>About these plans</summary>
          <div skullet-ignore=''>
          {result.disclaimer && <p>{result.disclaimer}</p>}
          <p>
            Soil health adds up the planner's yearly soil scores for pest and disease breaks, nitrogen, organic matter and ground cover.
            Higher is better, and it is only meant for comparing the options on this page.
            Climate and soil fit is the average, over the five years, of how well each crop suits this field's weather record and soil, out of 100.
          </p>
          {result.exampleData && <p>Income uses example margins for each crop, not local prices: {result.catalogNote}</p>}
          <p>The planner chooses from {result.catalog.map(crop => crop.name).join(', ')}. Your confirmed crop and planting date are kept with each field.</p>
          </div>
        </details>
      </>
  )
}

/** Skeleton colours from the app's palette: brand ink at 8% on paper, with a paper-coloured shimmer. */
const SKULLET_THEME = {
  light: { base: 'rgb(88 64 46 / 0.08)', highlight: 'rgb(247 246 242 / 0.7)' },
  dark: { base: 'rgb(88 64 46 / 0.08)', highlight: 'rgb(247 246 242 / 0.7)' },
  animation: 'shimmer',
  speed: 'slow',
  radius: '6px',
} as const

const SAMPLE_YEARS = ['Soybeans', 'Wheat', 'Corn', 'Soybeans', 'Wheat']

/**
 * Layout-only stand-in for a plan, shaped like the real one (three options of five years per
 * confirmed field) so the skeleton takes the space the results will. Never shown as text.
 */
function sampleResult(answers: SubmittedField[]): CropPlanResult {
  const firstYear = Number(answers[0]?.readyDate.slice(0, 4)) || new Date().getFullYear()
  const titles = ['Best match for this field', 'Without soybeans', 'Without soybeans or wheat']
  return {
    planner: '', temporary: true, disclaimer: '', exampleData: false, catalog: [],
    fields: answers.map(answer => ({
      fieldId: answer.fieldId,
      status: 'planned',
      answer: answer.crop,
      startCrop: answer.crop,
      mappedStart: false,
      assumptions: ['Sample'],
      options: titles.map((title, index) => ({
        id: `option-${index + 1}`,
        title,
        summary: 'The planner\'s best rotation for soil health and for how well each crop suits this field.',
        excluded: [],
        years: SAMPLE_YEARS.map((crop, offset) => ({ year: firstYear + offset, crop, reliability: 0.8, reasons: ['Sample'] })),
        benefits: [],
        tradeoff: '',
        totalSoilScore: 0.5,
        totalIncome: 10000,
      })),
    })),
  }
}

/** The three options side by side on the measures the planner reports. */
function ComparisonTable({ fieldId, options }: { fieldId: string; options: RotationChoice[] }) {
  const hasSoil = options.some(option => option.totalSoilScore != null)
  const hasFit = options.some(option => fitOutOf100(option) != null)
  const hasIncome = options.some(option => option.totalIncome != null)
  if (!hasSoil && !hasFit && !hasIncome) return null
  const bestSoil = Math.max(...options.map(option => option.totalSoilScore ?? -Infinity))
  return (
    <div className='results-compare-wrap'>
      <table className='results-compare' aria-describedby={`compare-note-${fieldId}`}>
        <thead>
          <tr>
            <th scope='col'>Option</th>
            {hasSoil && <th scope='col'>Soil health</th>}
            {hasFit && <th scope='col'>Climate and soil fit</th>}
            {hasIncome && <th scope='col'>Income over 5 years</th>}
          </tr>
        </thead>
        <tbody>
          {options.map((option, index) => {
            const fit = fitOutOf100(option)
            return <tr key={option.id}>
              <th scope='row'><span className='results-option-number'>{index + 1}</span>{option.title}</th>
              {hasSoil && <td>{option.totalSoilScore?.toFixed(2) ?? 'Not given'}{option.totalSoilScore === bestSoil && options.length > 1 && <span className='results-best'> highest</span>}</td>}
              {hasFit && <td>{fit == null ? 'Not given' : `${fit} of 100`}</td>}
              {hasIncome && <td>{option.totalIncome == null ? 'Not given' : `${money.format(option.totalIncome)}*`}</td>}
            </tr>
          })}
        </tbody>
      </table>
      <p className='results-compare-note' id={`compare-note-${fieldId}`}>
        {hasIncome ? '*Estimated from example margins, for the whole field. ' : ''}See "About these plans" below for what each measure means.
      </p>
    </div>
  )
}

export default ResultsStep
