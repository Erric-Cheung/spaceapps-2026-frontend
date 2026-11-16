/** One field's satellite season from the Java API: daily points, display pixels and a summary. */

export type SeasonPixels = { rgb: string; ndvi: string; clear: string }

export type SeasonQuality = 'clear' | 'partial' | 'cloudy' | 'snow' | 'water' | 'unobserved'

export type SeasonPoint = {
  date: string
  sceneId: string
  sensor: string
  quality: SeasonQuality
  description: string
  ndvi: number | null
  p10: number | null
  p50: number | null
  p90: number | null
  clearShare: number
  cloudShare: number
  snowShare: number
  waterShare: number
  coverageShare: number
  validPixels: number
  pixels: SeasonPixels | null
}

export type SeasonGrid = {
  resolutionM: number
  fieldPixels: number
  samplePixels: number
  interiorOnly: boolean
  tile: string | null
  width: number | null
  height: number | null
  contextM: number | null
  fieldMask: string | null
  areaHa: number | null
}

export type SeasonStatus = 'queued' | 'running' | 'done' | 'partial' | 'failed'

export type FieldSeasonResponse = {
  id: string
  year: number
  status: SeasonStatus
  message: string
  period: { start: string; end: string }
  progress: { processed: number; total: number | null }
  grid: SeasonGrid | null
  points: SeasonPoint[]
  segments: SeasonPoint[][]
  gaps: { start: string; end: string; days: number }[]
  summary: {
    clearObservations: number
    partialObservations: number
    otherObservations: number
    peakNdvi: number | null
    peakDate: string | null
    latestNdvi: number | null
    latestDate: string | null
    longestGapDays: number
  }
  axisTicks: number[]
  notes: string[]
  failedScenes: number
  error: string | null
  observationCount: number
}

/** What a client holds: the latest response plus every picture received so far, by scene. */
export type SeasonState = { response: FieldSeasonResponse | null; pictures: Record<string, SeasonPixels> }

export const EMPTY_SEASON: SeasonState = { response: null, pictures: {} }

export const isRunning = (status: SeasonStatus | undefined) => status === 'queued' || status === 'running'

/** The most recent season with a growing period behind it: this year from May, otherwise last year. */
export function defaultSeasonYear(today = new Date()) {
  return today.getMonth() >= 4 ? today.getFullYear() : today.getFullYear() - 1
}

/**
 * Starts or polls a field's season. Pictures arrive once: pass the previous observationCount as
 * `since` and keep earlier pictures by scene.
 */
export async function fetchFieldSeason(fieldId: string, year: number, since: number, retry = false, signal?: AbortSignal): Promise<FieldSeasonResponse> {
  const query = new URLSearchParams({ year: String(year), pixels: 'true', since: String(since) })
  if (retry) query.set('retry', 'true')
  const response = await fetch(`/api/fields/${encodeURIComponent(fieldId)}/season?${query}`, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new Error(`Season API returned ${response.status}`)
  return response.json()
}

/** Adds a poll's new pictures to those already held; points, grid and summary come from the latest poll. */
export function mergeSeason(state: SeasonState, response: FieldSeasonResponse): SeasonState {
  const pictures = { ...state.pictures }
  for (const point of response.points) if (point.pixels) pictures[point.sceneId] = point.pixels
  const grid = response.grid && !response.grid.fieldMask && state.response?.grid?.fieldMask
    ? { ...response.grid, fieldMask: state.response.grid.fieldMask } : response.grid
  return { response: { ...response, grid }, pictures }
}

/** Days that have a picture to show, in date order. */
export function pictureDays(state: SeasonState): SeasonPoint[] {
  return (state.response?.points ?? []).filter(point => state.pictures[point.sceneId])
}

/** Where to start: the greenest clear day, when the crop is easiest to recognise, else the latest picture. */
export function startIndex(days: SeasonPoint[], peakDate: string | null | undefined) {
  const peak = peakDate ? days.findIndex(day => day.date === peakDate) : -1
  return peak >= 0 ? peak : Math.max(0, days.length - 1)
}

export function decodeBytes(base64: string): Uint8Array {
  const text = atob(base64)
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
  return bytes
}

export const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
export const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })

/** Plain sentences about what was measured. They describe; they never say why something changed. */
export function seasonStory(response: FieldSeasonResponse, pictures: number): string[] {
  if (isRunning(response.status) && pictures < 5) return []
  const { summary, points, year } = response
  const lines = [`Satellites looked at this field on ${points.length} days in ${year}. ${pictures === 1 ? 'One' : pictures} of those gave a picture clear enough to show.`]
  if (summary.peakDate && summary.clearObservations >= 3) lines.push(`It looked greenest on ${shortDate(summary.peakDate)}.`)
  // Gaps that touch the start or end of the period are winter, before the first or after the last clear look.
  const longest = response.gaps.filter(gap => gap.start !== response.period.start && gap.end !== response.period.end)
    .sort((a, b) => b.days - a.days)[0]
  if (!isRunning(response.status) && longest && longest.days >= 14) {
    lines.push(`The longest stretch without a clear look was ${longest.days} days, from ${shortDate(longest.start)} to ${shortDate(longest.end)}. Anything that happened then is not shown.`)
  }
  return lines
}
