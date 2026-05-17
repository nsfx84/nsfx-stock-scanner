import { yahooFinance, wrap } from '../_lib/yahoo.js'

function wantsPartners(req) {
  return String(req.query.include || '')
    .split(',')
    .map(s => s.trim())
    .includes('partners')
}

function parseJsonFromText(text) {
  if (!text) return null
  let raw = text.trim()
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  if (fence) raw = fence[1].trim()
  const parsed = JSON.parse(raw)
  if (!parsed || !Array.isArray(parsed.items)) return null
  return {
    items: parsed.items,
    revenueConcentration: Array.isArray(parsed.revenueConcentration)
      ? parsed.revenueConcentration
      : []
  }
}

async function extractPartners(summary, symbol) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || !summary) return null

  const prompt = `You are analyzing the business summary for ${symbol}. Extract business partners, major customers, and key suppliers mentioned or strongly implied in the text.

Return ONLY valid JSON (no markdown, no commentary) matching this exact shape:
{"items":[{"name":"","ticker":"","relationship":"","context":"","confidence":""}],"revenueConcentration":[]}

Rules:
- items: array of partner/customer/supplier entries
- name: company or entity name
- ticker: US/public stock symbol if known, otherwise null
- relationship: short label (e.g. Customer, Supplier, Strategic partner, Distributor)
- context: one sentence explaining the relationship
- confidence: exactly one of "high", "medium", "low"
- revenueConcentration: array of {name, percent, context} if revenue concentration is mentioned, else []

Business summary:
${summary}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 200)}`)
  }

  const body = await res.json()
  const text = body?.content?.find(c => c.type === 'text')?.text
  return parseJsonFromText(text)
}

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
  const qs = await yahooFinance.quoteSummary(symbol, { modules })

  if (!wantsPartners(req)) return qs

  try {
    const partners = await extractPartners(
      qs?.assetProfile?.longBusinessSummary,
      symbol
    )
    if (partners) return { ...qs, partners }
  } catch (err) {
    console.error(`[overview/${symbol}] partners extraction failed:`, err.message)
  }

  return qs
}, { cacheSeconds: 21600 })  // 6 hours — fundamentals only update quarterly
