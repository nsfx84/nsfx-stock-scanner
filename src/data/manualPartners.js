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
  },
  TSLA: {
    items: [
      { name: 'Panasonic', ticker: '6752.T', relationship: 'Supplier', context: 'Battery cell partner at Gigafactory Nevada. Long-standing 2170 cell production.', confidence: 'high' },
      { name: 'CATL', ticker: '300750.SZ', relationship: 'Supplier', context: 'Primary battery supplier for Model 3/Y produced in Shanghai. LFP cells.', confidence: 'high' },
      { name: 'LG Energy Solution', ticker: '373220.KS', relationship: 'Supplier', context: 'Battery supplier for Model Y from Shanghai factory, expanding to other models.', confidence: 'high' },
      { name: 'NVIDIA', ticker: 'NVDA', relationship: 'Supplier', context: 'Historically supplied GPUs for Tesla AI training infrastructure (Dojo era predecessor).', confidence: 'medium' },
      { name: 'TSMC', ticker: 'TSM', relationship: 'Supplier', context: 'Manufactures Tesla\'s in-house FSD/Dojo chips on advanced process nodes.', confidence: 'high' }
    ],
    revenueConcentration: []
  },
  MU: {
    items: [
      { name: 'Apple', ticker: 'AAPL', relationship: 'Customer', context: 'Long-standing NAND and DRAM supplier for iPhones, iPads, and Macs.', confidence: 'high' },
      { name: 'Microsoft', ticker: 'MSFT', relationship: 'Customer', context: 'Azure data center memory and Surface device DRAM/NAND.', confidence: 'high' },
      { name: 'Meta Platforms', ticker: 'META', relationship: 'Customer', context: 'AI infrastructure HBM (High Bandwidth Memory) for GPU training systems.', confidence: 'high' },
      { name: 'Alphabet (Google)', ticker: 'GOOGL', relationship: 'Customer', context: 'Google Cloud DRAM and HBM for TPU and AI infrastructure.', confidence: 'high' },
      { name: 'NVIDIA', ticker: 'NVDA', relationship: 'Customer', context: 'HBM3E supplier for H200 and B100/B200 AI accelerators — qualified alongside SK Hynix and Samsung.', confidence: 'high' },
      { name: 'AMD', ticker: 'AMD', relationship: 'Customer', context: 'Memory supplier for AMD EPYC and Instinct accelerator platforms.', confidence: 'medium' },
      { name: 'Western Digital', ticker: 'WDC', relationship: 'Competitor', context: 'Primary NAND flash competitor — both joint-ventured with Kioxia for production previously.', confidence: 'high' },
      { name: 'SK Hynix', ticker: '000660.KS', relationship: 'Competitor', context: 'Leading DRAM/HBM competitor — currently ahead in HBM3E qualification with NVIDIA.', confidence: 'high' },
      { name: 'Samsung Electronics', ticker: '005930.KS', relationship: 'Competitor', context: 'Largest memory competitor globally in both DRAM and NAND segments.', confidence: 'high' }
    ],
    revenueConcentration: []
  }
}

export function getManualPartners(symbol) {
  const sym = String(symbol || '').trim().toUpperCase()
  return MANUAL_PARTNERS[sym] ?? null
}
