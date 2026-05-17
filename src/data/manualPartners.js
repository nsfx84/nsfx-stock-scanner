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
  },
  AMD: {
    items: [
      { name: 'TSMC', ticker: 'TSM', relationship: 'Supplier', context: 'Sole foundry partner for AMD CPUs and GPUs (5nm, 4nm, 3nm processes).', confidence: 'high' },
      { name: 'Microsoft', ticker: 'MSFT', relationship: 'Customer', context: 'Xbox Series X/S consoles use AMD APUs. Azure deploys AMD EPYC servers and MI300 accelerators.', confidence: 'high' },
      { name: 'Sony', ticker: 'SONY', relationship: 'Customer', context: 'PlayStation 5 console uses AMD APU based on Zen 2 and RDNA 2.', confidence: 'high' },
      { name: 'Meta Platforms', ticker: 'META', relationship: 'Customer', context: 'Deployed AMD MI300X accelerators for AI training infrastructure.', confidence: 'high' },
      { name: 'Oracle', ticker: 'ORCL', relationship: 'Customer', context: 'Oracle Cloud Infrastructure uses AMD EPYC processors and MI300 accelerators.', confidence: 'high' },
      { name: 'Alphabet (Google)', ticker: 'GOOGL', relationship: 'Customer', context: 'Google Cloud deploys AMD EPYC processors in compute instances.', confidence: 'high' }
    ],
    revenueConcentration: []
  }
}

export function getManualPartners(symbol) {
  const sym = String(symbol || '').trim().toUpperCase()
  return MANUAL_PARTNERS[sym] ?? null
}
