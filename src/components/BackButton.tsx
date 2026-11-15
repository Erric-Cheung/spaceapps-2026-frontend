import { ArrowLeft } from 'lucide-react'

type Props = {
  label: string
  onClick: () => void
}

/** The single back control for every step that has a previous page. */
function BackButton({ label, onClick }: Props) {
  return (
    <button type='button' className='button-secondary back-button' onClick={onClick}>
      <ArrowLeft size={18} aria-hidden='true' />
      {label}
    </button>
  )
}

export default BackButton
