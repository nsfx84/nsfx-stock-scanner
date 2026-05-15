import { computeBacktestScore } from './score.js'

const API_BASE = '/api'
const BATCH = 10

function raw(v) {
  if (v == null) return null
  if (typeof v === 'object' && 'raw' in v) return v.raw
  const n = +v
  return Number.isNaN(n) ? null : n
}

function recordDate(rec) {
  const d = rec?.endDate?.raw ?? rec?.endDate
  if (d == null) return null
  if (typeof d === 'number') return new Date(d * (d < 1e12 ? 1000 : 1))
  return new Date(d)
}

function annualRows(history) {
  const list = history?.history || history || []
  if (!Array.isArray(list)) return []
  return [...list]
    .map(r => ({ rec: r, d: recordDate(r) }))
    .filter(x => x.d && !Number.isNaN(x.d.getTime()))
    .sort((a, b) => b.d - a.d)
}

function pickAnnualBefore(history, asOfDate) {
  const cutoff = new Date(`${asOfDate}T23:59:59Z`)
  const rows = annualRows(history)
  return rows.find(x => x.d <= cutoff)?.rec ?? null
}

function pickPriorAnnual(history, asOfDate) {
  const cutoff = new Date(`${asOfDate}T23:59:59Z`)
  const rows = annualRows(history)
  const idx = rows.findIndex(x => x.d <= cutoff)
  if (idx === -1 || idx + 1 >= rows.length) return null
  return rows[idx + 1].rec
}

export function getBacktestAsOfDate() {
  const d = new Date()
  d.setMonth(d.getMonth() - 12)
  return d.toISOString().slice(0, 10)
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j.error) msg = j.error
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}

function buildOverviewFromFundamentals(fundamentals, asOfDate, asOfClose) {
  const income = pickAnnualBefore(fundamentals?.incomeStatementHistory, asOfDate)
  const priorIncome = pickPriorAnnual(fundamentals?.incomeStatementHistory, asOfDate)
  const balance = pickAnnualBefore(fundamentals?.balanceSheetHistory, asOfDate)

  const netIncome = raw(income?.netIncome)
  const revenue = raw(income?.totalRevenue)
  const priorRevenue = raw(priorIncome?.totalRevenue)
  const priorNetIncome = raw(priorIncome?.netIncome)
  const equity = raw(balance?.totalStockholderEquity)

  const priceMod = fundamentals?.price || {}
  const shares =
    raw(priceMod.sharesOutstanding) ??
    raw(priceMod.defaultKeyStatistics?.sharesOutstanding) ??
    null

  const mktCap = shares && asOfClose ? asOfClose * shares : null

  let pe = null
  if (netIncome != null && netIncome > 0 && mktCap != null) pe = mktCap / netIncome

  let pb = null
  if (equity != null && equity > 0 && mktCap != null) pb = mktCap / equity

  const roe = equity && netIncome != null ? netIncome / equity : null
  const margin = revenue && netIncome != null ? netIncome / revenue : null

  let revGrowth = null
  if (priorRevenue && priorRevenue !== 0 && revenue != null) {
    revGrowth = (revenue - priorRevenue) / Math.abs(priorRevenue)
  }

  let epsGrowth = null
  if (priorNetIncome != null && priorNetIncome !== 0 && netIncome != null) {
    epsGrowth = (netIncome - priorNetIncome) / Math.abs(priorNetIncome)
  }

  return {
    PERatio: pe,
    PriceToBookRatio: pb,
    ReturnOnEquityTTM: roe,
    ProfitMargin: margin,
    QuarterlyRevenueGrowthYOY: revGrowth,
    QuarterlyEarningsGrowthYOY: epsGrowth
  }
}

async function fetchBenchmarkReturn(symbol, asOfDate) {
  const [hist, quote] = await Promise.all([
    apiGet(`/historical-price/${symbol}?date=${encodeURIComponent(asOfDate)}`),
    apiGet(`/quote/${symbol}`).catch(() => null)
  ])
  const current = quote?.regularMarketPrice
  if (hist?.close == null || current == null) return null
  return (current - hist.close) / hist.close
}

async function processTicker(symbol, asOfDate) {
  const sym = String(symbol).toUpperCase()
  const [fundamentals, asOfPrice, daily, quote] = await Promise.all([
    apiGet(`/historical-fundamentals/${sym}`),
    apiGet(`/historical-price/${sym}?date=${encodeURIComponent(asOfDate)}`),
    apiGet(`/daily/${sym}`),
    apiGet(`/quote/${sym}`).catch(() => null)
  ])

  const overview = buildOverviewFromFundamentals(fundamentals, asOfDate, asOfPrice.close)
  const points = (daily.points || [])
    .filter(p => p.date <= asOfDate && p.close != null)
    .map(p => ({ date: p.date, close: p.close }))

  const scoreResult = computeBacktestScore({ overview, points })
  const currentPrice = quote?.regularMarketPrice ?? null

  if (asOfPrice.close == null || currentPrice == null || scoreResult.composite == null) {
    throw new Error('Insufficient data for score or prices')
  }

  const fwdReturn = (currentPrice - asOfPrice.close) / asOfPrice.close

  return {
    symbol: sym,
    name: quote?.shortName || quote?.longName || '',
    sector: '—',
    asOfPrice: asOfPrice.close,
    currentPrice,
    return: fwdReturn,
    score: scoreResult.composite,
    pillars: scoreResult.pillars
  }
}

export async function runBacktest(tickers, asOfDate, onProgress) {
  const list = [...new Set(tickers.map(t => String(t).toUpperCase()))]
  const total = list.length
  const results = []
  let completed = 0

  let spyReturn = null
  let qqqReturn = null
  try {
    ;[spyReturn, qqqReturn] = await Promise.all([
      fetchBenchmarkReturn('SPY', asOfDate),
      fetchBenchmarkReturn('QQQ', asOfDate)
    ])
  } catch {
    // benchmarks optional
  }

  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      batch.map(sym => processTicker(sym, asOfDate))
    )
    for (let j = 0; j < settled.length; j++) {
      completed++
      const sym = batch[j]
      const r = settled[j]
      if (r.status === 'fulfilled') {
        results.push(r.value)
      } else {
        results.push({
          symbol: sym,
          error: r.reason?.message || 'Failed',
          sector: '—',
          asOfPrice: null,
          currentPrice: null,
          return: null,
          score: null,
          pillars: []
        })
      }
      onProgress?.({ completed, total, current: sym })
    }
  }

  return {
    results: results.filter(r => !r.error),
    failures: results.filter(r => r.error),
    benchmarks: { spy: spyReturn, qqq: qqqReturn },
    asOfDate
  }
}
