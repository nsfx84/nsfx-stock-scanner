// Bulk screener: pull overviews for N tickers in parallel batches,
// score each, surface results as they complete.
//
// Concurrency is capped to be polite to Yahoo. Failures don't abort
// the run — they're recorded and the screener moves on.

import { getOverview } from './yahoo.js'
import { computeQuickScore } from './quickScore.js'

const CONCURRENCY = 10

export async function runScreener(tickers, { onProgress, abortSignal } = {}) {
  const results = []
  let completed = 0
  const total = tickers.length

  // Worker pool: each worker pulls the next ticker off a shared queue
  const queue = [...tickers]
  async function worker() {
    while (queue.length > 0) {
      if (abortSignal?.aborted) return
      const symbol = queue.shift()
      try {
        const { data, fromCache } = await getOverview(symbol)
        if (data && data.Symbol) {
          const score = computeQuickScore(data)
          results.push({
            symbol: data.Symbol,
            name: data.Name,
            sector: data.Sector,
            marketCap: data.MarketCapitalization,
            pe: data.PERatio,
            pb: data.PriceToBookRatio,
            roe: data.ReturnOnEquityTTM,
            margin: data.ProfitMargin,
            revGrowth: data.QuarterlyRevenueGrowthYOY,
            epsGrowth: data.QuarterlyEarningsGrowthYOY,
            divYield: data.DividendYield,
            composite: score.composite,
            pillars: score.pillars,
            verdict: score.verdict,
            fromCache
          })
        }
      } catch (err) {
        // Record the failure so we can show it in the UI
        results.push({ symbol, error: err.message })
      } finally {
        completed++
        if (onProgress) onProgress({ completed, total, symbol })
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker())
  await Promise.all(workers)
  return results
}

// Group results into verdict bands for the UI
export function groupByVerdict(results) {
  const bands = {
    strongBuy: { label: 'Strong Buy candidates', range: '75–100', tone: 'accent', items: [] },
    closerLook: { label: 'Worth a closer look',  range: '60–74',  tone: 'accent', items: [] },
    mixed:      { label: 'Mixed signals',         range: '45–59',  tone: 'warn',   items: [] },
    weak:       { label: 'Weak — be cautious',    range: '30–44',  tone: 'warn',   items: [] },
    avoid:      { label: 'Avoid',                 range: '<30',    tone: 'bad',    items: [] },
    nodata:     { label: 'Insufficient data',     range: '—',      tone: 'muted',  items: [] }
  }
  for (const r of results) {
    if (r.error || r.composite == null) bands.nodata.items.push(r)
    else if (r.composite >= 75) bands.strongBuy.items.push(r)
    else if (r.composite >= 60) bands.closerLook.items.push(r)
    else if (r.composite >= 45) bands.mixed.items.push(r)
    else if (r.composite >= 30) bands.weak.items.push(r)
    else bands.avoid.items.push(r)
  }
  // Sort within each band by composite desc
  for (const k of Object.keys(bands)) {
    bands[k].items.sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1))
  }
  return bands
}
