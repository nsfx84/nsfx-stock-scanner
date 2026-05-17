// Yahoo Finance client. Talks to our serverless API endpoints.
//
// In development (vercel dev) and production, API routes live under /api
// on the same origin as the frontend, so a relative path works in both.
//
// Exposes the same interface as the original alphaVantage.js so the rest
// of the app doesn't need to change. We translate Yahoo's response shapes
// into the Alpha-Vantage-style flat overview object that score.js and
// OverviewPanel.jsx expect.

const API_BASE = '/api'

const TTL = {
  daily:    6 * 60 * 60 * 1000,
  overview: 6 * 60 * 60 * 1000,
  earnings: 24 * 60 * 60 * 1000,
  search:   24 * 60 * 60 * 1000,
  news:     30 * 60 * 1000,
  quotes:   60 * 1000,
  sparklines: 60 * 60 * 1000,
  regime:   6 * 60 * 60 * 1000,
  cryptoMarkets: 30 * 60 * 1000,
  cryptoCoin: 60 * 60 * 1000
}

function cacheKey(fn, symbol) { return `yf:${fn}:${symbol || ''}` }

function readCache(key, ttl) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > ttl) return null
    return data
  } catch { return null }
}

function writeCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })) }
  catch {}
}

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const j = await res.json(); if (j.error) msg = j.error } catch {}
    throw new Error(msg)
  }
  return res.json()
}

// Yahoo's quoteSummary nests data under modules. Flatten into the same
// shape score.js / OverviewPanel.jsx expect (Alpha-Vantage-style keys).
function flattenOverview(qs, quote) {
  const profile  = qs.assetProfile || {}
  const summary  = qs.summaryDetail || {}
  const stats    = qs.defaultKeyStatistics || {}
  const fin      = qs.financialData || {}
  const price    = qs.price || {}
  const recTrend = qs.recommendationTrend?.trend?.[0] || {}

  const v = (x) => (x && typeof x === 'object' && 'raw' in x) ? x.raw : x

  return {
    Symbol: price.symbol || quote?.symbol,
    Name:   price.longName || price.shortName || quote?.longName || quote?.shortName,
    Exchange: price.exchangeName || quote?.fullExchangeName,
    Sector:   profile.sector,
    Industry: profile.industry,
    Country:  profile.country,
    Currency: price.currency,
    Description: profile.longBusinessSummary,
    MarketCapitalization: v(price.marketCap) ?? v(summary.marketCap),

    PERatio:           v(summary.trailingPE),
    ForwardPE:         v(summary.forwardPE) ?? v(stats.forwardPE),
    PriceToBookRatio:  v(stats.priceToBook),
    PEGRatio:          v(stats.pegRatio),
    EPS:               v(stats.trailingEps),

    ReturnOnEquityTTM: v(fin.returnOnEquity),
    ReturnOnAssetsTTM: v(fin.returnOnAssets),
    ProfitMargin:      v(fin.profitMargins) ?? v(stats.profitMargins),
    DividendYield:     v(summary.dividendYield),
    Beta:              v(summary.beta) ?? v(stats.beta),

    '52WeekHigh':      v(summary.fiftyTwoWeekHigh),
    '52WeekLow':       v(summary.fiftyTwoWeekLow),
    RevenueTTM:        v(fin.totalRevenue),
    QuarterlyRevenueGrowthYOY: v(fin.revenueGrowth),
    QuarterlyEarningsGrowthYOY: v(fin.earningsGrowth),

    AnalystTargetPrice: v(fin.targetMeanPrice),
    AnalystRatingStrongBuy:  recTrend.strongBuy,
    AnalystRatingBuy:        recTrend.buy,
    AnalystRatingHold:       recTrend.hold,
    AnalystRatingSell:       recTrend.sell,
    AnalystRatingStrongSell: recTrend.strongSell,

    // Dividend-specific fields
    PayoutRatio:             v(summary.payoutRatio),
    DividendPerShare:        v(summary.dividendRate),
    TrailingAnnualDividendRate: v(summary.trailingAnnualDividendRate),
    DividendGrowth5Y:        v(stats.fiveYearAvgDividendYield),  // approximation; Yahoo doesn't directly expose 5y div growth
    FreeCashFlow:            v(fin.freeCashflow),
    SharesOutstanding:       v(stats.sharesOutstanding) ?? v(price.sharesOutstanding)
  }
}

function flattenEarnings(qs) {
  const hist = qs.earningsHistory?.history || []
  // Map to Alpha Vantage shape: { quarterlyEarnings: [{ estimatedEPS, reportedEPS }] }
  const quarterlyEarnings = hist
    .filter(h => h.epsActual?.raw != null && h.epsEstimate?.raw != null)
    .map(h => ({
      estimatedEPS: h.epsEstimate?.raw,
      reportedEPS:  h.epsActual?.raw,
      quarter:      h.quarter?.fmt
    }))
    .reverse() // most recent first
  return { quarterlyEarnings }
}

// --- Public API (same shape as old alphaVantage.js) ---

export async function searchSymbol(keywords) {
  if (!keywords) return []
  const key = cacheKey('search', keywords.toLowerCase())
  const hit = readCache(key, TTL.search)
  if (hit) return hit
  const r = await get(`/search?q=${encodeURIComponent(keywords)}`)
  const out = (r.quotes || []).map(q => ({
    symbol: q.symbol,
    name: q.name,
    region: 'United States',
    currency: 'USD'
  }))
  writeCache(key, out)
  return out
}

export async function getQuote(symbol) {
  const sym = String(symbol || '').trim().toUpperCase()
  if (!sym) return null
  const key = cacheKey('quote', sym)
  const hit = readCache(key, TTL.quotes)
  if (hit) return hit
  try {
    const r = await get(`/quotes?symbols=${encodeURIComponent(sym)}`)
    const q = (r.quotes || [])[0] || null
    if (q) writeCache(key, q)
    return q
  } catch {
    return null
  }
}

export async function getOverview(symbol) {
  const key = cacheKey('overview', symbol)
  const hit = readCache(key, TTL.overview)
  if (hit) return { data: hit, fromCache: true }
  // Pull quoteSummary + a quick quote so we have current price/name as a fallback
  const [qs, quote] = await Promise.all([
    get(`/overview/${symbol}`),
    getQuote(symbol)
  ])
  const flat = flattenOverview(qs, quote)
  writeCache(key, flat)
  return { data: flat, fromCache: false }
}

export async function getDaily(symbol) {
  const key = cacheKey('daily', symbol)
  const hit = readCache(key, TTL.daily)
  if (hit) return { points: hit, fromCache: true }
  const r = await get(`/daily/${symbol}`)
  const points = r.points || []
  writeCache(key, points)
  return { points, fromCache: false }
}

export async function getEarnings(symbol) {
  const key = cacheKey('earnings', symbol)
  const hit = readCache(key, TTL.earnings)
  if (hit) return { data: hit, fromCache: true }
  const r = await get(`/earnings/${symbol}`)
  const flat = flattenEarnings(r)
  writeCache(key, flat)
  return { data: flat, fromCache: false }
}

export async function getPeers(symbol) {
  const key = cacheKey('peers', symbol)
  const hit = readCache(key, 7 * 24 * 60 * 60 * 1000)
  if (hit) return hit
  try {
    const r = await get(`/peers/${symbol}`)
    writeCache(key, r.peers || [])
    return r.peers || []
  } catch {
    return []
  }
}

export async function getPartners(symbol) {
  const sym = String(symbol || '').trim().toUpperCase()
  if (!sym) return null
  const key = cacheKey('partners', sym)
  const ttl = 7 * 24 * 60 * 60 * 1000
  const hit = readCache(key, ttl)
  if (hit) return hit
  try {
    const r = await get(`/overview/${sym}?include=partners`)
    const partners = r.partners || null
    if (partners) writeCache(key, partners)
    return partners
  } catch {
    return null
  }
}

export async function getQuotes(symbols) {
  if (!symbols?.length) return []
  const sorted = [...symbols].map(s => String(s).trim()).filter(Boolean).sort()
  const key = `yf:quotes:${sorted.join(',')}`
  const hit = readCache(key, TTL.quotes)
  if (hit) return hit
  try {
    const r = await get(`/quotes?symbols=${encodeURIComponent(sorted.join(','))}`)
    const out = r.quotes || []
    writeCache(key, out)
    return out
  } catch {
    return []
  }
}

export async function getSparklines(symbols) {
  if (!symbols?.length) return {}
  const sorted = [...symbols].map(s => String(s).trim()).filter(Boolean).sort()
  const key = `yf:sparklines:${sorted.join(',')}`
  const hit = readCache(key, TTL.sparklines)
  if (hit) return hit
  try {
    const data = await get(`/sparklines?symbols=${encodeURIComponent(sorted.join(','))}`)
    writeCache(key, data && typeof data === 'object' ? data : {})
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

export async function getRegime() {
  const key = 'yf:regime'
  const hit = readCache(key, TTL.regime)
  if (hit) return hit
  try {
    const data = await get('/regime')
    writeCache(key, data)
    return data
  } catch {
    return null
  }
}

export async function getNews(symbol) {
  const key = cacheKey('news', symbol)
  const hit = readCache(key, TTL.news)
  if (hit) return hit
  try {
    const r = await get(`/news/${symbol}`)
    writeCache(key, r.news || [])
    return r.news || []
  } catch {
    return []
  }
}

export async function getCryptoMarkets() {
  const key = 'crypto:markets'
  const hit = readCache(key, TTL.cryptoMarkets)
  if (hit) return { data: hit, fromCache: true }
  const data = await get('/crypto?type=markets')
  const list = Array.isArray(data) ? data : []
  writeCache(key, list)
  return { data: list, fromCache: false }
}

export async function getCryptoCoin(id) {
  const slug = String(id || '').trim()
  if (!slug) throw new Error('Missing coin id')
  const key = `crypto:coin:${slug}`
  const hit = readCache(key, TTL.cryptoCoin)
  if (hit) return { data: hit, fromCache: true }
  const data = await get(`/crypto?type=coin&id=${encodeURIComponent(slug)}`)
  writeCache(key, data)
  return { data, fromCache: false }
}

export function clearCryptoCache(id) {
  if (id) {
    localStorage.removeItem(`crypto:coin:${id}`)
    return
  }
  localStorage.removeItem('crypto:markets')
  Object.keys(localStorage)
    .filter(k => k.startsWith('crypto:coin:'))
    .forEach(k => localStorage.removeItem(k))
}

export function clearCache(symbol) {
  const keys = Object.keys(localStorage).filter(k =>
    k.startsWith('yf:') && (!symbol || k.endsWith(`:${symbol}`))
  )
  keys.forEach(k => localStorage.removeItem(k))
  return keys.length
}

export function getCacheInfo() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('yf:'))
  return { count: keys.length, keys }
}
