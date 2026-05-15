// Sector-relative scoring.
//
// Instead of hard-coded broad-market thresholds (P/E of 15 always scores 80),
// we compute the median and quartiles of each metric WITHIN each sector
// from the most recent screener scan. A stock's metric is then scored by
// how it ranks against its sector peers, not against the broad market.
//
// This makes tech stocks no longer auto-penalised for high P/Es, and
// makes utilities no longer auto-rewarded for low ones.

function percentile(sorted, p) {
  if (sorted.length === 0) return null
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo)
}

// For each sector, compute distribution for each metric we score on.
// Returns: { 'Technology': { pe: {p25, p50, p75}, roe: {...}, ... } }
export function computeSectorBenchmarks(rows) {
  const bySector = {}
  for (const r of rows) {
    if (!r.sector || r.error) continue
    const s = r.sector
    if (!bySector[s]) bySector[s] = { pe: [], pb: [], roe: [], margin: [], revGrowth: [], epsGrowth: [], beta: [] }
    if (r.pe != null && +r.pe > 0)      bySector[s].pe.push(+r.pe)        // negative P/E excluded — we'll penalise separately
    if (r.pb != null && +r.pb > 0)      bySector[s].pb.push(+r.pb)
    if (r.roe != null && !isNaN(+r.roe))      bySector[s].roe.push(+r.roe)
    if (r.margin != null && !isNaN(+r.margin)) bySector[s].margin.push(+r.margin)
    if (r.revGrowth != null && !isNaN(+r.revGrowth)) bySector[s].revGrowth.push(+r.revGrowth)
    if (r.epsGrowth != null && !isNaN(+r.epsGrowth)) bySector[s].epsGrowth.push(+r.epsGrowth)
  }
  const out = {}
  for (const [sector, metrics] of Object.entries(bySector)) {
    out[sector] = {}
    for (const [m, values] of Object.entries(metrics)) {
      if (values.length < 3) continue   // not enough data
      const sorted = [...values].sort((a, b) => a - b)
      out[sector][m] = {
        n: sorted.length,
        p25: percentile(sorted, 0.25),
        p50: percentile(sorted, 0.50),
        p75: percentile(sorted, 0.75)
      }
    }
  }
  return out
}

// Score a value against its sector's distribution.
// `kind`:
//   - 'lower_better' (P/E, P/B): bottom quartile = 90, top quartile = 30
//   - 'higher_better' (ROE, margin, growth): top quartile = 90, bottom quartile = 30
function scoreVsSector(value, dist, kind) {
  if (value == null || isNaN(value) || !dist) return null
  // Use linear interpolation across p25/p50/p75 anchored at 90/65/30 (or reverse)
  let s
  if (kind === 'lower_better') {
    if (value <= dist.p25) s = 90 + (1 - Math.min(1, value / dist.p25)) * 10
    else if (value <= dist.p50) {
      const t = (value - dist.p25) / (dist.p50 - dist.p25)
      s = 90 - t * 25  // 90 -> 65
    } else if (value <= dist.p75) {
      const t = (value - dist.p50) / (dist.p75 - dist.p50)
      s = 65 - t * 35  // 65 -> 30
    } else {
      const overshoot = (value - dist.p75) / dist.p75
      s = Math.max(5, 30 - overshoot * 25)
    }
  } else { // higher_better
    if (value >= dist.p75) {
      const t = Math.min(2, (value - dist.p75) / Math.max(0.001, dist.p75))
      s = Math.min(95, 90 + t * 5)
    } else if (value >= dist.p50) {
      const t = (value - dist.p50) / Math.max(0.001, dist.p75 - dist.p50)
      s = 65 + t * 25
    } else if (value >= dist.p25) {
      const t = (value - dist.p25) / Math.max(0.001, dist.p50 - dist.p25)
      s = 30 + t * 35
    } else {
      const undershoot = (dist.p25 - value) / Math.max(0.001, Math.abs(dist.p25))
      s = Math.max(5, 30 - undershoot * 25)
    }
  }
  return Math.round(Math.max(0, Math.min(100, s)))
}

// Compute sector-relative pillar scores. Returns same shape as quickScore.
export function computeSectorRelativeScore(row, benchmarks) {
  const sector = row.sector
  const dist = benchmarks[sector]
  if (!dist) return null   // No benchmarks for this sector — caller falls back to broad-market

  const fundMetrics = []

  // P/E (lower better, with negative-earnings penalty)
  const pe = +row.pe
  if (!isNaN(pe)) {
    if (pe <= 0) {
      fundMetrics.push({ name: 'P/E (sector)', value: pe.toFixed(1), score: 15, note: 'Negative earnings' })
    } else if (dist.pe) {
      const s = scoreVsSector(pe, dist.pe, 'lower_better')
      fundMetrics.push({
        name: 'P/E (sector)', value: pe.toFixed(1), score: s,
        note: `Sector median ${dist.pe.p50.toFixed(1)}`
      })
    }
  }

  // P/B (lower better)
  const pb = +row.pb
  if (!isNaN(pb) && pb > 0 && dist.pb) {
    const s = scoreVsSector(pb, dist.pb, 'lower_better')
    fundMetrics.push({
      name: 'P/B (sector)', value: pb.toFixed(2), score: s,
      note: `Sector median ${dist.pb.p50.toFixed(2)}`
    })
  }

  // ROE (higher better)
  const roe = +row.roe
  if (!isNaN(roe) && dist.roe) {
    const s = scoreVsSector(roe, dist.roe, 'higher_better')
    fundMetrics.push({
      name: 'ROE (sector)', value: `${(roe * 100).toFixed(1)}%`, score: s,
      note: `Sector median ${(dist.roe.p50 * 100).toFixed(1)}%`
    })
  }

  // Margin (higher better)
  const margin = +row.margin
  if (!isNaN(margin) && dist.margin) {
    const s = scoreVsSector(margin, dist.margin, 'higher_better')
    fundMetrics.push({
      name: 'Profit Margin (sector)', value: `${(margin * 100).toFixed(1)}%`, score: s,
      note: `Sector median ${(dist.margin.p50 * 100).toFixed(1)}%`
    })
  }

  const fundamentals = rollup(fundMetrics)

  // Growth pillar (higher better, vs sector)
  const growthMetrics = []
  const rg = +row.revGrowth
  if (!isNaN(rg) && dist.revGrowth) {
    growthMetrics.push({
      name: 'Rev Growth (sector)', value: `${(rg * 100).toFixed(1)}%`,
      score: scoreVsSector(rg, dist.revGrowth, 'higher_better'),
      note: `Sector median ${(dist.revGrowth.p50 * 100).toFixed(1)}%`
    })
  }
  const eg = +row.epsGrowth
  if (!isNaN(eg) && dist.epsGrowth) {
    growthMetrics.push({
      name: 'EPS Growth (sector)', value: `${(eg * 100).toFixed(1)}%`,
      score: scoreVsSector(eg, dist.epsGrowth, 'higher_better'),
      note: `Sector median ${(dist.epsGrowth.p50 * 100).toFixed(1)}%`
    })
  }
  const growth = rollup(growthMetrics)

  // Analysts — same as broad-market scoring (no sector context needed for ratings)
  const analystsExisting = row.pillars?.find(p => p.key === 'analysts')
  const analysts = analystsExisting
    ? { score: analystsExisting.score, metrics: analystsExisting.metrics, coverage: analystsExisting.metrics.length }
    : { score: null, metrics: [], coverage: 0 }

  const pillars = [
    { key: 'fundamentals', label: 'Fundamentals (sector)', weight: 0.45, ...fundamentals },
    { key: 'analysts',     label: 'Analysts',              weight: 0.25, ...analysts },
    { key: 'growth',       label: 'Growth (sector)',       weight: 0.30, ...growth }
  ]

  const present = pillars.filter(p => p.score != null)
  const totalW = present.reduce((a, p) => a + p.weight, 0)
  const composite = present.length > 0
    ? Math.round(present.reduce((a, p) => a + p.score * (p.weight / totalW), 0))
    : null

  return {
    composite,
    pillars,
    verdict: verdictFor(composite),
    coverage: present.length / pillars.length
  }
}

function rollup(metrics) {
  const valid = metrics.filter(m => m.score != null && !isNaN(m.score))
  if (valid.length === 0) return { score: null, metrics: [], coverage: 0 }
  return {
    score: Math.round(valid.reduce((a, m) => a + m.score, 0) / valid.length),
    metrics, coverage: valid.length
  }
}

function verdictFor(score) {
  if (score == null) return { label: 'Insufficient data', tone: 'muted' }
  if (score >= 75) return { label: 'Strong Buy candidate', tone: 'accent' }
  if (score >= 60) return { label: 'Worth a closer look',  tone: 'accent' }
  if (score >= 45) return { label: 'Mixed signals',        tone: 'warn' }
  if (score >= 30) return { label: 'Weak — be cautious',   tone: 'warn' }
  return { label: 'Avoid', tone: 'bad' }
}

// Apply sector-relative scoring to a full screener result set.
// Mutates rows to add sectorScore/sectorPillars/sectorComposite fields.
export function applySectorRelative(rows) {
  const benchmarks = computeSectorBenchmarks(rows)
  for (const row of rows) {
    if (row.error) continue
    const sr = computeSectorRelativeScore(row, benchmarks)
    if (sr) {
      row.sectorComposite = sr.composite
      row.sectorPillars = sr.pillars
      row.sectorVerdict = sr.verdict
    }
  }
  return { rows, benchmarks }
}
