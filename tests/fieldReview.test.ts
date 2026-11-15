import assert from 'node:assert/strict'
import test from 'node:test'
import { canConfirm, cropAnswer, EMPTY_REVIEW, NO_CROP, UNKNOWN_CROP, OTHER_CROP } from '../src/data/fieldReview.ts'
const readyDate = '2027-05-01'

test('nothing planted and unknown are distinct farmer answers that require a date', () => {
  for (const [crop, answer] of [[NO_CROP, 'Nothing planted'], [UNKNOWN_CROP, 'Not sure']]) {
    const input = { ...EMPTY_REVIEW, crop, readyDate }
    assert.ok(canConfirm(input))
    assert.equal(cropAnswer(input), answer)
    assert.equal(canConfirm({ ...input, readyDate: '' }), false)
  }
  assert.equal(canConfirm(EMPTY_REVIEW), false)
})

test('other crop needs a name, and every answer needs a planting date', () => {
  assert.equal(canConfirm({ ...EMPTY_REVIEW, crop: OTHER_CROP, otherCrop: '  ', readyDate }), false)
  const input = { ...EMPTY_REVIEW, crop: OTHER_CROP, otherCrop: '  Lentils  ', readyDate }
  assert.ok(canConfirm(input))
  assert.equal(cropAnswer(input), 'Lentils')
  assert.ok(canConfirm({ ...EMPTY_REVIEW, crop: 'Corn', readyDate }))
  assert.equal(canConfirm({ ...EMPTY_REVIEW, crop: 'Corn' }), false)
})

