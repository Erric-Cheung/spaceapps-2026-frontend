import type { FieldFeature } from '../data/fields'

/** A north-up outline fitted to a small frame, preserving holes and separate parts. */
export default function FieldOutline({ field }: { field: FieldFeature }) {
  const polygons = field.geometry.type === 'Polygon' ? [field.geometry.coordinates] : field.geometry.coordinates
  const positions = polygons.flat(2)
  const lat = positions.reduce((sum, point) => sum + point[1], 0) / positions.length
  const scale = Math.cos(lat * Math.PI / 180)
  const xs = positions.map(point => point[0] * scale)
  const ys = positions.map(point => -point[1])
  const west = Math.min(...xs), north = Math.min(...ys)
  const width = Math.max(...xs) - west, height = Math.max(...ys) - north
  const fit = 48 / Math.max(width, height, Number.EPSILON)
  const x = (lon: number) => ((lon * scale - west) * fit + (64 - width * fit) / 2).toFixed(2)
  const y = (latitude: number) => ((-latitude - north) * fit + (64 - height * fit) / 2).toFixed(2)
  const path = polygons.flatMap(polygon => polygon.map(ring =>
    ring.map((point, index) => `${index ? 'L' : 'M'}${x(point[0])},${y(point[1])}`).join(' ') + 'Z',
  )).join(' ')

  return <svg className='field-outline' viewBox='0 0 64 64' aria-hidden='true'><path d={path} fillRule='evenodd' /></svg>
}
