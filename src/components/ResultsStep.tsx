import { MapPinned, Sprout } from 'lucide-react'
import BackButton from './BackButton'
import StepNav from './StepNav'

type Props = {
  fieldCount: number
  onBack: () => void
  onStartOver: () => void
}

/** Stub results step. Recommendations are not wired up yet. */
function ResultsStep({ fieldCount, onBack, onStartOver }: Props) {
  return (
    <main className='results-step'>
      <div className='step-header'>
        <BackButton label='Back to crops' onClick={onBack} />
        <StepNav current='results' />
      </div>

      <p className='results-eyebrow'>{fieldCount} {fieldCount === 1 ? 'field' : 'fields'} confirmed</p>
      <h2>Crop rotation suggestions</h2>
      <p className='results-intro'>Your field answers are saved. We’ll use them to recommend what to plant next.</p>

      <section className='results-placeholder' aria-labelledby='results-placeholder-title'>
        <Sprout size={40} aria-hidden='true' />
        <h3 id='results-placeholder-title'>Results are coming soon</h3>
        <p>Rotation suggestions will appear here once the recommendation service is connected.</p>
      </section>

      <div className='results-actions'>
        <button type='button' className='button-secondary' onClick={onStartOver}>
          <MapPinned size={18} aria-hidden='true' />
          Plan another location
        </button>
      </div>
    </main>
  )
}

export default ResultsStep
