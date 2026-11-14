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
  share: number
  classes: CropYearClass[]
}

export type FieldHistory = {
  id: string
  source: CropHistorySource
  years: CropYear[]
  rotation: string[]
  distinctCrops: string[]
  cropYears: number
  unavailableYears: number[]
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
