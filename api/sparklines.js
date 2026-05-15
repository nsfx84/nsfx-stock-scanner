import { yahooFinance, wrap } from './_lib/yahoo.js'

async function fetchCloses(symbol) {
  const period2 = new Date()
  const period1 = new Date()
  period1.setDate(period1.getDate() - 45)

  const rows = await yahooFinance.chart(symbol, {
    period1,
    period2,
    interval: '1d'
  })

  const closes = (rows.quotes || [])
    .map(r => r.close)
    .filter(c => c != null && !Number.isNaN(+c))
    .map(c => +c)

  return closes.slice(-30)
}

export default wrap(async (req) => {
  const raw = (req.query.symbols || '').toString()
  if (!raw.trim()) throw new Error('Missing symbols')

  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean)
  if (!symbols.length) throw new Error('Missing symbols')

  const settled = await Promise.allSettled(
    symbols.map(async (sym) => {
      const closes = await fetchCloses(sym)
      if (closes.length < 2) throw new Error('insufficient data')
      return { sym, closes }
    })
  )

  const out = {}
  for (const r of settled) {
    if (r.status === 'fulfilled') {
      out[r.value.sym] = r.value.closes
    }
  }
  return out
}, { cacheSeconds: 3600 })
