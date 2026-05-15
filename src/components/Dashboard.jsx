import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp,
  Star,
  Newspaper,
  Layers,
  DollarSign,
  AlertCircle,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react'

import { getQuotes, getNews, getSparklines } from '../lib/yahoo.js'
import Sparkline from './Sparkline.jsx'
import { getWatchlist, removeFromWatchlist } from '../lib/watchlist.js'
import { listSnapshots, loadSnapshot } from '../lib/history.js'
import { isMaterialNews } from '../lib/news.js'

const INDICES = [
  { symbol: 'SPY', label: 'S&P 500' },
  { symbol: 'QQQ', label: 'NASDAQ 100' },
  { symbol: 'DIA', label: 'Dow' },
  { symbol: '^VIX', label: 'VIX', isVix: true }
]

const POPULAR = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'LLY', name: 'Eli Lilly and Company' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' }
]

const CARD =
  'bg-panel border border-line rounded-xl transition-all duration-200 hover:border-accent/20 hover:shadow-lg hover:shadow-black/20'

function SectionHeader({ children }) {
  return (
    <div className="mb-3">
      <h2 className="text-xs uppercase tracking-wide text-muted font-medium">{children}</h2>
      <div className="h-0.5 w-10 bg-accent mt-1.5 rounded-full" />
    </div>
  )
}

function fmtPrice(v) {
  if (v == null || Number.isNaN(+v)) return '—'
  const n = +v
  return n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : n.toFixed(2)
}

function fmtPct(v) {
  if (v == null || Number.isNaN(+v)) return '—'
  const n = +v
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function pctClass(v) {
  if (v == null || Number.isNaN(+v)) return 'text-muted'
  if (+v > 0) return 'text-accent'
  if (+v < 0) return 'text-bad'
  return 'text-muted'
}

function formatDateLong(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatLastRun(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function timeAgo(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getLatestScore(symbol) {
  const sym = String(symbol).toUpperCase()
  const scans = listSnapshots().sort((a, b) => b.ts - a.ts)
  for (const scan of scans) {
    const snap = loadSnapshot(scan.id)
    const row = snap?.results?.find(r => r.symbol === sym)
    if (row?.composite != null) return row.composite
  }
  return null
}

function SparklinePlaceholder({ width, height }) {
  return (
    <div
      className="inline-block bg-line/20 rounded"
      style={{ width, height }}
      aria-hidden
    />
  )
}

function SortIcon({ active, dir }) {
  if (!active) return <span className="inline-block w-3" />
  return dir === 'asc' ? <ChevronUp size={12} className="inline" /> : <ChevronDown size={12} className="inline" />
}

export default function Dashboard({ onPickRow, onSwitchView, refreshKey = 0, onWatchlistMutate }) {
  const [indices, setIndices] = useState([])
  const [indexSparklines, setIndexSparklines] = useState({})
  const [indicesLoading, setIndicesLoading] = useState(true)
  const [watchSparklines, setWatchSparklines] = useState({})
  const [watchlist, setWatchlist] = useState([])
  const [watchQuotes, setWatchQuotes] = useState([])
  const [watchLoading, setWatchLoading] = useState(false)
  const [materialNews, setMaterialNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [sortKey, setSortKey] = useState('score')
  const [sortDir, setSortDir] = useState('desc')

  const lastSp500 = listSnapshots('sp500').sort((a, b) => b.ts - a.ts)[0]
  const lastNasdaq = listSnapshots('nasdaq100').sort((a, b) => b.ts - a.ts)[0]

  useEffect(() => {
    setWatchlist(getWatchlist())
  }, [refreshKey])

  useEffect(() => {
    let cancelled = false
    async function loadIndices() {
      setIndicesLoading(true)
      try {
        const syms = INDICES.map(i => i.symbol)
        const [q, sp] = await Promise.all([getQuotes(syms), getSparklines(syms)])
        if (!cancelled) {
          setIndices(q)
          setIndexSparklines(sp)
        }
      } finally {
        if (!cancelled) setIndicesLoading(false)
      }
    }
    loadIndices()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!watchlist.length) {
      setWatchQuotes([])
      setMaterialNews([])
      return
    }
    let cancelled = false
    const symbols = watchlist.map(w => w.symbol)

    async function loadWatch() {
      setWatchLoading(true)
      try {
        const q = await getQuotes(symbols)
        if (!cancelled) setWatchQuotes(q)
      } finally {
        if (!cancelled) setWatchLoading(false)
      }
    }
    loadWatch()
    return () => { cancelled = true }
  }, [watchlist, refreshKey])

  useEffect(() => {
    if (!watchlist.length) return
    let cancelled = false
    const symbols = watchlist.map(w => w.symbol)

    async function loadNews() {
      setNewsLoading(true)
      try {
        const batches = await Promise.all(
          symbols.map(async sym => {
            const list = await getNews(sym)
            return (list || []).map(n => ({ ...n, _querySymbol: sym }))
          })
        )
        const flat = batches.flat()
        const seen = new Set()
        const deduped = []
        for (const n of flat) {
          const key = n.uuid || n.link
          if (!key || seen.has(key) || !isMaterialNews(n)) continue
          seen.add(key)
          deduped.push(n)
        }
        deduped.sort((a, b) => {
          const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
          const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
          return tb - ta
        })
        if (!cancelled) setMaterialNews(deduped.slice(0, 5))
      } finally {
        if (!cancelled) setNewsLoading(false)
      }
    }
    loadNews()
    return () => { cancelled = true }
  }, [watchlist, refreshKey])

  useEffect(() => {
    if (!watchlist.length) {
      setWatchSparklines({})
      return
    }
    let cancelled = false
    const symbols = watchlist.map(w => w.symbol)
    getSparklines(symbols).then(sp => {
      if (!cancelled) setWatchSparklines(sp)
    })
    return () => { cancelled = true }
  }, [watchlist, refreshKey])

  const quoteMap = useMemo(() => {
    const m = new Map()
    watchQuotes.forEach(q => m.set(q.symbol, q))
    return m
  }, [watchQuotes])

  const tableRows = useMemo(() => {
    return watchlist.map(w => {
      const q = quoteMap.get(w.symbol)
      const score = getLatestScore(w.symbol)
      return {
        symbol: w.symbol,
        name: w.name || q?.shortName || sessionStorage.getItem(`name:${w.symbol}`) || '',
        price: q?.regularMarketPrice,
        changePct: q?.regularMarketChangePercent,
        score
      }
    })
  }, [watchlist, quoteMap, refreshKey])

  const sortedRows = useMemo(() => {
    const rows = [...tableRows]
    const dir = sortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      if (sortKey === 'symbol') return dir * a.symbol.localeCompare(b.symbol)
      if (sortKey === 'name') return dir * (a.name || '').localeCompare(b.name || '')
      if (sortKey === 'price') {
        const av = a.price ?? -Infinity
        const bv = b.price ?? -Infinity
        return dir * (av - bv)
      }
      if (sortKey === 'change') {
        const av = a.changePct ?? -Infinity
        const bv = b.changePct ?? -Infinity
        return dir * (av - bv)
      }
      if (sortKey === 'score') {
        const av = a.score ?? -1
        const bv = b.score ?? -1
        return dir * (av - bv)
      }
      return 0
    })
    return rows
  }, [tableRows, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'symbol' || key === 'name' ? 'asc' : 'desc')
    }
  }

  function removeSymbol(symbol, e) {
    e.stopPropagation()
    removeFromWatchlist(symbol)
    setWatchlist(getWatchlist())
    onWatchlistMutate?.()
  }

  function indexQuote(sym) {
    return indices.find(q => q.symbol === sym)
  }

  return (
    <div className="space-y-6">
      {/* 1. Hero */}
      <div
        className="relative overflow-hidden rounded-xl border border-line py-8 px-6 md:px-8"
        style={{ background: 'linear-gradient(135deg, #111827 0%, #0f1729 55%, #0b1220 100%)' }}
      >
        <TrendingUp
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white pointer-events-none select-none"
          size={160}
          strokeWidth={1}
          style={{ opacity: 0.05 }}
        />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">NSFX Stock Scanner</h1>
            <p className="text-muted text-sm mt-1">Personal research tool for US equities</p>
          </div>
          <div className="font-mono text-sm text-muted shrink-0">
            {formatDateLong()}
          </div>
        </div>
      </div>

      {/* 2. Market indices */}
      <div>
        <SectionHeader>Market overview</SectionHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {INDICES.map(meta => {
            const q = indexQuote(meta.symbol)
            const price = q?.regularMarketPrice
            const chg = q?.regularMarketChangePercent
            const vix = meta.isVix && price != null

            return (
              <div
                key={meta.symbol}
                className={`${CARD} border-l-2 border-l-accent pl-4 pr-4 py-4`}
              >
                <div className="text-xs text-muted mb-0.5">{meta.label}</div>
                {meta.isVix && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted">Volatility</span>
                    {vix && price > 35 && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-bad/20 text-bad">High</span>
                    )}
                    {vix && price > 25 && price <= 35 && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-warn/20 text-warn">Elevated</span>
                    )}
                  </div>
                )}
                {indicesLoading ? (
                  <div className="text-sm text-muted font-mono">…</div>
                ) : (
                  <>
                    <div className="font-mono text-xl md:text-2xl font-semibold tabular-nums">
                      {fmtPrice(price)}
                    </div>
                    <div className={`font-mono text-sm mt-1 tabular-nums ${pctClass(chg)}`}>
                      {fmtPct(chg)}
                    </div>
                    <div className="mt-2 opacity-90">
                      {indexSparklines[meta.symbol] ? (
                        <Sparkline data={indexSparklines[meta.symbol]} width={120} height={32} />
                      ) : (
                        <SparklinePlaceholder width={120} height={32} />
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. Watchlist table */}
      <div className={`${CARD} p-5`}>
        <div className="flex items-center gap-2 mb-4">
          <Star size={18} className="text-warn fill-warn" />
          <h2 className="text-lg font-semibold">Your Watchlist</h2>
        </div>

        {watchlist.length === 0 ? (
          <p className="text-xs text-muted">
            Stars appear here. Click ★ on any stock to add it, or pick a popular ticker below.
          </p>
        ) : (
          <div className="overflow-x-auto">
            {watchLoading && (
              <p className="text-xs text-muted mb-2 font-mono">Refreshing quotes…</p>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted uppercase border-b border-line">
                  {[
                    { key: 'symbol', label: 'Ticker', align: 'left' },
                    { key: 'name', label: 'Name', align: 'left' },
                    { key: 'price', label: 'Price', align: 'right' },
                    { key: 'change', label: 'Day %', align: 'right' },
                    { key: null, label: '30D', align: 'right' },
                    { key: 'score', label: 'Score', align: 'right' },
                    { key: null, label: 'Action', align: 'right' }
                  ].map(col => (
                    <th
                      key={col.label}
                      className={`py-2 px-2 ${col.align === 'right' ? 'text-right' : 'text-left'} ${
                        col.key ? 'cursor-pointer hover:text-white select-none' : ''
                      }`}
                      onClick={() => col.key && toggleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        {col.label}
                        {col.key && (
                          <SortIcon active={sortKey === col.key} dir={sortDir} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(row => (
                  <tr
                    key={row.symbol}
                    onClick={() => onPickRow(row.symbol, row.name)}
                    className="border-b border-line/40 hover:bg-line/30 cursor-pointer group"
                  >
                    <td className="py-2.5 px-2 font-mono font-medium">{row.symbol}</td>
                    <td className="py-2.5 px-2 text-muted max-w-[180px] truncate">{row.name || '—'}</td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums">{fmtPrice(row.price)}</td>
                    <td className={`py-2.5 px-2 text-right font-mono tabular-nums ${pctClass(row.changePct)}`}>
                      {fmtPct(row.changePct)}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {watchSparklines[row.symbol] ? (
                        <Sparkline data={watchSparklines[row.symbol]} width={70} height={20} />
                      ) : (
                        <SparklinePlaceholder width={70} height={20} />
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                      {row.score != null ? Math.round(row.score) : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <button
                        type="button"
                        onClick={e => removeSymbol(row.symbol, e)}
                        className="text-muted hover:text-bad p-1 rounded opacity-60 group-hover:opacity-100"
                        aria-label={`Remove ${row.symbol}`}
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Material news */}
      {watchlist.length > 0 && (
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <Newspaper size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">Material News</h2>
          </div>

          {newsLoading && <p className="text-sm text-muted">Loading headlines…</p>}

          {!newsLoading && materialNews.length === 0 && (
            <p className="text-sm text-muted">No substantive headlines for your watchlist right now.</p>
          )}

          <ul className="space-y-3">
            {materialNews.map(n => (
              <li key={n.uuid || n.link} className="flex gap-3 items-start border-b border-line/40 pb-3 last:border-0 last:pb-0">
                <span className="shrink-0 font-mono text-[10px] px-2 py-1 rounded bg-line/50 text-accent border border-line">
                  {n._querySymbol}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-accent leading-snug block"
                  >
                    {n.title}
                  </a>
                  <div className="text-xs text-muted mt-1 flex flex-wrap gap-x-2">
                    <span>{n.publisher || '—'}</span>
                    <span>·</span>
                    <span className="font-mono">{timeAgo(n.publishedAt)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => onSwitchView('news')}
            className="mt-4 text-sm text-accent hover:underline"
          >
            View all watchlist news →
          </button>
        </div>
      )}

      {/* 5. Quick actions */}
      <div>
        <SectionHeader>Quick actions</SectionHeader>
        <div className="grid md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => onSwitchView('screener')}
            className={`${CARD} p-5 text-left w-full`}
          >
            <Layers size={22} className="text-accent mb-3" />
            <div className="font-semibold">Run S&P 500 scan</div>
            <div className="text-xs text-muted mt-1">
              {lastSp500
                ? `Last run ${formatLastRun(lastSp500.ts)} · ${lastSp500.count} stocks`
                : 'Score the full S&P 500 universe'}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onSwitchView('screener')}
            className={`${CARD} p-5 text-left w-full`}
          >
            <Layers size={22} className="text-accent mb-3" />
            <div className="font-semibold">Run NASDAQ 100 scan</div>
            <div className="text-xs text-muted mt-1">
              {lastNasdaq
                ? `Last run ${formatLastRun(lastNasdaq.ts)} · ${lastNasdaq.count} stocks`
                : 'Score the NASDAQ 100 universe'}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onSwitchView('dividends')}
            className={`${CARD} p-5 text-left w-full`}
          >
            <DollarSign size={22} className="text-accent mb-3" />
            <div className="font-semibold">Browse dividends</div>
            <div className="text-xs text-muted mt-1">Yield, payout, and dividend quality scores</div>
          </button>
        </div>
      </div>

      {/* 6. Popular tickers (no watchlist) */}
      {watchlist.length === 0 && (
        <div>
          <SectionHeader>Popular tickers</SectionHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {POPULAR.map(p => (
              <button
                key={p.symbol}
                type="button"
                onClick={() => onPickRow(p.symbol, p.name)}
                className={`${CARD} p-4 text-left`}
              >
                <div className="font-mono text-lg font-semibold">{p.symbol}</div>
                <div className="text-xs text-muted mt-1 line-clamp-2">{p.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 7. Disclaimer */}
      <div className="p-4 border border-line rounded-xl bg-line/10 text-xs text-muted flex gap-2">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <div>
          This is an educational research tool. Scores are heuristic and based on
          historical data — they do not predict future returns. Not financial advice.
        </div>
      </div>
    </div>
  )
}
