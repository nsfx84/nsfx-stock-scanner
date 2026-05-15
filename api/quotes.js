import { yahooFinance, wrap } from './_lib/yahoo.js'

function mapQuote(q) {
  return {
    symbol: q.symbol,
    shortName: q.shortName || q.longName || q.symbol,
    regularMarketPrice: q.regularMarketPrice ?? null,
    regularMarketChangePercent: q.regularMarketChangePercent ?? null,
    marketCap: q.marketCap ?? null
  }
}

export default wrap(async (req) => {
  const raw = (req.query.symbols || '').toString()
  if (!raw.trim()) throw new Error('Missing symbols')

  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean)
  if (!symbols.length) throw new Error('Missing symbols')

  try {
    const quotes = await yahooFinance.quote(symbols)
    const arr = Array.isArray(quotes) ? quotes : quotes ? [quotes] : []
    return { quotes: arr.map(mapQuote) }
  } catch {
    return { quotes: [] }
  }
}, { cacheSeconds: 60 })
