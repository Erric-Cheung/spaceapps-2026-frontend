import type { MultiPolygon, Polygon } from 'geojson'

/** A point comfortably inside a polygon (grid search for the spot farthest from any edge). */
export function labelPoint(g: Polygon | MultiPolygon): [number, number] {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  let poly = polys[0]
  let best = -1
  for (const p of polys) {
    const r = p[0]
    let a = 0
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1])
    if (Math.abs(a) > best) { best = Math.abs(a); poly = p }
  }
  if (!poly) return [0, 0]
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  const inside = (x: number, y: number) => {
    let c = false
    for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  const edgeDist = (x: number, y: number) => {
    let d = Infinity
    for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j], [bx, by] = ring[i]
      const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy
      const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0
      d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy))
    }
    return d
  }
  let pt: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2], bestD = -1
  const n = 12
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * j) / n
    if (!inside(x, y)) continue
    const d = edgeDist(x, y)
    if (d > bestD) { bestD = d; pt = [x, y] }
  }
  return pt
}
