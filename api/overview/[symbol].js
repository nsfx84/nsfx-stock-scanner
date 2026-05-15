import { yahooFinance, wrap } from '../_lib/yahoo.js'

export default wrap(async (req) => {
  const symbol = (req.query.symbol || '').toString().toUpperCase()
  if (!symbol) throw new Error('Missing symbol')

  const modules = [
    'assetProfile',
    'summaryDetail',
    'defaultKeyStatistics',
    'financialData',
    'price',
    'recommendationTrend'
  ]
  return yahooFinance.quoteSummary(symbol, { modules })
}, { cacheSeconds: 21600 })  // 6 hours — fundamentals only update quarterly
