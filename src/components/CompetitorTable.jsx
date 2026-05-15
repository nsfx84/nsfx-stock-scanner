import { useEffect, useState } from 'react'
import { getOverview, getPeers } from '../lib/yahoo.js'

function fmt(v, kind) {
  if (v == null || v === '' || isNaN(+v)) return '—'
  const n = +v
  if (kind === 'pct') return `${(n * 100).toFixed(1)}%`
  if (kind === 'cap') {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
    if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`
    return `$${n}`
  }
  return n.toFixed(2)
}

export default function CompetitorTable({ symbol }) {
  const [peers, setPeers] = useState([])
  const [rows, setRows] = useState([])
  const [loadingPeers, setLoadingPeers] = useState(false)
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchPeers() {
      setLoadingPeers(true); setError(null); setRows([]); setStarted(false)
      try {
        const list = await getPeers(symbol)
        if (!cancelled) setPeers(list)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoadingPeers(false)
      }
    }
    fetchPeers()
    return () => { cancelled = true }
  }, [symbol])

  async function loadComparison() {
    setLoadingRows(true); setError(null); setStarted(true)
    const out = []
    const targets = peers.slice(0, 5)
    try {
      const results = await Promise.allSettled(targets.map(p => getOverview(p)))
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.data?.Symbol) {
          out.push(r.value.data)
        } else if (r.status === 'rejected') {
          console.warn(`Failed to load ${targets[i]}:`, r.reason?.message)
        }
      })
    } finally {
      setRows(out); setLoadingRows(false)
    }
  }

  if (loadingPeers) {
    return (
      <div className="bg-panel border border-line rounded-xl p-5 text-muted text-sm">
        Finding similar tickers…
      </div>
    )
  }

  if (!peers.length) {
    return (
      <div className="bg-panel border border-line rounded-xl p-5">
        <div className="text-lg font-semibold mb-1">Competitor Comparison</div>
        <div className="text-sm text-muted">No peer recommendations available from Yahoo for {symbol}.</div>
      </div>
    )
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <div>
          <div className="text-lg font-semibold">Competitor Comparison</div>
          <div className="text-xs text-muted">
            Yahoo's similar tickers: {peers.map(p => <span key={p} className="font-mono mx-1">{p}</span>)}
          </div>
        </div>
        {!started && (
          <button
            onClick={loadComparison}
            className="bg-accent text-black px-3 py-1.5 rounded text-sm font-medium"
          >Compare {peers.slice(0, 5).length} peers</button>
        )}
      </div>

      {loadingRows && <div className="text-sm text-muted">Loading peers…</div>}
      {error && <div className="text-sm text-warn mb-2">Error: {error}</div>}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted uppercase">
              <tr className="border-b border-line">
                <th className="py-2 text-left">Ticker</th>
                <th className="py-2 text-right">Market Cap</th>
                <th className="py-2 text-right">P/E</th>
                <th className="py-2 text-right">P/B</th>
                <th className="py-2 text-right">ROE</th>
                <th className="py-2 text-right">Margin</th>
                <th className="py-2 text-right">Div Yld</th>
                <th className="py-2 text-right">Rev YoY</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.Symbol} className="border-b border-line/50">
                  <td className="py-2 font-mono">{r.Symbol}</td>
                  <td className="py-2 text-right font-mono">{fmt(r.MarketCapitalization, 'cap')}</td>
                  <td className="py-2 text-right font-mono">{fmt(r.PERatio)}</td>
                  <td className="py-2 text-right font-mono">{fmt(r.PriceToBookRatio)}</td>
                  <td className="py-2 text-right font-mono">{fmt(r.ReturnOnEquityTTM, 'pct')}</td>
                  <td className="py-2 text-right font-mono">{fmt(r.ProfitMargin, 'pct')}</td>
                  <td className="py-2 text-right font-mono">{fmt(r.DividendYield, 'pct')}</td>
                  <td className="py-2 text-right font-mono">{fmt(r.QuarterlyRevenueGrowthYOY, 'pct')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
