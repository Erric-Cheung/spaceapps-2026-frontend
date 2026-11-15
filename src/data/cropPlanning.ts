import type { FieldFeature } from './fields'

export type SubmittedField = { fieldId: string; crop: string; readyDate: string }
export type CatalogCrop = { id: string; name: string }
export type PlannedYear = {
  year: number
  crop: string
  cropId?: string
  soilScore?: number
  reliability?: number
  incomePerHa?: number
  rationale?: string
  reasons?: string[]
}
export type RotationOption = {
  id: string
  title: string
  summary: string
  years: PlannedYear[]
  benefits: string[]
  tradeoff: string
}
export type FieldPlanResponse = {
  fieldId: string
  currentCrop: string
  years: PlannedYear[]
  totalSoilScore?: number
  totalIncome?: number
  assumptions?: string[]
  alternatives?: RotationOption[]
}
export type CropPlanResponse = {
  planner: string
  temporary: boolean
  disclaimer: string
  plans: FieldPlanResponse[]
}

/** One complete five-year rotation the farmer can compare with the others. */
export type RotationChoice = {
  id: string
  title: string
  summary: string
  /** Crops the optimizer was told not to use for this option. */
  excluded: string[]
  years: PlannedYear[]
  benefits: string[]
  tradeoff: string
  totalSoilScore?: number
  totalIncome?: number
}

export type PlannedField =
  | {
    fieldId: string
    status: 'planned'
    answer: string
    /** The catalog crop the plan starts from. */
    startCrop: string
    /** Set when the farmer's answer was not a catalog crop and the mapped crop was used instead. */
    mappedStart: boolean
    options: RotationChoice[]
    assumptions: string[]
  }
  | { fieldId: string; status: 'unplannable'; answer: string }

export type CropPlanResult = {
  planner: string
  temporary: boolean
  disclaimer: string
  catalog: CatalogCrop[]
  exampleData: boolean
  catalogNote?: string
  fields: PlannedField[]
}

export type PlanProgress = { round: number; rounds: number }

/** The answer cropAnswer() gives for "I'm not sure". */
export const UNSURE_ANSWER = 'Not sure'
const OPTION_COUNT = 3
const PLAN_YEARS = 5

const sameCrop = (crop: CatalogCrop, value: string) => {
  const wanted = value.trim().toLowerCase()
  return crop.id.toLowerCase() === wanted || crop.name.toLowerCase() === wanted
}

/** The crop that fills most years of a rotation; ties go to the earliest year. */
export function mainCrop(years: PlannedYear[]): string {
  const counts = new Map<string, number>()
  for (const year of years) counts.set(year.crop, (counts.get(year.crop) ?? 0) + 1)
  let best = years[0].crop
  for (const year of years) if ((counts.get(year.crop) ?? 0) > (counts.get(best) ?? 0)) best = year.crop
  return best
}

const listInWords = (names: string[]) => names.length <= 1 ? names.join('')
  : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`

async function loadCatalog(signal: AbortSignal) {
  const response = await fetch('/api/crops', { signal })
  if (!response.ok) throw new Error('Could not load crop choices. Check the Java backend and try again.')
  const body: { crops: (string | CatalogCrop)[]; exampleData?: boolean; note?: string } = await response.json()
  const catalog = body.crops.map(crop => typeof crop === 'string' ? { id: crop, name: crop } : { id: crop.id, name: crop.name })
  if (!catalog.length) throw new Error('The backend returned no crop choices. Please try again later.')
  return { catalog, exampleData: body.exampleData ?? false, note: body.note }
}

async function requestPlans(fields: unknown[], signal: AbortSignal): Promise<CropPlanResponse> {
  const response = await fetch('/api/crop-optimization', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ fields }),
    signal,
  })
  if (!response.ok) throw new Error(response.status === 422
    ? 'The planner could not accept these field answers. Go back to crops to check them, then try again.'
    : `Could not create a plan (HTTP ${response.status}). Check the Java backend and try again.`)
  return response.json()
}

function checkComplete(result: CropPlanResponse, fieldIds: string[]) {
  if (result.plans?.length !== fieldIds.length || fieldIds.some(id =>
    !result.plans.some(plan => plan.fieldId === id && plan.years?.length === PLAN_YEARS))) {
    throw new Error('The backend returned an incomplete plan. Please try again.')
  }
}

const sequenceKey = (years: PlannedYear[]) => JSON.stringify(years.map(year => year.crop))

/**
 * Builds three five-year rotations per field from Java's planner.
 *
 * The optimizer returns its single best plan. To give real alternatives, it is asked again
 * without the main crop of the previous option, so each option is still the planner's best
 * answer under a plain constraint ("without alfalfa"). If a planner already returns three
 * alternatives, those are used as they are.
 *
 * @param mappedCrops the crop the map shows for each field, used only when the farmer
 *   answered "I'm not sure"
 */
export async function fetchCropPlan(
  fields: FieldFeature[],
  answers: SubmittedField[],
  mappedCrops: Record<string, string | null | undefined>,
  signal: AbortSignal,
  onProgress?: (progress: PlanProgress) => void,
): Promise<CropPlanResult> {
  const { catalog, exampleData, note } = await loadCatalog(signal)
  const allIds = catalog.map(crop => crop.id)

  const planned: { answer: SubmittedField; field: FieldFeature; start: CatalogCrop; mappedStart: boolean }[] = []
  const results = new Map<string, PlannedField>()
  for (const answer of answers) {
    const field = fields.find(field => field.properties.id === answer.fieldId)
    if (!field) throw new Error('A selected field is missing. Go back and select your fields again.')
    const stated = catalog.find(crop => sameCrop(crop, answer.crop))
    const mapped = mappedCrops[answer.fieldId]
    // Only an "I'm not sure" answer may fall back to the map; any other answer is the farmer's word.
    const fallback = !stated && mapped && answer.crop === UNSURE_ANSWER ? catalog.find(crop => sameCrop(crop, mapped)) : undefined
    const start = stated ?? fallback
    if (start) planned.push({ answer, field, start, mappedStart: !stated })
    else results.set(answer.fieldId, { fieldId: answer.fieldId, status: 'unplannable', answer: answer.crop })
  }

  const ordered = () => answers.map(answer => results.get(answer.fieldId)!)
  if (!planned.length) return { planner: '', temporary: false, disclaimer: '', catalog, exampleData, catalogNote: note, fields: ordered() }

  const options = new Map<string, RotationChoice[]>(planned.map(item => [item.answer.fieldId, []]))
  const excluded = new Map<string, string[]>(planned.map(item => [item.answer.fieldId, []]))
  const assumptions = new Map<string, string[]>()
  let meta: CropPlanResponse | null = null

  for (let round = 0; round < OPTION_COUNT; round++) {
    onProgress?.({ round: round + 1, rounds: OPTION_COUNT })
    const request = planned.map(({ answer, field, start }) => {
      const skip = excluded.get(answer.fieldId)!
      const growable = catalog.filter(crop => !skip.includes(crop.name)).map(crop => crop.id)
      return {
        fieldId: answer.fieldId,
        geometry: field.geometry,
        currentCrop: start.id,
        readyDate: answer.readyDate,
        growableCrops: growable.length ? growable : allIds,
      }
    })
    const result = await requestPlans(request, signal)
    checkComplete(result, planned.map(item => item.answer.fieldId))
    meta ??= result

    // A planner that already returns three alternatives needs no further rounds.
    if (round === 0 && result.plans.every(plan => plan.alternatives?.length)) {
      if (result.plans.some(plan => plan.alternatives!.length !== OPTION_COUNT
        || plan.alternatives!.some(option => option.years?.length !== PLAN_YEARS)
        || new Set(plan.alternatives!.map(option => sequenceKey(option.years))).size !== OPTION_COUNT)) {
        throw new Error('The backend must return three different rotations. Check that the latest Java backend is running, then try again.')
      }
      for (const plan of result.plans) {
        options.set(plan.fieldId, plan.alternatives!.map(option => ({ ...option, excluded: [] })))
        assumptions.set(plan.fieldId, plan.assumptions ?? [])
      }
      break
    }

    for (const plan of result.plans) {
      const list = options.get(plan.fieldId)!
      const skip = excluded.get(plan.fieldId)!
      if (round === 0) assumptions.set(plan.fieldId, plan.assumptions ?? [])
      const duplicate = list.some(option => sequenceKey(option.years) === sequenceKey(plan.years))
      if (!duplicate) {
        list.push({
          id: `option-${round + 1}`,
          title: skip.length ? `Without ${listInWords(skip).toLowerCase()}` : 'Best match for this field',
          summary: skip.length
            ? `The planner's best rotation if you would rather not grow ${listInWords(skip).toLowerCase()}.`
            : 'The rotation the planner scores highest for soil health and for how well each crop suits this field.',
          excluded: [...skip],
          years: plan.years,
          benefits: [],
          tradeoff: '',
          totalSoilScore: plan.totalSoilScore,
          totalIncome: plan.totalIncome,
        })
      }
      const next = mainCrop(plan.years)
      if (!skip.includes(next)) skip.push(next)
    }
  }

  for (const { answer, start, mappedStart } of planned) {
    results.set(answer.fieldId, {
      fieldId: answer.fieldId,
      status: 'planned',
      answer: answer.crop,
      startCrop: start.name,
      mappedStart,
      options: options.get(answer.fieldId)!,
      assumptions: assumptions.get(answer.fieldId) ?? [],
    })
  }
  return {
    planner: meta!.planner,
    temporary: meta!.temporary,
    disclaimer: meta!.disclaimer,
    catalog,
    exampleData,
    catalogNote: note,
    fields: ordered(),
  }
}
