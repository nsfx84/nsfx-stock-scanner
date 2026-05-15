import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

import Sparkline from './Sparkline.jsx'
import { getCryptoMarkets, clearCryptoCache } from '../lib/yahoo.js'
import { computeCryptoScore, groupCryptoByVerdict, isStablecoin } from '../lib/cryptoScore.js'

function scoreColor(s) {
  if (s == null) return 'text-muted'
  if (s >= 75) return 'text-accent'
  if (s >= 60) return 'text-emerald-300'
  if (s >= 45) return 'text-warn'
  if (s >= 30) return 'text-orange-400'
  return 'text-bad'
}

function bandHeaderColor(tone) {
  if (tone === 'accent') return 'text-accent'
  if (tone === 'warn') return 'text-warn'
  if (tone === 'bad') return 'text-bad'
  return 'text-muted'
}

function fmtPrice(v) {
  if (v == null || Number.isNaN(v)) return '—'
  if (v >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  if (v >= 1) return `$${v.toFixed(2)}`
  if (v >= 0.01) return `$${v.toFixed(4)}`
  return `$${v.toFixed(6)}`
}

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '—'
  const n = +v
  const cls = n > 0 ? 'text-accent' : n < 0 ? 'text-bad' : 'text-muted'
  return <span className={`font-mono ${cls}`}>{n > 0 ? '+' : ''}{n.toFixed(1)}%</span>
}

function fmtCap(n) {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  return `$${n.toFixed(0)}`
}

function pillarScore(row, key) {
  const p = row.pillars?.find(x => x.key === key)
  return p?.score ?? null
}

function Band({ band, onPickRow, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!band || band.items.length === 0) return null

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 py-2 px-3 bg-line/40 hover:bg-line rounded-t border-b border-line"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className={`font-semibold ${bandHeaderColor(band.tone)}`}>{band.label}</span>
        <span className="text-xs text-muted">({band.range})</span>
        <span className="ml-auto text-sm text-muted">{band.items.length} coins</span>
      </button>
      {open && (
        <div className="overflow-x-auto border border-t-0 border-line rounded-b">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted border-b border-line bg-panel/80">
                <th className="text-left py-2 px-2 w-12">Rank</th>
                <th className="text-left py-2 px-2 min-w-[140px]">Coin</th>
                <th className="text-right py-2 px-2">Price</th>
                <th className="text-right py-2 px-2">24h</th>
                <th className="text-right py-2 px-2">7d</th>
                <th className="text-right py-2 px-2">30d</th>
                <th className="text-right py-2 px-2">Score</th>
                <th className="text-right py-2 px-2">Net</th>
                <th className="text-right py-2 px-2">Tok</th>
                <th className="text-right py-2 px-2">Mom</th>
                <th className="text-right py-2 px-2">Liq</th>
                <th className="text-right py-2 px-2">Mkt Cap</th>
                <th className="text-right py-2 px-2 w-24">7D</th>
              </tr>
            </thead>
            <tbody>
              {band.items.map(row => (
                <tr
                  key={row.id}
                  onClick={() => onPickRow(row.id)}
                  className="border-b border-line/60 hover:bg-line/30 cursor-pointer"
                >
                  <td className="py-2 px-2 font-mono text-muted">{row.market_cap_rank ?? '—'}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      {row.image && (
                        <img src={row.image} alt="" className="w-6 h-6 rounded-full" />
                      )}
                      <div>
                        <span className="font-mono text-white uppercase">{row.symbol}</span>
                        <span className="text-muted text-xs ml-2 hidden sm:inline">{row.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right font-mono">{fmtPrice(row.current_price)}</td>
                  <td className="py-2 px-2 text-right">{fmtPct(row.pct24)}</td>
                  <td className="py-2 px-2 text-right">{fmtPct(row.pct7)}</td>
                  <td className="py-2 px-2 text-right">{fmtPct(row.pct30)}</td>
                  <td className={`py-2 px-2 text-right font-mono font-semibold ${scoreColor(row.composite)}`}>
                    {row.composite ?? '—'}
                  </td>
                  <td className={`py-2 px-2 text-right font-mono ${scoreColor(pillarScore(row, 'network'))}`}>
                    {pillarScore(row, 'network') ?? '—'}
                  </td>
                  <td className={`py-2 px-2 text-right font-mono ${scoreColor(pillarScore(row, 'tokenomics'))}`}>
                    {pillarScore(row, 'tokenomics') ?? '—'}
                  </td>
                  <td className={`py-2 px-2 text-right font-mono ${scoreColor(pillarScore(row, 'momentum'))}`}>
                    {pillarScore(row, 'momentum') ?? '—'}
                  </td>
                  <td className={`py-2 px-2 text-right font-mono ${scoreColor(pillarScore(row, 'liquidity'))}`}>
                    {pillarScore(row, 'liquidity') ?? '—'}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-muted">{fmtCap(row.market_cap)}</td>
                  <td className="py-2 px-2 text-right">
                    <Sparkline data={row.sparkline} width={72} height={22} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function pctFromMarket(coin, key) {
  const flat = coin[key]
  if (flat != null && typeof flat !== 'object') return flat
  const nested = coin[`${key}_in_currency`]
  if (nested?.usd != null) return nested.usd
  if (nested != null && typeof nested !== 'object') return nested
  return null
}

export default function CryptoScreener({ onPickCoin }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshedAt, setRefreshedAt] = useState(null)
  const [fromCache, setFromCache] = useState(false)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    if (force) clearCryptoCache()
    try {
      const { data, fromCache: cached } = await getCryptoMarkets()
      const filtered = (data || []).filter(c => !isStablecoin(c))
      const scored = filtered.map(coin => {
        const score = computeCryptoScore(coin)
        return {
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          image: coin.image,
          current_price: coin.current_price,
          market_cap: coin.market_cap,
          market_cap_rank: coin.market_cap_rank,
          pct24: coin.price_change_percentage_24h,
          pct7: pctFromMarket(coin, 'price_change_percentage_7d'),
          pct30: pctFromMarket(coin, 'price_change_percentage_30d'),
          sparkline: coin.sparkline_in_7d?.price,
          composite: score.composite,
          pillars: score.pillars,
          verdict: score.verdict
        }
      })
      setRows(scored)
      setFromCache(cached)
      setRefreshedAt(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const bands = useMemo(() => groupCryptoByVerdict(rows), [rows])
  const bandList = [
    bands.strong,
    bands.solid,
    bands.mixed,
    bands.weak,
    bands.avoid,
    bands.nodata
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold">Crypto Screener — top 100 by market cap</h2>
          <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">
            Score is a quality filter, not a recommendation. Crypto markets are dominated by narrative
            and liquidity flows that no fundamental score captures. Use as one input among many.
          </p>
          <p className="text-sm text-muted mt-1">
            CoinGecko data · scored on network, tokenomics, momentum, and liquidity
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {refreshedAt && (
            <span className="text-xs text-muted">
              {fromCache ? 'Cached · ' : ''}
              Updated {refreshedAt.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-muted hover:text-white hover:bg-line/50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {loading && rows.length === 0 && (
        <div className="bg-panel border border-line rounded-xl p-8 text-center text-muted">
          Loading crypto markets…
        </div>
      )}

      {error && (
        <div className="bg-panel border border-bad rounded-xl p-5 text-bad text-sm">
          {error}
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div>
          {bandList.map((band, i) => (
            <Band
              key={band.label}
              band={band}
              onPickRow={onPickCoin}
              defaultOpen={i < 2}
            />
          ))}
        </div>
      )}
    </div>
  )
}
