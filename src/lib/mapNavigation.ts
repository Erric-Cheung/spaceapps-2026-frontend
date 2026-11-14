import { navigationRegions } from '../data/mapCoverage.ts'

type Position = [number, number]
const radians = Math.PI / 180
const project = ([lng, lat]: Position): Position => [lng * radians, Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * radians / 2))]
const unproject = ([x, y]: Position): Position => [x / radians, (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / radians]
const regions = navigationRegions.map(ring => ring.map(project))

function contains([x, y]: Position, ring: Position[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Keep the camera near covered land, with an offshore margin for coastal fields. */
export function constrainMapCenter(position: Position): Position {
  const point = project(position)
  if (regions.some(ring => contains(point, ring))) return position
  let nearest = point
  let distance = Infinity
  for (const ring of regions) {
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1]
      const b = ring[i]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const lengthSquared = dx * dx + dy * dy
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared))
      const candidate: Position = [a[0] + t * dx, a[1] + t * dy]
      const d = (candidate[0] - point[0]) ** 2 + (candidate[1] - point[1]) ** 2
      if (d < distance) { nearest = candidate; distance = d }
    }
  }
  return unproject(nearest)
}
