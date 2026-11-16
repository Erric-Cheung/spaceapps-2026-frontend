/**
 * Ontario cities and larger towns, with approximate centres (lat, lng), for naming a point
 * that has no address: the example area and "Use my current location". Deliberately crude:
 * the nearest name on this list, not a reverse geocode, so it is instant and works offline.
 */
const CITIES: [string, number, number][] = [
  ['Toronto', 43.65, -79.38], ['Ottawa', 45.42, -75.69], ['Hamilton', 43.26, -79.87], ['London', 42.98, -81.25],
  ['Kitchener', 43.45, -80.49], ['Guelph', 43.55, -80.25], ['Cambridge', 43.36, -80.31], ['Brantford', 43.14, -80.26],
  ['Woodstock', 43.13, -80.75], ['Stratford', 43.37, -80.98], ['St. Thomas', 42.78, -81.19], ['Tillsonburg', 42.86, -80.73],
  ['Simcoe', 42.84, -80.30], ['Chatham', 42.40, -82.19], ['Windsor', 42.32, -83.04], ['Leamington', 42.05, -82.60],
  ['Sarnia', 42.97, -82.40], ['Strathroy', 42.96, -81.62], ['Goderich', 43.74, -81.71], ['Listowel', 43.73, -80.95],
  ['Owen Sound', 44.57, -80.94], ['Hanover', 44.15, -81.03], ['Walkerton', 44.13, -81.15], ['Kincardine', 44.18, -81.64],
  ['Collingwood', 44.50, -80.22], ['Barrie', 44.39, -79.69], ['Orillia', 44.61, -79.42], ['Midland', 44.75, -79.89],
  ['Alliston', 44.15, -79.87], ['Orangeville', 43.92, -80.10], ['Fergus', 43.71, -80.38], ['Shelburne', 44.08, -80.20],
  ['Newmarket', 44.06, -79.46], ['Bradford', 44.11, -79.56], ['Uxbridge', 44.11, -79.12], ['Oshawa', 43.90, -78.86],
  ['Lindsay', 44.36, -78.74], ['Peterborough', 44.30, -78.32], ['Cobourg', 43.96, -78.17], ['Port Hope', 43.95, -78.29],
  ['Belleville', 44.16, -77.38], ['Trenton', 44.10, -77.58], ['Picton', 44.01, -77.14], ['Napanee', 44.25, -76.95],
  ['Kingston', 44.23, -76.48], ['Brockville', 44.59, -75.68], ['Smiths Falls', 44.90, -76.02], ['Perth', 44.90, -76.25],
  ['Kemptville', 45.02, -75.64], ['Cornwall', 45.02, -74.73], ['Hawkesbury', 45.61, -74.61], ['Rockland', 45.55, -75.29],
  ['Carleton Place', 45.14, -76.14], ['Arnprior', 45.43, -76.36], ['Renfrew', 45.47, -76.68], ['Pembroke', 45.83, -77.11],
  ['Bancroft', 45.06, -77.85], ['Haliburton', 45.05, -78.51], ['Bracebridge', 45.04, -79.31], ['Huntsville', 45.33, -79.22],
  ['Parry Sound', 45.35, -80.04], ['North Bay', 46.31, -79.46], ['Sudbury', 46.49, -80.99], ['New Liskeard', 47.51, -79.68],
  ['Sault Ste. Marie', 46.52, -84.33], ['Timmins', 48.48, -81.33], ['Kapuskasing', 49.42, -82.43], ['Thunder Bay', 48.38, -89.25],
  ['Dryden', 49.78, -92.84], ['Kenora', 49.77, -94.49], ['Fort Frances', 48.61, -93.40], ['Niagara Falls', 43.09, -79.08],
  ['St. Catharines', 43.16, -79.24], ['Welland', 42.99, -79.25], ['Grimsby', 43.19, -79.56], ['Dunnville', 42.90, -79.62],
]

/** Beyond this, the nearest Ontario name would mislead more than help. */
const MAX_KM = 120

/** Nearest listed Ontario city to a point, e.g. "Orillia", or null when none is within 120 km. */
export function nearestCity(lat: number, lng: number): string | null {
  let best: string | null = null
  let bestKm = Infinity
  for (const [name, cityLat, cityLng] of CITIES) {
    const km = distanceKm(lat, lng, cityLat, cityLng)
    if (km < bestKm) { best = name; bestKm = km }
  }
  return bestKm <= MAX_KM ? best : null
}

/** Great-circle distance in kilometres. */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lng2 - lng1) * rad / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(a))
}
