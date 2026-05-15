// Score history.
//
// Each scan run gets snapshotted with timestamp. Re-runs show deltas
// (▲/▼ vs the most recent prior scan of the same universe).
//
// Stored as localStorage entries:
//   history:scans -> [{id, universe, ts, summary, count}, ...]
//   history:scan:<id> -> { universe, ts, results: [...] }
//
// We cap to ~10 recent scans per universe to keep storage manageable.

const INDEX_KEY = 'history:scans'
const MAX_PER_UNIVERSE = 10

function loadIndex() {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY)) || [] }
  catch { return [] }
}

function saveIndex(idx) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(idx)) }
  catch {}
}

export function saveSnapshot(universe, results) {
  const id = `${universe}:${Date.now()}`
  const idx = loadIndex()

  // Keep only top-N most recent per universe
  const sameUni = idx.filter(s => s.universe === universe).sort((a, b) => b.ts - a.ts)
  const toRemove = sameUni.slice(MAX_PER_UNIVERSE - 1)
  toRemove.forEach(s => {
    try { localStorage.removeItem(`history:scan:${s.id}`) } catch {}
  })
  const kept = idx.filter(s => !toRemove.find(r => r.id === s.id))

  // Compact the snapshot — store only fields we need for the diff view
  const compact = results
    .filter(r => !r.error)
    .map(r => ({
      symbol: r.symbol,
      name: r.name,
      sector: r.sector,
      composite: r.composite,
      sectorComposite: r.sectorComposite ?? null
    }))

  const entry = {
    id, universe, ts: Date.now(),
    count: compact.length,
    summary: summarise(results)
  }
  kept.unshift(entry)
  saveIndex(kept)
  try {
    localStorage.setItem(`history:scan:${id}`, JSON.stringify({ universe, ts: entry.ts, results: compact }))
  } catch (e) {
    // localStorage full — drop oldest
    console.warn('History storage full:', e.message)
  }
  return entry
}

function summarise(results) {
  const ok = results.filter(r => !r.error && r.composite != null)
  if (ok.length === 0) return { avgScore: null, strongBuy: 0, avoid: 0 }
  return {
    avgScore: Math.round(ok.reduce((a, r) => a + r.composite, 0) / ok.length),
    strongBuy: ok.filter(r => r.composite >= 75).length,
    avoid:     ok.filter(r => r.composite < 30).length
  }
}

export function listSnapshots(universe = null) {
  const all = loadIndex()
  return universe ? all.filter(s => s.universe === universe) : all
}

export function loadSnapshot(id) {
  try { return JSON.parse(localStorage.getItem(`history:scan:${id}`)) }
  catch { return null }
}

export function getPriorSnapshot(universe, beforeTs = Date.now()) {
  const all = loadIndex().filter(s => s.universe === universe && s.ts < beforeTs)
  if (all.length === 0) return null
  all.sort((a, b) => b.ts - a.ts)
  return loadSnapshot(all[0].id)
}

// Annotate fresh results with deltas vs the most recent prior snapshot.
export function annotateWithDeltas(results, universe) {
  const prior = getPriorSnapshot(universe)
  if (!prior) return { results, hasDeltas: false }
  const priorMap = new Map(prior.results.map(r => [r.symbol, r]))
  for (const r of results) {
    const p = priorMap.get(r.symbol)
    if (p && p.composite != null && r.composite != null) {
      r.priorComposite = p.composite
      r.delta = r.composite - p.composite
    }
  }
  return { results, hasDeltas: true, priorTs: prior.ts }
}

export function deleteSnapshot(id) {
  const idx = loadIndex().filter(s => s.id !== id)
  saveIndex(idx)
  try { localStorage.removeItem(`history:scan:${id}`) } catch {}
}

export function clearAllHistory() {
  const idx = loadIndex()
  idx.forEach(s => { try { localStorage.removeItem(`history:scan:${s.id}`) } catch {} })
  try { localStorage.removeItem(INDEX_KEY) } catch {}
}
