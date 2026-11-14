import assert from 'node:assert/strict'
import test from 'node:test'
import { constrainMapCenter } from '../src/lib/mapNavigation.ts'

test('interior, coast, islands and coverage edges remain reachable', () => {
  const places: [string, [number, number]][] = [
    ['Orillia', [-79.42, 44.61]], ['Vancouver coast', [-123.25, 49.2]],
    ['Newfoundland', [-52.71, 47.56]], ['Nova Scotia', [-63.57, 44.65]],
    ['Florida Keys', [-81.78, 24.55]], ['Hawaii', [-155.6, 19.6]],
    ['Alaska', [-149.9, 61.2]], ['Mexico south coast', [-92.3, 14.7]],
    ['Baja California', [-109.9, 22.9]], ['Great Lakes', [-82.5, 44]],
    ['coastal breathing room', [-123.7, 49.2]],
  ]
  for (const [name, point] of places) assert.deepEqual(constrainMapCenter(point), point, name)
})

test('deep oceans and other continents are constrained to the navigation envelope', () => {
  for (const point of [[-135, 30], [-40, 40], [2.35, 48.86], [-70, -30]] as [number, number][]) {
    const limited = constrainMapCenter(point)
    assert.notDeepEqual(limited, point)
    assert.ok(limited.every(Number.isFinite))
    const again = constrainMapCenter(limited)
    assert.ok(Math.abs(limited[0] - again[0]) < 0.00001)
    assert.ok(Math.abs(limited[1] - again[1]) < 0.00001)
  }
})
