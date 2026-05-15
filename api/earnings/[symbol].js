import { yahooFinance, wrap } from '../_lib/yahoo.js'

export default wrap(async (req) => {
  const symbol = (req.query.symbol || '').toString().toUpperCase()
  if (!symbol) throw new Error('Missing symbol')

  return yahooFinance.quoteSummary(symbol, { modules: ['earnings', 'earningsHistory'] })
}, { cacheSeconds: 86400 })  // 1 day
