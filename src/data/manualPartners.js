export const MANUAL_PARTNERS = {
  AAPL: {
    items: [
      {
        name: 'Taiwan Semiconductor',
        ticker: 'TSM',
        relationship: 'Supplier',
        context: 'Primary foundry for Apple silicon',
        confidence: 'high'
      },
      {
        name: 'Foxconn (Hon Hai Precision)',
        ticker: 'HNHPF',
        relationship: 'Supplier',
        context: 'Major iPhone assembly partner',
        confidence: 'high'
      },
      {
        name: 'AT&T',
        ticker: 'T',
        relationship: 'Customer',
        context: 'Long-standing carrier distribution partner in the US',
        confidence: 'medium'
      }
    ],
    revenueConcentration: [],
    source: 'manual'
  }
}

export function getManualPartners(symbol) {
  const sym = String(symbol || '').trim().toUpperCase()
  return MANUAL_PARTNERS[sym] ?? null
}
