import type { CropYear, FieldHistory } from './cropHistory'

const year = (value: number, groupLabel: string, group: string): CropYear => ({
  year: value, crop: groupLabel, code: 0, isCrop: true, group, groupLabel, share: 0.9, classes: [],
})

const recent = [
  year(2021, 'Corn', 'corn'), year(2022, 'Soybeans', 'soy'), year(2023, 'Corn', 'corn'),
  year(2024, 'Soybeans', 'soy'), year(2025, 'Corn', 'corn'),
]
const slots = recent.map(observation => ({ year: observation.year, observation }))

/**
 * Layout-only stand-in for a field's crop history, shaped like a typical result
 * (five mapped years and a pattern sentence), so the loading skeleton takes the
 * space the real history will. Never shown as text.
 */
export const SAMPLE_FIELD_HISTORY: FieldHistory = {
  id: 'sample',
  source: null,
  years: recent,
  rotation: [],
  distinctCrops: [],
  cropYears: recent.length,
  unavailableYears: [],
  note: '',
  summary: {
    yearsOfData: recent.length,
    firstYear: 2021,
    lastSeason: null,
    pattern: { kind: 'alternating', periodYears: 2, groups: ['corn', 'soy'], text: 'This field has alternated between corn and soybeans for the last five years.' },
    expectedThisYear: null,
    flags: { possiblyMerged: false, mostlyNotCropland: false },
    notes: [],
    reviewYear: 2026,
    latestMapped: recent[recent.length - 1],
    currentCrop: { year: 2026, status: 'estimated', group: 'soy', crop: 'Soybeans', confidence: 'high', reason: 'The maps show corn and soybeans taking turns, so soybeans would come next.' },
    recentYears: slots,
    timeline: slots,
  },
}

/** Stand-in for the suggestion paragraph beside the crop question. */
export const SAMPLE_SUGGESTION = SAMPLE_FIELD_HISTORY.summary!.currentCrop
