import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react'

import ScoreCard from './ScoreCard.jsx'
import { getCryptoCoin, clearCryptoCache } from '../lib/yahoo.js'
import { computeCryptoScore } from '../lib/cryptoScore.js'

function fmtPrice(v) {
  if (v == null || Number.isNaN(v)) return '—'
  if (v >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (v >= 1) return `$${v.toFixed(2)}`
  return `$${v.toFixed(6)}`
}

function fmtSupply(n) {
  if (n == null) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  return n.toLocaleString()
}

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function linkRow(label, href) {
  if (!href) return null
  const url = Array.isArray(href) ? href[0] : href
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 text-sm text-accent hover:underline"
    >
      {label}
      <ExternalLink size={12} />
    </a>
  )
}

export default function CryptoDetail({ coinId, onBack }) {
  const [coin, setCoin] = useState(null)
  const [scoreResult, setScoreResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setCoin(null)
      setScoreResult(null)
      try {
        const { data, fromCache: cached } = await getCryptoCoin(coinId)
        if (cancelled) return
        setCoin(data)
        setFromCache(cached)
        setScoreResult(computeCryptoScore(data))
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [coinId])

  function refresh() {
    clearCryptoCache(coinId)
    setCoin(null)
    setScoreResult(null)
    setLoading(true)
    getCryptoCoin(coinId)
      .then(({ data, fromCache: cached }) => {
        setCoin(data)
        setFromCache(cached)
        setScoreResult(computeCryptoScore(data))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  const md = coin?.market_data || {}
  const price = md.current_price?.usd
  const ch24 = md.price_change_percentage_24h
  const ch7 = md.price_change_percentage_7d_in_currency?.usd ?? md.price_change_percentage_7d
  const ch30 = md.price_change_percentage_30d_in_currency?.usd ?? md.price_change_percentage_30d
  const rank = md.market_cap_rank
  const desc = coin?.description?.en || ''
  const descShort = desc.length > 500 ? `${desc.slice(0, 500)}…` : desc

  const links = coin?.links || {}
  const hasLinks = links.homepage?.[0] || links.whitepaper || links.repos_url?.github
    || links.subreddit_url || links.twitter_screen_name

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted hover:text-white"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          type="button"
          onClick={refresh}
          className="text-muted hover:text-white"
          title="Refresh from API"
        >
          <RefreshCw size={16} />
        </button>
        {fromCache && <span className="text-xs text-muted">from cache</span>}
      </div>

      {loading && (
        <div className="bg-panel border border-line rounded-xl p-8 text-center text-muted">
          Loading…
        </div>
      )}

      {error && (
        <div className="bg-panel border border-bad rounded-xl p-5 text-bad text-sm">
          {error}
        </div>
      )}

      {coin && (
        <>
          <div className="bg-panel border border-line rounded-xl p-5">
            <div className="flex flex-wrap items-start gap-4">
              {coin.image?.large && (
                <img src={coin.image.large} alt="" className="w-14 h-14 rounded-full" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-2xl font-bold">{coin.name}</h2>
                  <span className="font-mono text-muted uppercase">{coin.symbol}</span>
                  {rank != null && (
                    <span className="text-xs text-muted bg-line px-2 py-0.5 rounded">Rank #{rank}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-baseline gap-4">
                  <span className="text-3xl font-mono">{fmtPrice(price)}</span>
                  {ch24 != null && (
                    <span className={`font-mono ${ch24 >= 0 ? 'text-accent' : 'text-bad'}`}>
                      {ch24 >= 0 ? '+' : ''}{ch24.toFixed(2)}% (24h)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {scoreResult && <ScoreCard result={scoreResult} />}

          <div className="bg-panel border border-line rounded-xl p-5">
            <h3 className="font-semibold mb-4">Momentum snapshot</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: '24h', v: ch24 },
                { label: '7d', v: ch7 },
                { label: '30d', v: ch30 }
              ].map(({ label, v }) => (
                <div key={label} className="bg-line/30 rounded-lg py-3 px-2">
                  <div className="text-xs text-muted mb-1">{label}</div>
                  <div className={`font-mono text-lg ${v == null ? 'text-muted' : v >= 0 ? 'text-accent' : 'text-bad'}`}>
                    {v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-panel border border-line rounded-xl p-5">
            <h3 className="font-semibold mb-4">Tokenomics</h3>
            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">Circulating supply</dt>
                <dd className="font-mono">{fmtSupply(md.circulating_supply)}</dd>
              </div>
              <div>
                <dt className="text-muted">Max supply</dt>
                <dd className="font-mono">
                  {md.max_supply != null ? fmtSupply(md.max_supply) : 'Uncapped'}
                </dd>
              </div>
              <div>
                <dt className="text-muted">All-time high</dt>
                <dd className="font-mono">
                  {fmtPrice(md.ath?.usd)}
                  {md.ath_date?.usd && (
                    <span className="text-muted text-xs ml-2">{fmtDate(md.ath_date.usd)}</span>
                  )}
                </dd>
                {md.ath_change_percentage?.usd != null && (
                  <dd className="text-xs text-muted mt-0.5">
                    {md.ath_change_percentage.usd.toFixed(1)}% below ATH
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-muted">All-time low</dt>
                <dd className="font-mono">
                  {fmtPrice(md.atl?.usd)}
                  {md.atl_date?.usd && (
                    <span className="text-muted text-xs ml-2">{fmtDate(md.atl_date.usd)}</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {descShort && (
            <div className="bg-panel border border-line rounded-xl p-5">
              <h3 className="font-semibold mb-2">About</h3>
              <p className="text-sm text-muted leading-relaxed">{descShort}</p>
            </div>
          )}

          <div className="bg-panel border border-line rounded-xl p-5">
            <h3 className="font-semibold mb-3">Links</h3>
            <div className="flex flex-wrap gap-4">
              {linkRow('Homepage', links.homepage)}
              {linkRow('Whitepaper', links.whitepaper)}
              {linkRow('GitHub', links.repos_url?.github)}
              {linkRow('Twitter', links.twitter_screen_name ? `https://twitter.com/${links.twitter_screen_name}` : null)}
              {linkRow('Reddit', links.subreddit_url)}
            </div>
            {!hasLinks && (
              <p className="text-xs text-muted">No external links available.</p>
            )}
          </div>

          <p className="text-xs text-muted border border-line/60 rounded-lg p-4 leading-relaxed">
            Crypto is highly speculative. This score uses on-chain and market metrics — no concept of
            intrinsic value applies. Diligence is your responsibility.
          </p>
        </>
      )}
    </div>
  )
}
