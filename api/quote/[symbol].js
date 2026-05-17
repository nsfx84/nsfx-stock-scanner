import { yahooFinance, wrap } from '../_lib/yahoo.js'

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
  // Vercel auto-populates req.query.symbol from the [symbol].js filename match
  const symbol = (req.query.symbol || '').toString().trim().toUpperCase()
  if (!symbol) throw new Error('Missing symbol parameter')

  try {
    const quote = await yahooFinance.quote(symbol)
    if (!quote) return { quote: null }
    return { quote: mapQuote(quote) }
  } catch (error) {
    console.error(`Error fetching individual quote for ${symbol}:`, error)
    return { quote: null }
  }
}, { cacheSeconds: 60 })