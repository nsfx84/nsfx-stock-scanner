import { yahooFinance, wrap } from '../_lib/yahoo.js'

function toDateStr(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  return String(d).slice(0, 10)
}

async function historicalClose(symbol, dateStr) {
  const target = new Date(`${dateStr}T23:59:59Z`)
  if (Number.isNaN(target.getTime())) throw new Error('Invalid date')

  const period1 = new Date(target)
  period1.setDate(period1.getDate() - 7)
  const period2 = new Date(target)
  period2.setDate(period2.getDate() + 7)

  const rows = await yahooFinance.chart(symbol, {
    period1,
    period2,
    interval: '1d'
  })

  const quotes = (rows.quotes || []).filter(q => q.close != null && q.date)
  let best = null

  for (const q of quotes) {
    const d = q.date instanceof Date ? q.date : new Date(q.date)
    if (d <= target && (!best || d > best.d)) {
      best = { d, close: q.close }
    }
  }

  if (!best) {
    throw new Error(`No price on or before ${dateStr}`)
  }

  return { date: toDateStr(best.d), close: best.close }
}

export default wrap(async (req) => {
  const symbol = (req.query.symbol || '').toString().toUpperCase()
  const dateStr = (req.query.date || '').toString().trim()
  if (!symbol) throw new Error('Missing symbol')
  if (!dateStr) throw new Error('Missing date')

  const modules = [
    'incomeStatementHistory',
    'balanceSheetHistory',
    'cashflowStatementHistory',
    'price'
  ]

  const [fundamentals, price] = await Promise.all([
    yahooFinance.quoteSummary(symbol, { modules }),
    historicalClose(symbol, dateStr)
  ])

  return { fundamentals, price }
}, { cacheSeconds: 604800 })
