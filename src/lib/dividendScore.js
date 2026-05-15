// Dividend Quality Score
//
// A high yield alone is often a trap (price has fallen because the company
// is in trouble, and the dividend may get cut). Real dividend quality has
// four legs:
//
//   1. Yield level — is it actually worth holding for income?
//   2. Payout ratio — how much of earnings is being paid out? (>80% = risky)
//   3. Dividend growth — has the company raised dividends consistently?
//   4. FCF coverage — does free cash flow easily cover the dividend?
//
// We score each 0-100 and weight them. The result is your starting point —
// no algorithm can predict a dividend cut.

function pwl(value, breakpoints) {
  if (value == null || isNaN(value)) return null
  if (value <= breakpoints[0].at) return breakpoints[0].score
  if (value >= breakpoints[breakpoints.length - 1].at) return breakpoints[breakpoints.length - 1].score
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const a = breakpoints[i], b = breakpoints[i + 1]
    if (value >= a.at && value <= b.at) {
      const t = (value - a.at) / (b.at - a.at)
      return a.score + t * (b.score - a.score)
    }
  }
  return null
}

function num(x) {
  if (x == null || x === 'None' || x === '-' || x === '') return null
  const n = +x
  return isNaN(n) ? null : n
}

// Compute dividend quality score from an overview object (Yahoo-flattened).
// We don't have all the fields we'd ideally want; we'll mark coverage clearly.
export function computeDividendScore(overview) {
  const metrics = []

  // 1. Yield
  const yieldFrac = num(overview.DividendYield)
  if (yieldFrac == null || yieldFrac === 0) {
    return { composite: null, metrics: [], verdict: { label: 'Non-dividend payer', tone: 'muted' }, yield: null }
  }
  const yieldPct = yieldFrac * 100
  metrics.push({
    name: 'Yield Level', value: `${yieldPct.toFixed(2)}%`,
    score: pwl(yieldPct, [
      { at: 0.5, score: 25 },
      { at: 1.5, score: 50 },
      { at: 3.0, score: 75 },
      { at: 4.5, score: 90 },
      { at: 7.0, score: 80 },     // very high yield = risk of cut
      { at: 12.0, score: 30 }      // 12%+ is almost certainly a trap
    ]),
    note: yieldPct > 7 ? 'Very high yield — verify it\'s sustainable' :
          yieldPct < 1 ? 'Low income contribution' : ''
  })

  // 2. Payout ratio (need EPS + dividend per share — we have EPS)
  const eps = num(overview.EPS)
  const divPerShare = num(overview.DividendPerShare) || (yieldFrac && overview.Price ? yieldFrac * +overview.Price : null)
  // Yahoo exposes a payoutRatio in summaryDetail but our flatten doesn't currently bring it through.
  // We'll add it. For now, estimate from EPS if available.
  let payoutRatio = num(overview.PayoutRatio)
  if (payoutRatio == null && eps && divPerShare && eps > 0) {
    payoutRatio = divPerShare / eps
  }
  if (payoutRatio != null) {
    const pctPayout = payoutRatio * 100
    metrics.push({
      name: 'Payout Ratio', value: `${pctPayout.toFixed(0)}%`,
      score: pwl(pctPayout, [
        { at: 0, score: 60 },     // 0% payout = not really a dividend story
        { at: 30, score: 92 },
        { at: 50, score: 85 },
        { at: 70, score: 60 },
        { at: 90, score: 30 },
        { at: 120, score: 10 }    // paying out more than earnings = unsustainable
      ]),
      note: pctPayout > 90 ? 'Paying out almost all earnings' :
            pctPayout < 30 ? 'Conservative — room to grow' : ''
    })
  }

  // 3. 5-year dividend growth rate
  const divGrowth = num(overview.DividendGrowth5Y)
  if (divGrowth != null) {
    const growthPct = divGrowth * 100
    metrics.push({
      name: '5Y Div Growth', value: `${growthPct.toFixed(1)}%`,
      score: pwl(growthPct, [
        { at: -10, score: 5 },
        { at: 0, score: 35 },
        { at: 3, score: 60 },
        { at: 7, score: 80 },
        { at: 15, score: 92 }
      ]),
      note: growthPct < 0 ? 'Dividend has been cut historically' : ''
    })
  }

  // 4. FCF coverage — approximate via profit margin & cash flow if available
  // (skipped if we don't have free cash flow data — would need cashflowStatement module)
  const fcf = num(overview.FreeCashFlow)
  const totalDividends = num(overview.TrailingAnnualDividendRate) && num(overview.SharesOutstanding)
    ? +overview.TrailingAnnualDividendRate * +overview.SharesOutstanding : null
  if (fcf != null && totalDividends != null && totalDividends > 0) {
    const coverage = fcf / totalDividends
    metrics.push({
      name: 'FCF Coverage', value: `${coverage.toFixed(1)}x`,
      score: pwl(coverage, [
        { at: 0.5, score: 10 },
        { at: 1.0, score: 40 },
        { at: 1.5, score: 70 },
        { at: 2.5, score: 90 },
        { at: 5.0, score: 95 }
      ]),
      note: coverage < 1.5 ? 'Tight coverage — dividend at risk' : 'Well covered'
    })
  }

  const valid = metrics.filter(m => m.score != null)
  if (valid.length === 0) return { composite: null, metrics, verdict: { label: 'Insufficient data', tone: 'muted' }, yield: yieldPct }

  const composite = Math.round(valid.reduce((a, m) => a + m.score, 0) / valid.length)
  return {
    composite,
    metrics,
    yield: yieldPct,
    verdict: verdictFor(composite)
  }
}

function verdictFor(s) {
  if (s == null) return { label: 'Insufficient data', tone: 'muted' }
  if (s >= 75) return { label: 'High-quality dividend', tone: 'accent' }
  if (s >= 60) return { label: 'Solid dividend payer',  tone: 'accent' }
  if (s >= 45) return { label: 'Acceptable — watch payout',  tone: 'warn' }
  if (s >= 30) return { label: 'Caution — yield may not last', tone: 'warn' }
  return { label: 'Likely dividend trap', tone: 'bad' }
}
