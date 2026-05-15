import { yahooFinance, wrap } from './_lib/yahoo.js'

export default wrap(async (req) => {
  const q = (req.query.q || '').toString().trim()
  if (!q) return { quotes: [] }

  const r = await yahooFinance.search(q, { quotesCount: 10, newsCount: 0 })
  const quotes = (r.quotes || [])
    .filter(q => q.quoteType === 'EQUITY' && ['NMS', 'NYQ', 'NGM', 'ASE', 'BATS'].includes(q.exchange))
    .map(q => ({
      symbol: q.symbol,
      name: q.shortname || q.longname,
      exchange: q.exchange,
      type: q.typeDisp
    }))
  return { quotes }
}, { cacheSeconds: 86400 })  // 1 day
