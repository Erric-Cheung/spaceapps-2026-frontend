import type { FieldFeature } from './fields'

export type SubmittedField = { fieldId: string; crop: string; readyDate: string }
export type PlannedYear = { year: number; crop: string; rationale?: string }
export type RotationOption = {
  id: string
  title: string
  summary: string
  years: PlannedYear[]
  benefits: string[]
  tradeoff: string
}
export type CropPlanResponse = {
  planner: string
  temporary: boolean
  disclaimer: string
  plans: {
    fieldId: string
    currentCrop: string
    years: PlannedYear[]
    alternatives?: RotationOption[]
  }[]
}

/** Loads Java's catalog and requests a plan using the confirmed field answers. */
export async function fetchCropPlan(fields: FieldFeature[], answers: SubmittedField[], signal: AbortSignal): Promise<CropPlanResponse> {
  const catalogResponse = await fetch('/api/crops', { signal })
  if (!catalogResponse.ok) throw new Error('Could not load crop choices. Check the Java backend and try again.')
  const catalog: { crops: (string | { id: string; name: string })[] } = await catalogResponse.json()
  const growableCrops = catalog.crops.map(crop => typeof crop === 'string' ? crop : crop.id)
  if (!growableCrops.length) throw new Error('The backend returned no crop choices. Please try again later.')
  const request = answers.map(answer => {
    const field = fields.find(field => field.properties.id === answer.fieldId)
    if (!field) throw new Error('A selected field is missing. Go back and select your fields again.')
    return { fieldId: answer.fieldId, geometry: field.geometry, currentCrop: answer.crop, readyDate: answer.readyDate, growableCrops }
  })
  const response = await fetch('/api/crop-optimization', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ fields: request }),
    signal,
  })
  if (!response.ok) throw new Error(response.status === 422
    ? 'The planner could not accept these field answers. Go back to crops to check them, then try again.'
    : `Could not create a plan (HTTP ${response.status}). Check the Java backend and try again.`)
  const result: CropPlanResponse = await response.json()
  if (result.plans?.length !== answers.length || answers.some(answer =>
    !result.plans.some(plan => plan.fieldId === answer.fieldId && plan.years?.length === 5))) {
    throw new Error('The backend returned an incomplete plan. Please try again.')
  }
  if (result.planner === 'random-placeholder' && result.plans.some(plan => {
    const options = plan.alternatives
    return options?.length !== 3 || options.some(option => option.years?.length !== 5)
      || new Set(options.map(option => JSON.stringify(option.years.map(year => year.crop)))).size !== 3
  })) throw new Error('The demo backend must return three different rotations. Check that the latest Java backend is running, then try again.')
  return result
}
