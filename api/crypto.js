import { wrap, setCors } from './_lib/yahoo.js'

const COINGECKO = 'https://api.coingecko.com/api/v3'
const STABLECOIN_RE = /^(USDT|USDC|DAI|FDUSD|TUSD|USDD|BUSD|FRAX|PYUSD|USDE|USDG)$/i
const STABLECOIN_MCAP_FLOOR = 100_000_000

function num(x) {
  if (x == null || x === '') return null
  const n = +x
  return Number.isNaN(n) ? null : n
}

function pct30(coin) {
  const flat = coin.price_change_percentage_30d
  if (flat != null && typeof flat !== 'object') return num(flat)
  const nested = coin.price_change_percentage_30d_in_currency
  if (nested?.usd != null) return num(nested.usd)
  if (nested != null && typeof nested !== 'object') return num(nested)
  return null
}

function isStablecoin(coin) {
  if (!coin) return false
  const symbol = String(coin.symbol || '').toUpperCase()
  if (STABLECOIN_RE.test(symbol)) return true
  const nameLower = String(coin.name || '').toLowerCase()
  if (nameLower.includes('usd') || nameLower.includes('dollar') || nameLower.includes('stable')) {
    return true
  }
  const change30 = pct30(coin)
  const mcap = num(coin.market_cap)
  if (
    change30 != null &&
    mcap != null &&
    mcap > STABLECOIN_MCAP_FLOOR &&
    change30 >= -2 &&
    change30 <= 2
  ) {
    return true
  }
  return false
}

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
  return list.filter(c => !isStablecoin(c))
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
