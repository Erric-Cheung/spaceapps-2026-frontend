export type CropHistorySource = {
  name: string
  url: string
  license: string
  resolutionM: number
}

export type CropYearClass = {
  code: number
  name: string
  isCrop: boolean
  share: number
}

export type CropYear = {
  year: number
  crop: string
  code: number
  isCrop: boolean
  /** Crop group shared by both countries, e.g. "corn". */
  group?: string
  /** The crop group in plain words, e.g. "Corn". */
  groupLabel?: string
  share: number
  /** Share of the field under any crop. */
  cropShare?: number
  classes: CropYearClass[]
}

/** The crop the rotation pattern points to this year. An estimate, not an observation. */
export type ExpectedCrop = {
  year: number
  group: string
  crop: string
  confidence: 'high' | 'medium'
  reason: string
}

/** Plain-language reading of a field's crop history, ready to display. */
export type CropHistorySummary = {
  yearsOfData: number
  firstYear: number | null
  /** The newest mapped year: always last season, never the current year. */
  lastSeason: { year: number; crop: string; group: string; groupLabel: string } | null
  pattern: {
    kind: 'stable' | 'alternating' | 'rotation' | 'changed' | 'mixed'
    periodYears: number | null
    groups: string[]
    text: string
  } | null
  expectedThisYear: ExpectedCrop | null
  flags: { possiblyMerged: boolean; mostlyNotCropland: boolean }
  notes: string[]
}

export type FieldHistory = {
  id: string
  source: CropHistorySource
  years: CropYear[]
  rotation: string[]
  distinctCrops: string[]
  cropYears: number
  unavailableYears: number[]
  summary?: CropHistorySummary
  note: string
}

export type CropHistoryResult = {
  id: string
  status: string
  history?: FieldHistory
  error?: { code: number; detail: string }
}

export type CropHistoryResponse = {
  results: CropHistoryResult[]
  requested: number
  succeeded: number
  failed: number
}

/** POST /api/fields/crop-history — takes field ids only, returns one result per field. */
export async function fetchCropHistory(ids: string[], signal?: AbortSignal): Promise<CropHistoryResponse> {
  const res = await fetch('/api/fields/crop-history', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ ids }),
    signal,
  })
  if (!res.ok) throw new Error(`Crop history API returned ${res.status}`)
  return res.json()
}
