/** POST /api/fields/crop-history — takes field ids only, returns their crop history. */
export async function fetchCropHistory(ids: string[], signal?: AbortSignal): Promise<unknown> {
  const res = await fetch('/api/fields/crop-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    signal,
  })
  if (!res.ok) throw new Error(`Crop history API returned ${res.status}`)
  return res.json()
}
