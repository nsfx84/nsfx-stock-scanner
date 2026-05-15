import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, X, DollarSign, ChevronDown, ChevronRight } from 'lucide-react'

import { getOverview } from '../lib/yahoo.js'
import { computeDividendScore } from '../lib/dividendScore.js'
import { UNIVERSES } from '../data/universes.js'
import { getWatchlist } from '../lib/watchlist.js'

const CONCURRENCY = 10

function scoreColor(s) {
  if (s == null) return 'text-muted'
  if (s >= 75) return 'text-accent'
  if (s >= 60) return 'text-emerald-300'
  if (s >= 45) return 'text-warn'
  if (s >= 30) return 'text-orange-400'
  return 'text-bad'
}

function bandTone(tone) {
  if (tone === 'accent') return 'text-accent'
  if (tone === 'warn')   return 'text-warn'
  if (tone === 'bad')    return 'text-bad'
  return 'text-muted'
}

function fmt(v, kind) {
  if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return '—'
  const n = +v
  if (isNaN(n)) return v
  if (kind === 'pct') return `${(n * 100).toFixed(2)}%`
  if (kind === 'cap') {
    if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`
    if (n >= 1e9)  return `${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6)  return `${(n / 1e6).toFixed(0)}M`
    return n.toFixed(0)
  }
  return n.toFixed(2)
}

export default function DividendView({ onPickRow }) {
  const [universe, setUniverse] = useState('sp500')
  const [results, setResults] = useState([])
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [running, setRunning] = useState(false)
  const abortRef = useRef(null)

  const tickers = useMemo(() => {
    if (universe === 'watchlist') return getWatchlist().map(w => w.symbol)
    return UNIVERSES[universe]?.tickers || []
  }, [universe])

  useEffect(() => {
    setResults([])
    setProgress({ completed: 0, total: 0 })
  }, [universe])

  async function start() {
    setRunning(true)
    setProgress({ completed: 0, total: tickers.length })
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const out = []
    let completed = 0
    const queue = [...tickers]
    async function worker() {
      while (queue.length > 0) {
        if (ctrl.signal.aborted) return
        const symbol = queue.shift()
        try {
          const { data } = await getOverview(symbol)
          if (data && data.DividendYield && +data.DividendYield > 0) {
            const ds = computeDividendScore(data)
            out.push({
              symbol: data.Symbol,
              name: data.Name,
              sector: data.Sector,
              marketCap: data.MarketCapitalization,
              dividendYield: +data.DividendYield,
              payoutRatio: data.PayoutRatio != null ? +data.PayoutRatio : null,
              divQualityScore: ds.composite,
              divVerdict: ds.verdict,
              divMetrics: ds.metrics
            })
          }
        } catch (e) {
          // skip silently — non-dividend payers are expected to be many
        } finally {
          completed++
          setProgress({ completed, total: tickers.length })
        }
      }
    }
    const workers = Array.from({ length: Math.min(CONCURRENCY, tickers.length) }, () => worker())
    await Promise.all(workers)

    out.sort((a, b) => (b.divQualityScore ?? -1) - (a.divQualityScore ?? -1))
    setResults(out)
    setRunning(false)
  }

  function cancel() { abortRef.current?.abort(); setRunning(false) }

  const grouped = useMemo(() => {
    const bands = {
      strong: { label: 'High-quality dividends', range: '75–100', tone: 'accent', items: [] },
      solid:  { label: 'Solid payers',           range: '60–74',  tone: 'accent', items: [] },
      ok:     { label: 'Acceptable',             range: '45–59',  tone: 'warn',   items: [] },
      risky:  { label: 'Caution',                range: '30–44',  tone: 'warn',   items: [] },
      trap:   { label: 'Likely traps',           range: '<30',    tone: 'bad',    items: [] },
      nodata: { label: 'Insufficient data',      range: '—',      tone: 'muted',  items: [] }
    }
    for (const r of results) {
      const s = r.divQualityScore
      if (s == null) bands.nodata.items.push(r)
      else if (s >= 75) bands.strong.items.push(r)
      else if (s >= 60) bands.solid.items.push(r)
      else if (s >= 45) bands.ok.items.push(r)
      else if (s >= 30) bands.risky.items.push(r)
      else bands.trap.items.push(r)
    }
    return bands
  }, [results])

  return (
    <div>
      <div className="bg-panel border border-line rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={20} className="text-accent" />
          <h2 className="text-xl font-semibold">Dividend Quality</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Only dividend-paying stocks. Each is scored on yield level, payout ratio, dividend growth
          history, and free cash flow coverage. High yield alone is often a trap — this combines
          all four legs to surface genuinely sustainable payers.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <UniverseTab id="watchlist" current={universe} onPick={setUniverse} label={`Watchlist (${getWatchlist().length})`} />
          <UniverseTab id="sp500" current={universe} onPick={setUniverse} label={`S&P 500 (${UNIVERSES.sp500.tickers.length})`} />
          <UniverseTab id="nasdaq100" current={universe} onPick={setUniverse} label={`NASDAQ 100 (${UNIVERSES.nasdaq100.tickers.length})`} />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {!running ? (
            <button onClick={start} disabled={tickers.length === 0}
              className="bg-accent text-black px-4 py-2 rounded font-medium flex items-center gap-2 disabled:opacity-40">
              <Play size={16} /> Run scan ({tickers.length} stocks)
            </button>
          ) : (
            <button onClick={cancel} className="bg-bad text-white px-4 py-2 rounded font-medium flex items-center gap-2">
              <X size={16} /> Cancel
            </button>
          )}

          {(running || results.length > 0) && (
            <div className="flex-1 min-w-[200px]">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>{running ? 'Scanning…' : 'Done'} {progress.completed}/{progress.total || tickers.length}</span>
                <span>{progress.total ? Math.round((progress.completed / progress.total) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-line rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: progress.total ? `${(progress.completed / progress.total) * 100}%` : '0%' }} />
              </div>
            </div>
          )}
        </div>

        {!running && results.length > 0 && (
          <div className="mt-3 text-xs text-muted">
            Found {results.length} dividend-paying stocks. Non-payers excluded.
          </div>
        )}
      </div>

      {results.length > 0 && (
        <>
          <Band band={grouped.strong} onPickRow={onPickRow} defaultOpen={true} />
          <Band band={grouped.solid}  onPickRow={onPickRow} defaultOpen={true} />
          <Band band={grouped.ok}     onPickRow={onPickRow} defaultOpen={false} />
          <Band band={grouped.risky}  onPickRow={onPickRow} defaultOpen={false} />
          <Band band={grouped.trap}   onPickRow={onPickRow} defaultOpen={false} />
          <Band band={grouped.nodata} onPickRow={onPickRow} defaultOpen={false} />
        </>
      )}
    </div>
  )
}

function UniverseTab({ id, current, label, onPick }) {
  const active = id === current
  return (
    <button onClick={() => onPick(id)} className={`px-3 py-1.5 rounded text-sm font-medium ${
      active ? 'bg-accent text-black' : 'bg-line text-muted hover:text-white'
    }`}>{label}</button>
  )
}

function Band({ band, onPickRow, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!band || band.items.length === 0) return null

  return (
    <div className="mb-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 py-2 px-3 bg-line/40 hover:bg-line rounded-t border-b border-line">
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className={`font-semibold ${bandTone(band.tone)}`}>{band.label}</span>
        <span className="text-xs text-muted">({band.range})</span>
        <span className="ml-auto text-sm text-muted">{band.items.length} stocks</span>
      </button>
      {open && (
        <div className="overflow-x-auto bg-panel border border-line border-t-0 rounded-b">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr className="border-b border-line">
                <th className="py-2 px-2 text-left">Ticker</th>
                <th className="py-2 px-2 text-left">Name</th>
                <th className="py-2 px-2 text-left">Sector</th>
                <th className="py-2 px-2 text-right">Quality</th>
                <th className="py-2 px-2 text-right">Yield</th>
                <th className="py-2 px-2 text-right">Payout</th>
                <th className="py-2 px-2 text-right">Cap</th>
              </tr>
            </thead>
            <tbody>
              {band.items.map(r => (
                <tr key={r.symbol} onClick={() => onPickRow(r.symbol)} className="border-b border-line/40 hover:bg-line/30 cursor-pointer">
                  <td className="py-2 px-2 font-mono">{r.symbol}</td>
                  <td className="py-2 px-2 text-xs text-muted truncate max-w-[180px]">{r.name || '—'}</td>
                  <td className="py-2 px-2 text-xs text-muted truncate max-w-[140px]">{r.sector || '—'}</td>
                  <td className={`py-2 px-2 text-right font-mono font-semibold ${scoreColor(r.divQualityScore)}`}>{r.divQualityScore ?? '—'}</td>
                  <td className="py-2 px-2 text-right font-mono">{fmt(r.dividendYield, 'pct')}</td>
                  <td className="py-2 px-2 text-right font-mono">{fmt(r.payoutRatio, 'pct')}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{fmt(r.marketCap, 'cap')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
