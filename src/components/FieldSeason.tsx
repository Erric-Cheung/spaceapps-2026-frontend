import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import {
  decodeBytes, EMPTY_SEASON, fetchFieldSeason, isRunning, longDate, mergeSeason, pictureDays, seasonStory, shortDate, startIndex,
  type SeasonGrid, type SeasonPixels, type SeasonPoint, type SeasonState,
} from '../data/fieldSeason'
import '../styles/FieldSeason.css'

type Mode = 'colour' | 'green'
type Props = { fieldId: string; fieldName: string; year: number }

// Seasons seen this session: returning to a field shows it at once, and a running one resumes.
const memory = new Map<string, SeasonState>()

/** Polls the season until acquisition ends, keeping every picture received. */
function useFieldSeason(fieldId: string, year: number) {
  const key = `${fieldId}|${year}`
  const [state, setState] = useState<{ key: string; season: SeasonState; failed: boolean }>(() => ({ key, season: memory.get(key) ?? EMPTY_SEASON, failed: false }))
  const [attempt, setAttempt] = useState(0)
  const current = state.key === key ? state : { key, season: memory.get(key) ?? EMPTY_SEASON, failed: false }

  useEffect(() => {
    let season = memory.get(key) ?? EMPTY_SEASON
    const status = season.response?.status
    if (status && !isRunning(status) && status !== 'failed' && attempt === 0) return
    const controller = new AbortController()
    let timer = 0
    let retry = attempt > 0 && (status === 'failed' || status === 'partial')
    const poll = async () => {
      try {
        const response = await fetchFieldSeason(fieldId, year, season.response?.observationCount ?? 0, retry, controller.signal)
        retry = false
        season = mergeSeason(season, response)
        memory.set(key, season)
        setState({ key, season, failed: false })
        if (isRunning(response.status)) timer = window.setTimeout(poll, 1500)
      } catch {
        if (!controller.signal.aborted) setState({ key, season, failed: true })
      }
    }
    poll()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [fieldId, year, key, attempt])

  return { season: current.season, failed: current.failed, retry: () => setAttempt(value => value + 1) }
}

/** A field's growing season as the satellites saw it: one picture per clear day, and its greenness. */
export default function FieldSeason({ fieldId, fieldName, year }: Props) {
  const { season, failed, retry } = useFieldSeason(fieldId, year)
  const response = season.response
  const days = useMemo(() => pictureDays(season), [season])
  const [chosen, setChosen] = useState<{ key: string; date: string } | null>(null)
  const [mode, setMode] = useState<Mode>('colour')
  const key = `${fieldId}|${year}`
  // Play state belongs to one field: switching fields stops playback without an effect.
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const playing = playingKey === key
  const setPlaying = (value: boolean) => setPlayingKey(value ? key : null)
  // Keep the chosen date while new pictures arrive around it; start on the greenest day.
  const chosenIndex = chosen?.key === key ? days.findIndex(day => day.date === chosen.date) : -1
  const index = chosenIndex >= 0 ? chosenIndex : startIndex(days, response?.summary.peakDate)
  const day = days[index]
  const pick = (next: number) => { if (days[next]) setChosen({ key, date: days[next].date }) }
  const isPlaying = playing && days.length > 1

  useEffect(() => {
    if (!isPlaying) return
    const timer = window.setInterval(() => {
      if (index >= days.length - 1) { setPlayingKey(null); return }
      setChosen({ key, date: days[index + 1].date })
    }, 700)
    return () => window.clearInterval(timer)
  }, [isPlaying, index, days, key])

  const grid = response?.grid
  const drawable = grid?.width && grid.height && grid.fieldMask ? grid : null
  const running = !response || isRunning(response.status)
  const progress = response?.progress
  const story = response ? seasonStory(response, days.length) : []
  const mostlyWater = days.length >= 3 && [...days].map(d => d.waterShare).sort((a, b) => a - b)[Math.floor(days.length / 2)] > 0.4

  return <section className='season' aria-labelledby={`season-title-${fieldId}`}>
    <h4 id={`season-title-${fieldId}`}>What the satellites saw in {year}</h4>
    {drawable && day ? <>
      <div className='season-head'>
        <div className='season-when' aria-live='polite'>
          <strong>{longDate(day.date)}</strong>
          <span>{day.sensor}{day.clearShare < 0.99 ? ` · ${Math.round(day.clearShare * 100)}% clear` : ''}</span>
        </div>
        <div className='season-toggle' role='group' aria-label='Picture type'>
          <button type='button' className='season-button' aria-pressed={mode === 'colour'} onClick={() => setMode('colour')}>Colour</button>
          <button type='button' className='season-button' aria-pressed={mode === 'green'} onClick={() => setMode('green')}>Greenness</button>
        </div>
      </div>
      <Frame grid={drawable} day={day} pixels={season.pictures[day.sceneId]} mode={mode}
        label={`${mode === 'colour' ? 'Colour picture' : 'Greenness map'} of ${fieldName} on ${longDate(day.date)}`} />
      <div className='season-controls'>
        <button type='button' className='button-primary season-play' disabled={days.length < 2}
          onClick={() => { if (index >= days.length - 1) pick(0); setPlaying(!isPlaying) }}>
          {isPlaying ? <Pause size={18} aria-hidden='true' /> : <Play size={18} aria-hidden='true' />}{isPlaying ? 'Pause' : 'Play'}
        </button>
        <button type='button' className='season-button' disabled={index === 0} onClick={() => { setPlaying(false); pick(index - 1) }}>
          <ChevronLeft size={18} aria-hidden='true' />Earlier
        </button>
        <button type='button' className='season-button' disabled={index >= days.length - 1} onClick={() => { setPlaying(false); pick(index + 1) }}>
          Later<ChevronRight size={18} aria-hidden='true' />
        </button>
      </div>
      <input type='range' className='season-scrub' min={0} max={Math.max(0, days.length - 1)} value={index} disabled={days.length < 2}
        aria-label='Picture date' aria-valuetext={longDate(day.date)} onChange={event => { setPlaying(false); pick(Number(event.target.value)) }} />
      {mode === 'green'
        ? <p className='season-key'><span className='season-ramp' aria-hidden='true' />Little green to very green. Grey: hidden by cloud.</p>
        : <p className='season-key'>White stripes: cloud or shadow over the field. Each square is 30 m across.</p>}
    </> : <div className='season-frame season-placeholder' role='status'>
      {failed ? <>
        <p>Satellite pictures could not be loaded.</p>
        <button type='button' className='season-button' onClick={retry}><RotateCcw size={16} aria-hidden='true' />Try again</button>
      </> : response?.status === 'failed' ? <>
        <p>{response.message}</p>
        <button type='button' className='season-button' onClick={retry}><RotateCcw size={16} aria-hidden='true' />Try again</button>
      </> : <p>{running ? 'Looking for clear pictures of this field.' : `No clear pictures of this field in ${year}.`}</p>}
    </div>}

    {running && !failed && <div className='season-progress' role='status'>
      <span>{progress?.total ? `Checking satellite passes: ${progress.processed} of ${progress.total}` : 'Finding satellite passes for this field'}</span>
      <span className='season-track'><span style={{ width: `${progress?.total ? (100 * progress.processed) / progress.total : 4}%` }} /></span>
    </div>}
    {failed && drawable && <p className='season-note' role='alert'>Loading stopped early. <button type='button' className='season-link' onClick={retry}>Try again</button></p>}

    {response && response.points.length > 0 && <Strip points={response.points} segments={response.segments} period={response.period}
      pictures={season.pictures} current={day?.sceneId} onPick={sceneId => { setPlaying(false); pick(days.findIndex(d => d.sceneId === sceneId)) }} />}
    {response && response.points.length > 0 && <p className='season-key'>Each tick is a day a satellite passed; darker ticks gave a picture. Hollow dots were partly cloudy and are left off the line.</p>}
    {mostlyWater && <p className='season-note'>Much of this outline shows up as water. It may be a pond or a wet patch rather than a crop.</p>}
    {story.length > 0 && <div className='season-story'>{story.map(line => <p key={line}>{line}</p>)}</div>}

    <details className='season-about'>
      <summary>About these pictures</summary>
      <p>The pictures come from NASA's Harmonized Landsat and Sentinel-2 data (HLS, version 2.0), which puts several satellites on one 30 m grid, so a field is seen every few days. Each square is one measurement, drawn as it is, without smoothing.</p>
      <p>Greenness is NDVI, which compares near-infrared and red light. It shows how much green leaf there is. It does not say why: a dry spell, a harvest and a weedy patch can look alike.</p>
      <p>Squares on the edge of the field mix in the road or the next field, so the line uses only squares well inside it. Clouds are found by NASA's own cloud mask, which can miss thin haze.</p>
      {grid && <p className='season-small'>{grid.samplePixels} squares used, of {grid.fieldPixels} inside the outline{grid.tile ? `. Grid tile ${grid.tile.replace(/^T/, '')}` : ''}.{response?.failedScenes ? ` ${response.failedScenes} passes could not be read.` : ''}</p>}
      <p className='season-small'><a href='https://doi.org/10.5067/HLS/HLSS30.002' target='_blank' rel='noreferrer'>HLS Sentinel-2</a> and <a href='https://doi.org/10.5067/HLS/HLSL30.002' target='_blank' rel='noreferrer'>HLS Landsat</a>, NASA LP DAAC.</p>
    </details>
  </section>
}

// Greenness: tan for little green, deep green for a full canopy. The same scale on every date.
const STOPS: [number, [number, number, number]][] = [
  [0.1, [181, 155, 118]], [0.3, [217, 207, 160]], [0.45, [172, 173, 121]], [0.65, [119, 131, 90]], [0.85, [67, 89, 59]],
]
const PAPER: [number, number, number] = [240, 239, 235]
const NO_DATA: [number, number, number] = [214, 213, 207]

function ramp(value: number): [number, number, number] {
  if (value <= STOPS[0][0]) return STOPS[0][1]
  for (let i = 1; i < STOPS.length; i++) {
    const [x1, c1] = STOPS[i]
    if (value <= x1) {
      const [x0, c0] = STOPS[i - 1]
      const t = (value - x0) / (x1 - x0)
      return [0, 1, 2].map(k => Math.round(c0[k] + (c1[k] - c0[k]) * t)) as [number, number, number]
    }
  }
  return STOPS[STOPS.length - 1][1]
}

/** One picture at one canvas pixel per 30 m square; land outside the field is faded for context. */
function paint(width: number, height: number, pixels: SeasonPixels, mode: Mode, mask: Uint8Array) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  const image = context.createImageData(width, height)
  const rgb = decodeBytes(pixels.rgb)
  const ndvi = decodeBytes(pixels.ndvi)
  for (let i = 0; i < width * height; i++) {
    const px: [number, number, number] = mode === 'colour' ? [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]
      : ndvi[i] === 255 ? NO_DATA : ramp(ndvi[i] / 127 - 1)
    const fade = mask[i] ? 0 : 0.55
    image.data.set([px[0] + (PAPER[0] - px[0]) * fade, px[1] + (PAPER[1] - px[1]) * fade, px[2] + (PAPER[2] - px[2]) * fade, 255], i * 4)
  }
  context.putImageData(image, 0, 0)
  return canvas
}

function Frame({ grid, day, pixels, mode, label }: { grid: SeasonGrid; day: SeasonPoint; pixels: SeasonPixels; mode: Mode; label: string }) {
  const width = grid.width!, height = grid.height!
  const box = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLCanvasElement>(null)
  const shown = useRef<HTMLCanvasElement | null>(null)
  const mask = useMemo(() => decodeBytes(grid.fieldMask!), [grid.fieldMask])
  const cache = useRef(new Map<string, HTMLCanvasElement>())
  const [boxWidth, setBoxWidth] = useState(0)

  useEffect(() => { cache.current.clear() }, [grid.fieldMask])
  useEffect(() => {
    if (!box.current) return
    // Width only: the frame's height follows the picture, so observing it would loop.
    const observer = new ResizeObserver(([entry]) => setBoxWidth(Math.round(entry.contentRect.width)))
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !boxWidth) return
    const cacheKey = `${day.sceneId}|${mode}`
    let small = cache.current.get(cacheKey)
    if (!small) { small = paint(width, height, pixels, mode, mask); cache.current.set(cacheKey, small) }
    const clear = decodeBytes(pixels.clear)
    const dpr = window.devicePixelRatio || 1
    // Whole screen pixels per 30 m square keep every square the same size and crisp.
    const maxHeight = Math.min(400, window.innerHeight * 0.45)
    const s = Math.max(2, Math.floor(Math.min(boxWidth / width, maxHeight / height) * dpr))
    canvas.width = width * s
    canvas.height = height * s
    canvas.style.width = `${canvas.width / dpr}px`
    canvas.style.height = `${canvas.height / dpr}px`
    const context = canvas.getContext('2d')!
    const from = shown.current && shown.current !== small ? shown.current : null
    shown.current = small
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] > 0

    const draw = (alpha: number) => {
      context.imageSmoothingEnabled = false
      context.globalAlpha = 1
      if (from && alpha < 1) context.drawImage(from, 0, 0, canvas.width, canvas.height)
      context.globalAlpha = alpha
      context.drawImage(small, 0, 0, canvas.width, canvas.height)
      context.globalAlpha = 1
      // Cloud, shadow or haze over the field: stripes, so it is never mistaken for crop.
      context.strokeStyle = 'rgba(255,255,255,.85)'
      context.lineWidth = Math.max(1, s / 6)
      context.beginPath()
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x
        if (!mask[i] || clear[i]) continue
        context.moveTo(x * s, (y + 1) * s); context.lineTo((x + 1) * s, y * s)
        context.moveTo(x * s, (y + 0.5) * s); context.lineTo((x + 0.5) * s, y * s)
        context.moveTo((x + 0.5) * s, (y + 1) * s); context.lineTo((x + 1) * s, (y + 0.5) * s)
      }
      context.stroke()
      // The outline follows the squares counted as this field, not the drawn boundary.
      context.strokeStyle = '#3E2C1F'
      context.lineWidth = Math.max(2, s / 5)
      context.beginPath()
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (!inside(x, y)) continue
        if (!inside(x, y - 1)) { context.moveTo(x * s, y * s); context.lineTo((x + 1) * s, y * s) }
        if (!inside(x, y + 1)) { context.moveTo(x * s, (y + 1) * s); context.lineTo((x + 1) * s, (y + 1) * s) }
        if (!inside(x - 1, y)) { context.moveTo(x * s, y * s); context.lineTo(x * s, (y + 1) * s) }
        if (!inside(x + 1, y)) { context.moveTo((x + 1) * s, y * s); context.lineTo((x + 1) * s, (y + 1) * s) }
      }
      context.stroke()
    }
    if (!from || matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(1); return }
    let frame = 0
    const started = performance.now()
    const step = (time: number) => {
      const alpha = Math.min(1, (time - started) / 220)
      draw(alpha)
      if (alpha < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [day.sceneId, mode, pixels, mask, width, height, boxWidth])

  return <div ref={box} className='season-frame'><canvas ref={ref} role='img' aria-label={label} /></div>
}

const W = 720, H = 150, L = 34, R = 10, TOP = 12, BASE = 112
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const time = (iso: string) => Date.parse(`${iso}T12:00:00Z`)

/**
 * The season on a true date scale. Every day a satellite passed is a tick; clear days are dots on
 * the greenness line, which breaks where no clear look came for 20 days. Dots are for pointing;
 * the date slider above is the keyboard path.
 */
function Strip({ points, segments, period, pictures, current, onPick }: {
  points: SeasonPoint[]; segments: SeasonPoint[][]; period: { start: string; end: string }
  pictures: Record<string, SeasonPixels>; current?: string; onPick: (sceneId: string) => void
}) {
  const t0 = time(period.start), t1 = Math.max(time(period.end), t0 + 864e5)
  const x = (iso: string) => L + ((time(iso) - t0) / (t1 - t0)) * (W - L - R)
  const y = (value: number) => BASE - Math.max(0, Math.min(1, value)) * (BASE - TOP)
  const year = period.start.slice(0, 4)
  const months = MONTHS.map((name, i) => ({ name, at: `${year}-${String(i + 1).padStart(2, '0')}-15` })).filter(m => time(m.at) <= t1)
  const plotted = points.filter(point => point.ndvi !== null && (point.quality === 'clear' || point.quality === 'partial'))
  const clearCount = plotted.filter(point => point.quality === 'clear').length

  return <svg className='season-strip' viewBox={`0 0 ${W} ${H}`} role='img' aria-label={`Greenness through ${year}: ${clearCount} clear days on a line from low to high.`}>
    {[0, 0.5, 1].map(value => <g key={value}>
      <line x1={L} x2={W - R} y1={y(value)} y2={y(value)} className='season-grid' />
      <text x={L - 8} y={y(value) + 4} textAnchor='end' className='season-axis'>{value === 0 ? 'low' : value === 1 ? 'high' : ''}</text>
    </g>)}
    {months.map(month => <text key={month.name} x={x(month.at)} y={H - 6} textAnchor='middle' className='season-axis'>{month.name}</text>)}
    {points.map(point => <line key={point.sceneId} x1={x(point.date)} x2={x(point.date)} y1={BASE + 8} y2={BASE + 16}
      className={pictures[point.sceneId] ? 'season-pass season-pass-picture' : 'season-pass'} />)}
    {segments.map((segment, i) => <path key={i} className='season-line'
      d={segment.filter(point => point.ndvi !== null).map((point, k) => `${k ? 'L' : 'M'}${x(point.date).toFixed(1)},${y(point.ndvi!).toFixed(1)}`).join(' ')} />)}
    {plotted.map(point => {
      const on = point.sceneId === current
      const canPick = !!pictures[point.sceneId]
      return <circle key={point.sceneId} cx={x(point.date)} cy={y(point.ndvi!)} r={on ? 7 : 4.5}
        className={`season-dot${point.quality === 'partial' ? ' season-dot-partial' : ''}${on ? ' season-dot-on' : ''}${canPick ? ' season-dot-pick' : ''}`}
        onClick={canPick ? () => onPick(point.sceneId) : undefined}>
        <title>{`${shortDate(point.date)}, ${Math.round(point.clearShare * 100)}% clear`}</title>
      </circle>
    })}
  </svg>
}
