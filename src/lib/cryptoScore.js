// Crypto scoring engine — network, tokenomics, momentum, liquidity.
// Same transparency model as score.js: per-metric scores + pillar rollups.

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x))
}

function pwl(value, breakpoints) {
  if (value == null || Number.isNaN(value)) return null
  if (value <= breakpoints[0].at) return breakpoints[0].score
  if (value >= breakpoints[breakpoints.length - 1].at) {
    return breakpoints[breakpoints.length - 1].score
  }
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const a = breakpoints[i]
    const b = breakpoints[i + 1]
    if (value >= a.at && value <= b.at) {
      const t = (value - a.at) / (b.at - a.at)
      return clamp(a.score + t * (b.score - a.score), 0, 100)
    }
  }
  return null
}

function num(x) {
  if (x == null || x === '') return null
  const n = +x
  return Number.isNaN(n) ? null : n
}

function pctFromCoin(coin, key) {
  const flat = coin[key]
  if (flat != null && typeof flat !== 'object') return num(flat)
  const nested = coin[`${key}_in_currency`]
  if (nested != null && typeof nested !== 'object') return num(nested)
  if (nested?.usd != null) return num(nested.usd)
  return null
}

export function normalizeCryptoCoin(coin) {
  if (!coin) return {}
  const md = coin.market_data || {}

  const price = md.current_price?.usd ?? md.current_price ?? coin.current_price
  const marketCap = md.market_cap?.usd ?? md.market_cap ?? coin.market_cap
  const volume = md.total_volume?.usd ?? md.total_volume ?? coin.total_volume

  return {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    image: coin.image?.small ?? coin.image,
    current_price: num(price),
    market_cap: num(marketCap),
    market_cap_rank: num(md.market_cap_rank ?? coin.market_cap_rank),
    total_volume: num(volume),
    circulating_supply: num(md.circulating_supply ?? coin.circulating_supply),
    max_supply: md.max_supply != null ? num(md.max_supply) : coin.max_supply != null ? num(coin.max_supply) : null,
    ath_change_percentage: num(md.ath_change_percentage?.usd ?? md.ath_change_percentage ?? coin.ath_change_percentage),
    price_change_percentage_24h: num(md.price_change_percentage_24h ?? coin.price_change_percentage_24h),
    price_change_percentage_7d: pctFromCoin(coin, 'price_change_percentage_7d') ?? num(coin.price_change_percentage_7d),
    price_change_percentage_30d: pctFromCoin(coin, 'price_change_percentage_30d') ?? num(coin.price_change_percentage_30d),
    community_score: num(coin.community_score),
    developer_score: num(coin.developer_score),
    developer_forks: num(coin.developer_data?.forks),
    sparkline: coin.sparkline_in_7d?.price ?? md.sparkline_7d?.price ?? []
  }
}

function rollup(metrics) {
  const valid = metrics.filter(m => m.score != null && !Number.isNaN(m.score))
  if (valid.length === 0) return { score: null, metrics: [], coverage: 0 }
  const avg = valid.reduce((a, m) => a + m.score, 0) / valid.length
  return { score: Math.round(avg), metrics, coverage: valid.length }
}

function scoreNetworkHealth(c) {
  const metrics = []

  const dev = c.developer_score
  if (dev != null) {
    metrics.push({
      name: 'Developer score',
      value: dev.toFixed(0),
      score: clamp(dev, 0, 100),
      note: 'CoinGecko developer activity index'
    })
  }

  const comm = c.community_score
  if (comm != null && dev == null) {
    metrics.push({
      name: 'Community score',
      value: comm.toFixed(0),
      score: clamp(comm, 0, 100),
      note: 'Proxy for network health (markets data)'
    })
  }

  const forks = c.developer_forks
  if (forks != null) {
    metrics.push({
      name: 'GitHub forks',
      value: forks.toLocaleString(),
      score: pwl(forks, [
        { at: 0, score: 30 },
        { at: 50, score: 50 },
        { at: 500, score: 70 },
        { at: 2000, score: 85 },
        { at: 10000, score: 95 }
      ]),
      note: forks > 2000 ? 'Active open-source ecosystem' : ''
    })
  }

  return rollup(metrics)
}

function scoreTokenomics(c) {
  const metrics = []

  const circ = c.circulating_supply
  const max = c.max_supply
  if (circ != null && max != null && max > 0) {
    const ratio = circ / max
    metrics.push({
      name: 'Circulating / max supply',
      value: `${(ratio * 100).toFixed(0)}%`,
      score: pwl(ratio, [
        { at: 0, score: 30 },
        { at: 0.5, score: 60 },
        { at: 0.85, score: 90 },
        { at: 1.0, score: 100 }
      ]),
      note: ratio >= 0.85 ? 'Most supply already circulating' : 'Future dilution possible'
    })
  } else if (circ != null) {
    metrics.push({
      name: 'Supply cap',
      value: 'Uncapped',
      score: 50,
      note: 'uncapped supply'
    })
  }

  const athCh = c.ath_change_percentage
  if (athCh != null) {
    metrics.push({
      name: 'Down from ATH',
      value: `${athCh.toFixed(1)}%`,
      score: pwl(athCh, [
        { at: -95, score: 20 },
        { at: -80, score: 50 },
        { at: -50, score: 75 },
        { at: -30, score: 80 },
        { at: -10, score: 60 },
        { at: 0, score: 40 }
      ]),
      note: athCh < -80 ? 'Deep drawdown from peak' : athCh > -10 ? 'Near all-time high' : ''
    })
  }

  return rollup(metrics)
}

function scoreMomentum(c) {
  const metrics = []

  const d24 = c.price_change_percentage_24h
  if (d24 != null) {
    metrics.push({
      name: '24h return',
      value: `${d24.toFixed(1)}%`,
      score: pwl(d24, [
        { at: -20, score: 5 },
        { at: -5, score: 35 },
        { at: 0, score: 50 },
        { at: 5, score: 70 },
        { at: 15, score: 85 },
        { at: 30, score: 60 }
      ]),
      note: d24 > 15 ? 'Large 24h move — often unsustainable' : ''
    })
  }

  const d7 = c.price_change_percentage_7d
  if (d7 != null) {
    metrics.push({
      name: '7d return',
      value: `${d7.toFixed(1)}%`,
      score: pwl(d7, [
        { at: -30, score: 5 },
        { at: -10, score: 30 },
        { at: 0, score: 50 },
        { at: 10, score: 75 },
        { at: 30, score: 90 },
        { at: 80, score: 70 }
      ])
    })
  }

  const d30 = c.price_change_percentage_30d
  if (d30 != null) {
    metrics.push({
      name: '30d return',
      value: `${d30.toFixed(1)}%`,
      score: pwl(d30, [
        { at: -50, score: 5 },
        { at: -20, score: 25 },
        { at: 0, score: 50 },
        { at: 25, score: 80 },
        { at: 80, score: 90 },
        { at: 200, score: 75 }
      ])
    })
  }

  return rollup(metrics)
}

function scoreLiquidity(c) {
  const metrics = []

  const rank = c.market_cap_rank
  if (rank != null) {
    metrics.push({
      name: 'Market cap rank',
      value: `#${rank}`,
      score: pwl(rank, [
        { at: 1, score: 95 },
        { at: 10, score: 85 },
        { at: 50, score: 70 },
        { at: 100, score: 50 },
        { at: 250, score: 25 },
        { at: 500, score: 10 }
      ]),
      note: rank <= 10 ? 'Top-tier liquidity' : rank > 100 ? 'Smaller cap — higher slippage risk' : ''
    })
  }

  const cap = c.market_cap
  const vol = c.total_volume
  if (cap != null && cap > 0 && vol != null) {
    const turnover = vol / cap
    metrics.push({
      name: '24h volume / market cap',
      value: turnover.toFixed(3),
      score: pwl(turnover, [
        { at: 0.01, score: 30 },
        { at: 0.05, score: 60 },
        { at: 0.15, score: 85 },
        { at: 0.5, score: 75 },
        { at: 2.0, score: 30 }
      ]),
      note: turnover > 0.5 ? 'Very high turnover — possible wash trading' : ''
    })
  }

  return rollup(metrics)
}

function verdictFor(score) {
  if (score == null) return { label: 'Insufficient data', tone: 'muted' }
  if (score >= 75) return { label: 'Strong fundamentals — promising', tone: 'accent' }
  if (score >= 60) return { label: 'Solid project', tone: 'accent' }
  if (score >= 45) return { label: 'Mixed signals', tone: 'warn' }
  if (score >= 30) return { label: 'Weak — be cautious', tone: 'warn' }
  return { label: 'Likely speculative / avoid', tone: 'bad' }
}

export function computeCryptoScore(coin) {
  const c = normalizeCryptoCoin(coin)

  const network = scoreNetworkHealth(c)
  const tokenomics = scoreTokenomics(c)
  const momentum = scoreMomentum(c)
  const liquidity = scoreLiquidity(c)

  const pillars = [
    { key: 'network', label: 'Network Health', weight: 0.35, ...network },
    { key: 'tokenomics', label: 'Tokenomics', weight: 0.25, ...tokenomics },
    { key: 'momentum', label: 'Momentum', weight: 0.20, ...momentum },
    { key: 'liquidity', label: 'Liquidity', weight: 0.20, ...liquidity }
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

export function groupCryptoByVerdict(rows) {
  const bands = {
    strong: { label: 'Strong fundamentals — promising', range: '75–100', tone: 'accent', items: [] },
    solid: { label: 'Solid project', range: '60–74', tone: 'accent', items: [] },
    mixed: { label: 'Mixed signals', range: '45–59', tone: 'warn', items: [] },
    weak: { label: 'Weak — be cautious', range: '30–44', tone: 'warn', items: [] },
    avoid: { label: 'Likely speculative / avoid', range: '<30', tone: 'bad', items: [] },
    nodata: { label: 'Insufficient data', range: '—', tone: 'muted', items: [] }
  }

  for (const r of rows) {
    if (r.composite == null) bands.nodata.items.push(r)
    else if (r.composite >= 75) bands.strong.items.push(r)
    else if (r.composite >= 60) bands.solid.items.push(r)
    else if (r.composite >= 45) bands.mixed.items.push(r)
    else if (r.composite >= 30) bands.weak.items.push(r)
    else bands.avoid.items.push(r)
  }

  for (const k of Object.keys(bands)) {
    bands[k].items.sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1))
  }
  return bands
}

export const STABLECOIN_RE = /^(USDT|USDC|DAI|FDUSD|TUSD|USDD|BUSD|FRAX|PYUSD|USDE)$/i
