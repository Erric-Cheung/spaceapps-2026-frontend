
export type FieldReviewInput = {
  crop: string
  otherCrop: string
  readyDate: string
  confirmed: boolean
}

export const EMPTY_REVIEW: FieldReviewInput = { crop: '', otherCrop: '', readyDate: '', confirmed: false }
export const OTHER_CROP = '__other__'
export const NO_CROP = '__none__'
export const UNKNOWN_CROP = '__unknown__'

/** A specific crop or an explicit unknown answer needs a planting date to be confirmed. */
export function canConfirm(input: FieldReviewInput) {
  return input.crop !== ''
    && (input.crop !== OTHER_CROP || input.otherCrop.trim() !== '')
    && input.readyDate.trim() !== ''
}

/** Converts the form choice to the farmer's answer, without using mapped estimates. */
export function cropAnswer(input: FieldReviewInput) {
  if (input.crop === OTHER_CROP) return input.otherCrop.trim()
  if (input.crop === NO_CROP) return 'Nothing planted'
  if (input.crop === UNKNOWN_CROP) return 'Not sure'
  return input.crop
}

