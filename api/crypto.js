import { setCors, setCacheHeaders } from './_lib/yahoo.js'

const COINGECKO = 'https://api.coingecko.com/api/v3'
const STABLECOIN = /^(USDT|USDC|DAI|FDUSD|TUSD|USDD|BUSD|FRAX|PYUSD|USDE)$/i

async function fetchCoingecko(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' }
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`CoinGecko ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`)
  }
  return res.json()
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    const type = (req.query.type || 'markets').toString()

    if (type === 'coin') {
      const id = (req.query.id || '').toString().trim()
      if (!id) throw new Error('Missing id')
      const url = `${COINGECKO}/coins/${encodeURIComponent(id)}?localization=false&tickers=false&community_data=true&developer_data=true&sparkline=true`
      const data = await fetchCoingecko(url)
      setCacheHeaders(res, 3600)
      res.status(200).json(data)
      return
    }

    const params = new URLSearchParams({
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: '100',
      page: '1',
      sparkline: 'true',
      price_change_percentage: '24h,7d,30d'
    })
    const url = `${COINGECKO}/coins/markets?${params}`
    const data = await fetchCoingecko(url)
    const list = Array.isArray(data) ? data : []
    const filtered = list.filter(
      c => !STABLECOIN.test(String(c.symbol || '').toUpperCase())
    )
    setCacheHeaders(res, 1800)
    res.status(200).json(filtered)
  } catch (err) {
    console.error(`[${req.url}]`, err.message)
    res.status(500).json({ error: err.message })
  }
}
