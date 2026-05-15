import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, X, Layers, History, Save, ToggleLeft, ToggleRight } from 'lucide-react'

import ScreenerTable from './ScreenerTable.jsx'
import FilterBar from './FilterBar.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { runScreener, groupByVerdict } from '../lib/screener.js'
import { UNIVERSES } from '../data/universes.js'
import { getWatchlist } from '../lib/watchlist.js'
import { applySectorRelative } from '../lib/sectorScore.js'
import { applyFilters, FILTER_DEFAULTS } from '../lib/filters.js'
import { saveSnapshot, listSnapshots, annotateWithDeltas } from '../lib/history.js'

export default function Screener({ onPickRow }) {
  const [universe, setUniverse] = useState('watchlist')
  const [results, setResults] = useState([])
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [running, setRunning] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [useSectorScore, setUseSectorScore] = useState(false)
  const [filters, setFilters] = useState({ ...FILTER_DEFAULTS })
  const [showHistory, setShowHistory] = useState(false)
  const [priorTs, setPriorTs] = useState(null)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const abortRef = useRef(null)

  const tickers = useMemo(() => {
    if (universe === 'watchlist') return getWatchlist().map(w => w.symbol)
    return UNIVERSES[universe]?.tickers || []
  }, [universe])

  useEffect(() => {
    setResults([])
    setProgress({ completed: 0, total: 0 })
    setErrorMsg(null)
    setFilters({ ...FILTER_DEFAULTS })
    setPriorTs(null)
  }, [universe])

  async function start() {
    if (tickers.length === 0) {
      setErrorMsg('No tickers in this universe. Star some stocks for the Watchlist, or pick S&P 500 / NASDAQ 100.')
      return
    }
    setRunning(true); setErrorMsg(null)
    setProgress({ completed: 0, total: tickers.length })
    const ctrl = new AbortController()
    abortRef.current = ctrl

    let out = await runScreener(tickers, {
      onProgress: (p) => setProgress(p),
      abortSignal: ctrl.signal
    })

    // Apply sector-relative scores AFTER we have the full set
    applySectorRelative(out)

    // Annotate with deltas vs prior snapshot
    const { hasDeltas, priorTs: pTs } = annotateWithDeltas(out, universe)
    if (hasDeltas) setPriorTs(pTs)

    // Persist as a snapshot
    saveSnapshot(universe, out)
    setHistoryRefreshKey(k => k + 1)

    setResults(out)
    setRunning(false)
  }

  function cancel() {
    abortRef.current?.abort()
    setRunning(false)
  }

  // Apply user filters before grouping
  const filteredResults = useMemo(() => applyFilters(results, filters, { useSectorScore }), [results, filters, useSectorScore])

  // When in sector-relative mode, project sectorComposite onto the composite field used by grouping
  const displayResults = useMemo(() => {
    if (!useSectorScore) return filteredResults
    return filteredResults.map(r => ({
      ...r,
      composite: r.sectorComposite ?? r.composite,
      pillars:   r.sectorPillars   ?? r.pillars,
      verdict:   r.sectorVerdict   ?? r.verdict
    }))
  }, [filteredResults, useSectorScore])

  const bands = useMemo(() => groupByVerdict(displayResults), [displayResults])

  // Available sectors from current results (for filter UI)
  const allSectors = useMemo(() => {
    const set = new Set(results.filter(r => r.sector && !r.error).map(r => r.sector))
    return [...set].sort()
  }, [results])

  const successCount = results.filter(r => !r.error && r.composite != null).length
  const failedCount  = results.filter(r => r.error).length
  const filteredOut  = results.length - filteredResults.length

  return (
    <div>
      <div className="bg-panel border border-line rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers size={20} className="text-accent" />
          <h2 className="text-xl font-semibold">Bulk Screener</h2>
          <button
            onClick={() => setShowHistory(s => !s)}
            className="ml-auto text-sm text-muted hover:text-white flex items-center gap-1"
          >
            <History size={14} /> {showHistory ? 'Hide' : 'Show'} History
          </button>
        </div>
        <p className="text-sm text-muted mb-4">
          Score every stock in a universe, grouped by verdict. Click any row to open the full
          single-stock view with chart and Momentum.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <UniverseTab id="watchlist" current={universe} onPick={setUniverse}
                      label={`Watchlist (${getWatchlist().length})`} />
          <UniverseTab id="sp500"     current={universe} onPick={setUniverse}
                      label={`S&P 500 (${UNIVERSES.sp500.tickers.length})`} />
          <UniverseTab id="nasdaq100" current={universe} onPick={setUniverse}
                      label={`NASDAQ 100 (${UNIVERSES.nasdaq100.tickers.length})`} />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {!running ? (
            <button
              onClick={start}
              disabled={tickers.length === 0}
              className="bg-accent text-black px-4 py-2 rounded font-medium flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={16} />
              Run scan ({tickers.length} stocks)
            </button>
          ) : (
            <button
              onClick={cancel}
              className="bg-bad text-white px-4 py-2 rounded font-medium flex items-center gap-2"
            >
              <X size={16} /> Cancel
            </button>
          )}

          {results.length > 0 && (
            <button
              onClick={() => setUseSectorScore(s => !s)}
              className="px-3 py-2 rounded border border-line hover:bg-line/40 text-sm flex items-center gap-2"
              title="Toggle between broad-market and sector-relative scoring"
            >
              {useSectorScore ? <ToggleRight size={18} className="text-accent" /> : <ToggleLeft size={18} className="text-muted" />}
              <span>{useSectorScore ? 'Sector-relative' : 'Broad-market'}</span>
            </button>
          )}

          {(running || results.length > 0) && (
            <div className="flex-1 min-w-[200px]">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>
                  {running ? 'Scanning…' : 'Done'} {progress.completed}/{progress.total || tickers.length}
                  {!running && failedCount > 0 && (
                    <span className="text-warn"> ({failedCount} failed)</span>
                  )}
                </span>
                <span>{progress.total ? Math.round((progress.completed / progress.total) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-line rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-200"
                  style={{ width: progress.total ? `${(progress.completed / progress.total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}
        </div>

        {errorMsg && (<div className="mt-3 text-sm text-warn">{errorMsg}</div>)}

        {!running && results.length > 0 && (
          <div className="mt-3 text-xs text-muted">
            Scored {successCount} of {results.length} stocks successfully.
            {filteredOut > 0 && (
              <span className="text-warn"> {filteredOut} hidden by filters.</span>
            )}
            {priorTs && (
              <span> Showing changes since prior scan ({new Date(priorTs).toLocaleString()}).</span>
            )}
            {useSectorScore && (
              <span> Scores are <strong>sector-relative</strong>: each stock's metrics scored vs its sector peers in this scan.</span>
            )}
          </div>
        )}
      </div>

      {showHistory && (
        <HistoryPanel universe={universe} refreshKey={historyRefreshKey} />
      )}

      {results.length > 0 && (
        <ErrorBoundary>
          <FilterBar filters={filters} onChange={setFilters} allSectors={allSectors} />
          <ScreenerTable bands={bands} onPickRow={onPickRow} showDeltas={!!priorTs} />
        </ErrorBoundary>
      )}
    </div>
  )
}

function UniverseTab({ id, current, label, onPick }) {
  const active = id === current
  return (
    <button
      onClick={() => onPick(id)}
      className={`px-3 py-1.5 rounded text-sm font-medium ${
        active ? 'bg-accent text-black' : 'bg-line text-muted hover:text-white'
      }`}
    >{label}</button>
  )
}

function HistoryPanel({ universe, refreshKey }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    setItems(listSnapshots(universe))
  }, [universe, refreshKey])

  if (items.length === 0) {
    return (
      <div className="bg-panel border border-line rounded-xl p-4 mb-4 text-sm text-muted">
        No history yet for this universe. Run a scan to start tracking changes over time.
      </div>
    )
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-4 mb-4">
      <div className="text-sm font-medium mb-2 flex items-center gap-2">
        <History size={14} /> Scan history — {universe}
      </div>
      <div className="space-y-1">
        {items.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 text-xs py-1 px-2 rounded hover:bg-line/30">
            <span className="text-muted w-44">{new Date(s.ts).toLocaleString()}</span>
            <span className="font-mono text-muted">{s.count} stocks</span>
            {s.summary?.avgScore != null && (
              <span>avg {s.summary.avgScore}</span>
            )}
            <span className="text-accent">{s.summary?.strongBuy ?? 0} Strong Buy</span>
            <span className="text-bad">{s.summary?.avoid ?? 0} Avoid</span>
            {i === 0 && <span className="text-accent ml-auto">latest</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
