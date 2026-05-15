// Transparent scoring engine.
//
// Philosophy: we DON'T pretend to predict price. We score on four pillars,
// each 0-100, then a weighted composite. Each metric's contribution is
// recorded so the UI can show the user exactly WHY a score is what it is.
//
// Pillars (chosen by user):
//   1. Fundamentals  (P/E, P/B, ROE, debt/equity, profit margin)
//   2. Momentum      (price vs SMA50/SMA200, 6M & 12M return)
//   3. Analysts      (target price vs current, analyst rating distribution)
//   4. Growth        (revenue YoY, EPS YoY, quarterly EPS surprise)
//
// Scoring shape: per-metric we map to 0-100 using piecewise-linear ranges
// calibrated to broad-market norms. Missing data => metric excluded and
// pillar weight redistributed (don't penalise for missing data).

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)) }

// Piecewise linear: given breakpoints [{at, score}], interpolate score for value.
// Breakpoints must be sorted by `at` ascending.
function pwl(value, breakpoints) {
  if (value == null || isNaN(value)) return null
  if (value <= breakpoints[0].at) return breakpoints[0].score
  if (value >= breakpoints[breakpoints.length - 1].at) return breakpoints[breakpoints.length - 1].score
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const a = breakpoints[i], b = breakpoints[i + 1]
    if (value >= a.at && value <= b.at) {
      const t = (value - a.at) / (b.at - a.at)
      return clamp(a.score + t * (b.score - a.score), 0, 100)
    }
  }
  return null
}

function num(x) {
  if (x == null || x === 'None' || x === '-' || x === '') return null
  const n = +x
  return isNaN(n) ? null : n
}

// === FUNDAMENTALS ===
// Lower P/E better up to a floor; very low can mean trouble too.
function scoreFundamentals(ov) {
  const metrics = []

  const pe = num(ov.PERatio)
  if (pe != null) metrics.push({
    name: 'P/E Ratio', value: pe.toFixed(1),
    score: pwl(pe, [
      { at: 0, score: 30 },    // negative/zero earnings = penalised
      { at: 8, score: 95 },    // very cheap
      { at: 15, score: 80 },
      { at: 25, score: 55 },
      { at: 40, score: 30 },
      { at: 80, score: 10 }
    ]),
    note: pe < 0 ? 'Negative earnings' : pe < 15 ? 'Cheap vs market' : pe > 40 ? 'Expensive vs market' : 'Reasonable'
  })

  const pb = num(ov.PriceToBookRatio)
  if (pb != null) metrics.push({
    name: 'P/B Ratio', value: pb.toFixed(2),
    score: pwl(pb, [
      { at: 0, score: 40 },
      { at: 1, score: 90 },
      { at: 3, score: 65 },
      { at: 6, score: 35 },
      { at: 15, score: 10 }
    ]),
    note: pb < 1 ? 'Trading below book' : pb > 6 ? 'Premium to book' : ''
  })

  const roe = num(ov.ReturnOnEquityTTM)
  if (roe != null) {
    const roePct = roe * 100
    metrics.push({
      name: 'ROE', value: `${roePct.toFixed(1)}%`,
      score: pwl(roePct, [
        { at: -10, score: 0 },
        { at: 0, score: 25 },
        { at: 10, score: 60 },
        { at: 20, score: 85 },
        { at: 35, score: 95 },
        { at: 60, score: 90 }   // suspiciously high ROE often = financial leverage
      ]),
      note: roePct < 0 ? 'Negative — losing money' : roePct > 20 ? 'Strong returns on equity' : ''
    })
  }

  const margin = num(ov.ProfitMargin)
  if (margin != null) {
    const mPct = margin * 100
    metrics.push({
      name: 'Profit Margin', value: `${mPct.toFixed(1)}%`,
      score: pwl(mPct, [
        { at: -20, score: 0 },
        { at: 0, score: 30 },
        { at: 8, score: 60 },
        { at: 20, score: 85 },
        { at: 35, score: 95 }
      ]),
      note: mPct < 0 ? 'Unprofitable' : ''
    })
  }

  const beta = num(ov.Beta)
  if (beta != null) metrics.push({
    name: 'Beta', value: beta.toFixed(2),
    score: pwl(Math.abs(beta - 1), [
      { at: 0, score: 80 },     // beta ~ 1 = market-like
      { at: 0.5, score: 60 },
      { at: 1.5, score: 35 }
    ]),
    note: beta > 1.5 ? 'High volatility vs market' : beta < 0.5 ? 'Low volatility' : ''
  })

  return rollup(metrics)
}

// === MOMENTUM ===
function scoreMomentum(points) {
  if (!points || points.length < 252) return rollup([])
  const closes = points.map(p => p.close)
  const last = closes[closes.length - 1]

  const sma = (n) => {
    if (closes.length < n) return null
    const slice = closes.slice(-n)
    return slice.reduce((a, b) => a + b, 0) / n
  }

  const sma50 = sma(50)
  const sma200 = sma(200)
  const ret = (daysBack) => {
    if (closes.length < daysBack + 1) return null
    const past = closes[closes.length - 1 - daysBack]
    return ((last - past) / past) * 100
  }

  const metrics = []

  if (sma50 != null) {
    const aboveSma50 = ((last - sma50) / sma50) * 100
    metrics.push({
      name: 'Price vs SMA50', value: `${aboveSma50.toFixed(1)}%`,
      score: pwl(aboveSma50, [
        { at: -20, score: 10 },
        { at: -5, score: 35 },
        { at: 0, score: 55 },
        { at: 5, score: 75 },
        { at: 15, score: 85 },
        { at: 35, score: 60 }  // overextended
      ]),
      note: aboveSma50 > 0 ? 'Above 50-day average' : 'Below 50-day average'
    })
  }

  if (sma200 != null) {
    const aboveSma200 = ((last - sma200) / sma200) * 100
    metrics.push({
      name: 'Price vs SMA200', value: `${aboveSma200.toFixed(1)}%`,
      score: pwl(aboveSma200, [
        { at: -30, score: 5 },
        { at: -10, score: 30 },
        { at: 0, score: 55 },
        { at: 10, score: 80 },
        { at: 30, score: 85 },
        { at: 60, score: 55 }
      ]),
      note: aboveSma200 > 0 ? 'In long-term uptrend' : 'In long-term downtrend'
    })
  }

  const ret6m = ret(126)
  if (ret6m != null) metrics.push({
    name: '6-month return', value: `${ret6m.toFixed(1)}%`,
    score: pwl(ret6m, [
      { at: -40, score: 5 },
      { at: -10, score: 35 },
      { at: 0, score: 55 },
      { at: 15, score: 80 },
      { at: 40, score: 90 },
      { at: 100, score: 70 }
    ])
  })

  const ret12m = ret(252)
  if (ret12m != null) metrics.push({
    name: '12-month return', value: `${ret12m.toFixed(1)}%`,
    score: pwl(ret12m, [
      { at: -50, score: 5 },
      { at: -15, score: 30 },
      { at: 0, score: 55 },
      { at: 20, score: 80 },
      { at: 60, score: 90 },
      { at: 150, score: 65 }
    ])
  })

  return rollup(metrics)
}

// === ANALYSTS ===
// Alpha Vantage's OVERVIEW gives AnalystTargetPrice and analyst rating counts.
function scoreAnalysts(ov, currentPrice) {
  const metrics = []

  const target = num(ov.AnalystTargetPrice)
  if (target != null && currentPrice) {
    const upside = ((target - currentPrice) / currentPrice) * 100
    metrics.push({
      name: 'Analyst Target Upside', value: `${upside.toFixed(1)}%`,
      score: pwl(upside, [
        { at: -25, score: 5 },
        { at: -5, score: 35 },
        { at: 0, score: 50 },
        { at: 10, score: 70 },
        { at: 25, score: 90 },
        { at: 60, score: 75 }   // huge implied upside often = bad business, not bargain
      ]),
      note: upside > 0 ? `Analysts see ${upside.toFixed(0)}% upside` : `Trading above target`
    })
  }

  const sb = num(ov.AnalystRatingStrongBuy)
  const b  = num(ov.AnalystRatingBuy)
  const h  = num(ov.AnalystRatingHold)
  const s  = num(ov.AnalystRatingSell)
  const ss = num(ov.AnalystRatingStrongSell)
  const total = [sb, b, h, s, ss].reduce((a, v) => a + (v || 0), 0)
  if (total > 0) {
    // Weighted score: strongBuy=100, buy=75, hold=50, sell=25, strongSell=0
    const weighted = ((sb || 0) * 100 + (b || 0) * 75 + (h || 0) * 50 + (s || 0) * 25 + (ss || 0) * 0) / total
    metrics.push({
      name: 'Analyst Consensus', value: `${total} analysts`,
      score: weighted,
      note: `${(sb || 0) + (b || 0)} buy / ${h || 0} hold / ${(s || 0) + (ss || 0)} sell`
    })
  }

  return rollup(metrics)
}

// === GROWTH ===
function scoreGrowth(ov, earnings, income) {
  const metrics = []

  const revYoY = num(ov.QuarterlyRevenueGrowthYOY)
  if (revYoY != null) {
    const pct = revYoY * 100
    metrics.push({
      name: 'Revenue Growth (YoY)', value: `${pct.toFixed(1)}%`,
      score: pwl(pct, [
        { at: -20, score: 5 },
        { at: -5, score: 30 },
        { at: 0, score: 50 },
        { at: 10, score: 75 },
        { at: 25, score: 90 },
        { at: 60, score: 95 }
      ])
    })
  }

  const epsYoY = num(ov.QuarterlyEarningsGrowthYOY)
  if (epsYoY != null) {
    const pct = epsYoY * 100
    metrics.push({
      name: 'EPS Growth (YoY)', value: `${pct.toFixed(1)}%`,
      score: pwl(pct, [
        { at: -50, score: 5 },
        { at: -10, score: 30 },
        { at: 0, score: 50 },
        { at: 15, score: 75 },
        { at: 40, score: 92 },
        { at: 100, score: 95 }
      ])
    })
  }

  // Earnings surprise streak (last 4 quarters beat?)
  if (earnings?.quarterlyEarnings?.length >= 4) {
    const recent = earnings.quarterlyEarnings.slice(0, 4)
    const beats = recent.filter(q => {
      const est = num(q.estimatedEPS), act = num(q.reportedEPS)
      return est != null && act != null && act > est
    }).length
    metrics.push({
      name: 'EPS Beats (last 4Q)', value: `${beats}/4`,
      score: pwl(beats, [
        { at: 0, score: 20 },
        { at: 1, score: 40 },
        { at: 2, score: 60 },
        { at: 3, score: 80 },
        { at: 4, score: 92 }
      ])
    })
  }

  return rollup(metrics)
}

function rollup(metrics) {
  const valid = metrics.filter(m => m.score != null && !isNaN(m.score))
  if (valid.length === 0) return { score: null, metrics: [], coverage: 0 }
  const avg = valid.reduce((a, m) => a + m.score, 0) / valid.length
  return { score: Math.round(avg), metrics, coverage: valid.length }
}

/** 3-pillar composite for backtests (no historical analyst data). */
export function computeBacktestScore({ overview, points }) {
  const fundamentals = scoreFundamentals(overview || {})
  const momentum = scoreMomentum(points || [])
  const growth = scoreGrowth(overview || {}, null)

  const pillars = [
    { key: 'fundamentals', label: 'Fundamentals', weight: 0.40, ...fundamentals },
    { key: 'momentum', label: 'Momentum', weight: 0.35, ...momentum },
    { key: 'growth', label: 'Growth', weight: 0.25, ...growth }
  ]

  const present = pillars.filter(p => p.score != null)
  const totalW = present.reduce((a, p) => a + p.weight, 0)
  const composite = present.length > 0
    ? Math.round(present.reduce((a, p) => a + p.score * (p.weight / totalW), 0))
    : null

  return { composite, pillars, coverage: present.length / pillars.length }
}

export function computeScore({ overview, points, earnings, currentPrice }) {
  const fundamentals = scoreFundamentals(overview || {})
  const momentum    = scoreMomentum(points || [])
  const analysts    = scoreAnalysts(overview || {}, currentPrice)
  const growth      = scoreGrowth(overview || {}, earnings || {})

  const pillars = [
    { key: 'fundamentals', label: 'Fundamentals', weight: 0.35, ...fundamentals },
    { key: 'momentum',     label: 'Momentum',     weight: 0.20, ...momentum },
    { key: 'analysts',     label: 'Analysts',     weight: 0.20, ...analysts },
    { key: 'growth',       label: 'Growth',       weight: 0.25, ...growth }
  ]

  // Redistribute weights from pillars with no data
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

function verdictFor(score) {
  if (score == null) return { label: 'Insufficient data', tone: 'muted' }
  if (score >= 75) return { label: 'Strong Buy candidate', tone: 'accent' }
  if (score >= 60) return { label: 'Worth a closer look',  tone: 'accent' }
  if (score >= 45) return { label: 'Mixed signals',        tone: 'warn' }
  if (score >= 30) return { label: 'Weak — be cautious',   tone: 'warn' }
  return { label: 'Avoid', tone: 'bad' }
}
