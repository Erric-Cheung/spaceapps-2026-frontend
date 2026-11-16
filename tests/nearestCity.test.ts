import assert from 'node:assert/strict'
import test from 'node:test'
import { nearestCity } from '../src/data/nearestCity.ts'

test('a point with no address is named after the nearest Ontario city', () => {
  assert.equal(nearestCity(44.58, -79.52), 'Orillia') // the example area
  assert.equal(nearestCity(44.35, -78.80), 'Lindsay')
  assert.equal(nearestCity(43.55, -80.27), 'Guelph')
})

test('points far from every listed city get no name', () => {
  assert.equal(nearestCity(51.05, -114.07), null) // Calgary
})
