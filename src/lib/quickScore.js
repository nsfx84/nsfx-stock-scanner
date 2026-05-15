// Lightweight scorer for the bulk screener.
//
// Why this exists: scoring 500 stocks via full score.js would need
// 500 × 3 = 1500 API calls (overview + 5y daily + earnings). Even
// parallelised, that's slow and unkind to Yahoo's servers.
//
// This version uses ONLY the overview endpoint (1 call per stock,
// fully cacheable) and computes 3 pillars:
//   - Fundamentals
//   - Analysts
//   - Growth (without earnings-beat streak, which needs earnings call)
//
// Momentum is skipped. The composite is re-weighted to sum to 1 over
// the available pillars (35/0.75, 20/0.75, 25/0.75 → 47/27/27 of new whole).

import { computeScore } from './score.js'

export function computeQuickScore(overview) {
  // Reuse the main engine by passing empty points/earnings.
  // It already handles missing-pillar weight redistribution.
  const full = computeScore({
    overview,
    points: [],
    earnings: null,
    currentPrice: null
  })

  // Strip the momentum pillar entirely from the display since we
  // explicitly didn't score it.
  const pillars = full.pillars.filter(p => p.key !== 'momentum')

  return {
    composite: full.composite,
    pillars,
    verdict: full.verdict,
    coverage: pillars.filter(p => p.score != null).length / pillars.length
  }
}
