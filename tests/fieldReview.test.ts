import assert from 'node:assert/strict'
import test from 'node:test'
import { canConfirm, cropAnswer, EMPTY_REVIEW, NO_CROP, UNKNOWN_CROP, OTHER_CROP } from '../src/data/fieldReview.ts'
test('nothing planted and unknown are distinct farmer answers, with no date required', () => {
  for (const [crop, answer] of [[NO_CROP, 'Nothing planted'], [UNKNOWN_CROP, 'Not sure']]) {
    const input = { ...EMPTY_REVIEW, crop }
    assert.ok(canConfirm(input))
    assert.equal(cropAnswer(input), answer)
  }
  assert.equal(canConfirm(EMPTY_REVIEW), false)
})

test('other crop needs a name, while named crops do not require a date', () => {
  assert.equal(canConfirm({ ...EMPTY_REVIEW, crop: OTHER_CROP, otherCrop: '  ' }), false)
  const input = { ...EMPTY_REVIEW, crop: OTHER_CROP, otherCrop: '  Lentils  ' }
  assert.ok(canConfirm(input))
  assert.equal(cropAnswer(input), 'Lentils')
  assert.ok(canConfirm({ ...EMPTY_REVIEW, crop: 'Corn' }))
})

