import { yahooFinance, wrap } from '../_lib/yahoo.js'

export default wrap(async (req) => {
  const symbol = (req.query.symbol || '').toString().toUpperCase()
  if (!symbol) throw new Error('Missing symbol')

  const end = new Date()
  const start = new Date(); start.setFullYear(start.getFullYear() - 5)
  const rows = await yahooFinance.chart(symbol, {
    period1: start,
    period2: end,
    interval: '1d'
  })
  const points = (rows.quotes || []).map(r => ({
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
    open: r.open, high: r.high, low: r.low, close: r.close,
    adjClose: r.adjclose, volume: r.volume
  })).filter(p => p.close != null)
  return { points }
}, { cacheSeconds: 21600 })  // 6 hours
