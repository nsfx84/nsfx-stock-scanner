import { wrap, setCors } from './_lib/yahoo.js'

const COINGECKO = 'https://api.coingecko.com/api/v3'
const STABLECOIN = /^(USDT|USDC|DAI|FDUSD|TUSD|USDD|BUSD|FRAX|PYUSD|USDE)$/i

async function fetchCoingecko(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`CoinGecko ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`)
  }
  return res.json()
}

const marketsHandler = wrap(async () => {
  const params = new URLSearchParams({
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: '100',
    page: '1',
    sparkline: 'true',
    price_change_percentage: '24h,7d,30d'
  })
  const data = await fetchCoingecko(`${COINGECKO}/coins/markets?${params}`)
  const list = Array.isArray(data) ? data : []
  return list.filter(
    c => !STABLECOIN.test(String(c.symbol || '').toUpperCase())
  )
}, { cacheSeconds: 1800 })

const coinHandler = wrap(async (req) => {
  const id = (req.query.id || '').toString().trim()
  if (!id) throw new Error('Missing id')
  const url = `${COINGECKO}/coins/${encodeURIComponent(id)}?localization=false&tickers=false&community_data=true&developer_data=true&sparkline=true`
  return fetchCoingecko(url)
}, { cacheSeconds: 3600 })

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const type = (req.query.type || '').toString().trim()

  if (type === 'markets') {
    return marketsHandler(req, res)
  }
  if (type === 'coin') {
    return coinHandler(req, res)
  }

  res.status(400).json({
    error: type
      ? `Unknown type "${type}". Use type=markets or type=coin.`
      : 'Missing type query param. Use type=markets or type=coin.'
  })
}
