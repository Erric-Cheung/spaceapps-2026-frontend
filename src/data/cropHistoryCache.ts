import { useEffect, useSyncExternalStore } from 'react'
import { fetchCropHistory, type CropHistoryResult } from './cropHistory.ts'

export type HistoryEntry = { status: 'loading' | 'ready' | 'error'; result?: CropHistoryResult }

/** Session cache with at most two history requests in flight across all selected fields. */
export function createHistoryCache() {
  let entries: Record<string, HistoryEntry> = {}
  let active = 0
  const queue: string[] = []
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(listener => listener())
  const set = (id: string, entry: HistoryEntry) => {
    entries = { ...entries, [id]: entry }
    notify()
  }
  const pump = () => {
    while (active < 2 && queue.length) {
      const id = queue.shift()!
      active++
      void fetchCropHistory([id], AbortSignal.timeout(90000))
        .then(response => {
          const result = response.results.find(result => result.id === id)
          set(id, result?.status === 'ok' && result.history
            ? { status: 'ready', result }
            : { status: 'error', result })
        })
        .catch(() => set(id, { status: 'error' }))
        .finally(() => { active--; pump() })
    }
  }
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => entries,
    ensure: (ids: string[]) => {
      // Drop work that has not started when its field is no longer selected.
      for (let i = queue.length - 1; i >= 0; i--) {
        if (!ids.includes(queue[i])) {
          const removed = queue.splice(i, 1)[0]
          const remaining = { ...entries }
          delete remaining[removed]
          entries = remaining
        }
      }
      for (const id of ids) {
        if (entries[id]) continue
        entries = { ...entries, [id]: { status: 'loading' } }
        queue.push(id)
      }
      notify()
      pump()
    },
    retry: (ids: string[]) => {
      for (const id of ids) {
        if (entries[id]?.status !== 'error') continue
        entries = { ...entries, [id]: { status: 'loading' } }
        queue.push(id)
      }
      notify()
      pump()
    },
  }
}

const cache = createHistoryCache()

/** Prefetch selected fields while keeping crop confirmation available immediately. */
export function useCropHistory(ids: string[]) {
  const entries = useSyncExternalStore(cache.subscribe, cache.getSnapshot)
  useEffect(() => { cache.ensure(ids) }, [ids])
  return { entries, retry: () => cache.retry(ids) }
}
