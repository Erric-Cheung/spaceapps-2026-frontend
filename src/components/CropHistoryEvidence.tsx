import { RotateCcw } from 'lucide-react'
import { Skeleton } from 'skullet/react'
import type { FieldHistory } from '../data/cropHistory'
import { SAMPLE_FIELD_HISTORY } from '../data/cropHistorySample'

type Props = {
  history: FieldHistory | undefined
  loading: boolean
  failed: boolean
  onRetry: () => void
}

/** What the crop maps show for one field, drawn as a measured skeleton until its history arrives. */
export default function CropHistoryEvidence({ history, loading, failed, onRetry }: Props) {
  return <>
    <p className='review-history-status' role='status'>{loading ? 'Loading crop maps for this field. You can enter your crop while you wait.' : ''}</p>
    <Skeleton
      data={loading ? null : history}
      sample={SAMPLE_FIELD_HISTORY}
      label='Loading crop history'
      error={failed && !history ? <div className='review-history-error'>
        <p className='review-no-history' role='alert'>Crop history is unavailable. You can still confirm what grows here.</p>
        <button type='button' className='button-secondary review-text-button' onClick={onRetry}><RotateCcw size={16} aria-hidden='true' />Retry crop history</button>
      </div> : undefined}
    >
      {history => <HistoryBody history={history} />}
    </Skeleton>
  </>
}

function HistoryBody({ history }: { history: FieldHistory }) {
  const summary = history.summary
  const latest = summary?.latestMapped
  return <>
    {latest ? <>
      <p className='review-mapped-crop'>{latest.groupLabel}<span>mapped in {latest.year}</span></p>
      <p className='review-evidence-note'>{Math.round(latest.share * 100)}% of this outline was classified as {latest.groupLabel.toLowerCase()}. This is a map estimate, not a confirmed crop record.</p>
      <ol className='review-history-strip' aria-label='Recent mapped crops, oldest to newest'>
        {(summary?.recentYears ?? []).map(({ year, observation }) => <li key={year} className={observation ? `crop-tone-${observation.group ?? 'other'}` : 'crop-unmapped'}>
          <span>{year}</span><strong>{observation ? observation.groupLabel : 'Not mapped'}</strong>
        </li>)}
      </ol>
      {summary?.pattern && <p className='review-pattern'>{summary.pattern.text}</p>}
    </> : <p className='review-no-history'>{history.years.length ? 'Field analysis is unavailable. You can enter your crop.' : 'No crop maps are available for this field.'}</p>}

    <details className='review-history-details'>
      <summary>Full history and source</summary>
      {/* Closed disclosures are not on screen, so the skeleton must not draw them. */}
      <div skullet-ignore=''>
        <table><caption>Mapped crop by year</caption><thead><tr><th>Year</th><th>Mapped crop</th><th>Share</th></tr></thead><tbody>
          {summary?.timeline.map(({ year, observation }) => <tr key={year}><td>{year}</td><td>{observation ? observation.groupLabel : 'Not mapped'}</td><td>{observation ? `${Math.round(observation.share * 100)}%` : ''}</td></tr>)}
        </tbody></table>
        {history.source && <p><a href={history.source.url} target='_blank' rel='noreferrer'>{history.source.name}</a> · {history.source.resolutionM} m classification</p>}
        {history.note && <p>{history.note}</p>}
        {summary?.notes.map(note => <p key={note}>{note}</p>)}
      </div>
    </details>
  </>
}
