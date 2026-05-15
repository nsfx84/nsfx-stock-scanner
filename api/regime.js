import { yahooFinance, wrap } from './_lib/yahoo.js'

const SYMBOLS = ['QQQ', 'SPY', 'XLK', 'XLP', 'XLV', 'IWM', 'VTV', 'VUG']

function return6MFromChart(rows) {
  const quotes = (rows?.quotes || []).filter(q => q.close != null)
  if (quotes.length < 2) return null
  const first = quotes[0].close
  const last = quotes[quotes.length - 1].close
  if (!first || first === 0) return null
  return ((last - first) / first) * 100
}

async function fetchReturn6M(symbol) {
  const period2 = new Date()
  const period1 = new Date()
  period1.setDate(period1.getDate() - 180)
  const rows = await yahooFinance.chart(symbol, {
    period1,
    period2,
    interval: '1d'
  })
  return return6MFromChart(rows)
}

function avg(nums) {
  const v = nums.filter(n => n != null && !Number.isNaN(n))
  if (!v.length) return null
  return v.reduce((a, b) => a + b, 0) / v.length
}

export default wrap(async () => {
  const settled = await Promise.all(
    SYMBOLS.map(async sym => {
      try {
        const ret = await fetchReturn6M(sym)
        return { sym, ret }
      } catch {
        return { sym, ret: null }
      }
    })
  )

  const bySym = {}
  for (const { sym, ret } of settled) {
    bySym[sym] = ret
  }

  const growthVsValue =
    bySym.VUG != null && bySym.VTV != null ? bySym.VUG - bySym.VTV : null

  const spy = bySym.SPY

  let regime = 'neutral'
  if (spy != null && spy < -5) regime = 'risk-off'
  else if (growthVsValue != null && growthVsValue > 5) regime = 'growth'
  else if (growthVsValue != null && growthVsValue < -5) regime = 'value'

  return {
    growth: {
      return6M: avg([bySym.QQQ, bySym.XLK, bySym.VUG, bySym.IWM]),
      etfs: {
        QQQ: bySym.QQQ,
        XLK: bySym.XLK,
        VUG: bySym.VUG,
        IWM: bySym.IWM
      }
    },
    value: {
      return6M: avg([bySym.XLP, bySym.XLV, bySym.VTV]),
      etfs: {
        XLP: bySym.XLP,
        XLV: bySym.XLV,
        VTV: bySym.VTV
      }
    },
    spy,
    growthVsValue,
    regime
  }
}, { cacheSeconds: 21600 })
