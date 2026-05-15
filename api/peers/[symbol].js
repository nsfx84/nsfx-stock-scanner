import { yahooFinance, wrap } from '../_lib/yahoo.js'

export default wrap(async (req) => {
  const symbol = (req.query.symbol || '').toString().toUpperCase()
  if (!symbol) throw new Error('Missing symbol')

  try {
    const r = await yahooFinance.recommendationsBySymbol(symbol)
    const peers = (r.recommendedSymbols || []).map(s => s.symbol).slice(0, 6)
    return { peers }
  } catch {
    return { peers: [] }
  }
}, { cacheSeconds: 604800 })  // 7 days
