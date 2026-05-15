import { yahooFinance, wrap } from '../_lib/yahoo.js'

export default wrap(async (req) => {
  const symbol = (req.query.symbol || '').toString().toUpperCase()
  if (!symbol) throw new Error('Missing symbol')

  const modules = [
    'incomeStatementHistory',
    'balanceSheetHistory',
    'cashflowStatementHistory',
    'price'
  ]
  return yahooFinance.quoteSummary(symbol, { modules })
}, { cacheSeconds: 604800 })
