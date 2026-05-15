import { useEffect, useState, useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { getNews } from '../lib/yahoo.js'

function formatTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

/**
 * @param {{ symbol?: string, symbols?: string[], heading?: string, refreshKey?: number }} props
 * - Pass `symbol` for a single ticker.
 * - Pass `symbols` (non-empty) to merge and dedupe news from multiple tickers (e.g. watchlist).
 */
export default function NewsPanel({ symbol, symbols, heading, refreshKey = 0 }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const symbolsSortedKey = JSON.stringify(
    (symbols || []).map(s => String(s).toUpperCase()).sort()
  )

  const tickers = useMemo(() => {
    if (symbols?.length) return symbols.map(s => String(s).toUpperCase())
    if (symbol) return [String(symbol).toUpperCase()]
    return []
  }, [symbol, symbolsSortedKey, refreshKey])

  const tickersDep = tickers.join(',')

  const defaultHeading =
    tickers.length > 1 ? 'Watchlist news' : tickers.length === 1 ? `News · ${tickers[0]}` : 'News'

  useEffect(() => {
    if (!tickers.length) {
      setItems([])
      return
    }
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const batches = await Promise.all(
          tickers.map(async sym => {
            const list = await getNews(sym)
            return (list || []).map(n => ({ ...n, _querySymbol: sym }))
          })
        )
        const flat = batches.flat()
        const seen = new Set()
        const deduped = []
        for (const n of flat) {
          const key = n.uuid || n.link
          if (!key || seen.has(key)) continue
          seen.add(key)
          deduped.push(n)
        }
        deduped.sort((a, b) => {
          const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
          const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
          return tb - ta
        })
        if (!cancelled) setItems(deduped)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [tickersDep, refreshKey])

  if (!tickers.length) {
    return (
      <div className="bg-panel border border-line rounded-xl p-5">
        <div className="text-lg font-semibold mb-1">{heading || defaultHeading}</div>
        <p className="text-sm text-muted">Add tickers to your watchlist to see aggregated headlines here.</p>
      </div>
    )
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="text-lg font-semibold mb-3">{heading || defaultHeading}</div>

      {loading && <div className="text-sm text-muted">Loading headlines…</div>}
      {error && <div className="text-sm text-warn mb-2">{error}</div>}

      {!loading && !items.length && !error && (
        <p className="text-sm text-muted">No news returned for {tickers.join(', ')}.</p>
      )}

      <ul className="space-y-4">
        {items.map(n => (
          <li
            key={n.uuid || n.link}
            className="border-b border-line/50 pb-4 last:border-0 last:pb-0 flex gap-3"
          >
            {n.thumbnail && (
              <a
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 w-24 h-16 rounded overflow-hidden bg-line/30 border border-line"
              >
                <img src={n.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
              </a>
            )}
            <div className="min-w-0 flex-1">
              <a
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white font-medium text-sm hover:text-accent inline-flex items-start gap-1 group"
              >
                <span className="leading-snug">{n.title}</span>
                <ExternalLink size={14} className="shrink-0 mt-0.5 text-muted group-hover:text-accent" />
              </a>
              <div className="text-xs text-muted mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                <span>{n.publisher || '—'}</span>
                <span>·</span>
                <span>{formatTime(n.publishedAt)}</span>
                {tickers.length > 1 && n._querySymbol && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-line">via {n._querySymbol}</span>
                  </>
                )}
              </div>
              {n.relatedTickers?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {n.relatedTickers.map(t => (
                    <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-line/40 text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
