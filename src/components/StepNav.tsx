export type Step = 'location' | 'fields' | 'form' | 'results'

const steps: { id: Step; label: string }[] = [
  { id: 'location', label: 'Location' },
  { id: 'fields', label: 'Fields' },
  { id: 'form', label: 'Crops' },
  { id: 'results', label: 'Results' },
]

type Props = { current: Step }

/** Read-only progress trail; page-to-page movement uses the shared back button. */
function StepNav({ current }: Props) {
  return (
    <nav className='step-nav' aria-label='Progress'>
      <ol>
        {steps.map((step, index) => (
          <li key={step.id}>
            {step.id === current
              ? <span aria-current='step'><span className='step-nav-long'>Step </span>{index + 1}<span className='step-nav-long'> of {steps.length}</span>. {step.label}</span>
              : <span>{index + 1}. {step.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default StepNav
