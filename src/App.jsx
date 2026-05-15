import { useEffect, useState } from 'react'
import { Star, Trash2, RefreshCw, TrendingUp, Layers, Search, DollarSign, Newspaper } from 'lucide-react'

import SearchBar from './components/SearchBar.jsx'
import ScoreCard from './components/ScoreCard.jsx'
import PriceChart from './components/PriceChart.jsx'
import OverviewPanel from './components/OverviewPanel.jsx'
import CompetitorTable from './components/CompetitorTable.jsx'
import NewsPanel from './components/NewsPanel.jsx'
import Watchlist from './components/Watchlist.jsx'
import Dashboard from './components/Dashboard.jsx'
import Screener from './components/Screener.jsx'
import DividendView from './components/DividendView.jsx'

import { getOverview, getDaily, getEarnings, clearCache } from './lib/yahoo.js'
import { computeScore } from './lib/score.js'
import { addToWatchlist, removeFromWatchlist, isOnWatchlist, getWatchlist } from './lib/watchlist.js'

export default function App() {
  const [view, setView] = useState('single')   // 'single' | 'screener' | 'dividends' | 'news'
  const [symbol, setSymbol] = useState(null)
  const [overview, setOverview] = useState(null)
  const [points, setPoints] = useState(null)
  const [earnings, setEarnings] = useState(null)
  const [scoreResult, setScoreResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [starred, setStarred] = useState(false)
  const [watchKey, setWatchKey] = useState(0)
  const [cacheNote, setCacheNote] = useState('')

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      setOverview(null); setPoints(null); setEarnings(null); setScoreResult(null)
      let fromCacheCount = 0; let totalCount = 0

      try {
        const ov = await getOverview(symbol)
        totalCount++; if (ov.fromCache) fromCacheCount++
        if (cancelled) return
        setOverview(ov.data)

        const dl = await getDaily(symbol)
        totalCount++; if (dl.fromCache) fromCacheCount++
        if (cancelled) return
        setPoints(dl.points)

        let earningsData = null
        try {
          const en = await getEarnings(symbol)
          totalCount++; if (en.fromCache) fromCacheCount++
          earningsData = en.data
          if (cancelled) return
          setEarnings(en.data)
        } catch (e) {
          // Earnings failure shouldn't block scoring
          console.warn('Earnings fetch failed:', e.message)
        }

        const currentPrice = dl.points[dl.points.length - 1]?.close
        const result = computeScore({
          overview: ov.data,
          points: dl.points,
          earnings: earningsData,
          currentPrice
        })
        if (cancelled) return
        setScoreResult(result)
        setStarred(isOnWatchlist(symbol))
        setCacheNote(`${fromCacheCount}/${totalCount} from cache`)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [symbol])

  function handleSelect(sym, name) {
    setSymbol(sym)
    setView('single')   // ensure we're in single-stock view when picking
    if (name) sessionStorage.setItem(`name:${sym}`, name)
  }

  function toggleStar() {
    if (!symbol) return
    const name = overview?.Name || sessionStorage.getItem(`name:${symbol}`) || ''
    if (starred) {
      removeFromWatchlist(symbol)
      setStarred(false)
    } else {
      addToWatchlist(symbol, name)
      setStarred(true)
    }
    setWatchKey(k => k + 1)
  }

  function refresh() {
    if (!symbol) return
    clearCache(symbol)
    // Re-trigger by re-setting symbol
    const s = symbol
    setSymbol(null)
    setTimeout(() => setSymbol(s), 0)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-panel/50 sticky top-0 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-accent" size={22} />
            <h1 className="font-bold">NSFX Stock Scanner</h1>
          </div>
          <div className="flex gap-1 bg-ink border border-line rounded-lg p-1">
            <button
              onClick={() => setView('single')}
              className={`px-3 py-1 text-sm rounded flex items-center gap-1.5 ${
                view === 'single' ? 'bg-accent text-black' : 'text-muted hover:text-white'
              }`}
            ><Search size={14} /> Search</button>
            <button
              onClick={() => setView('screener')}
              className={`px-3 py-1 text-sm rounded flex items-center gap-1.5 ${
                view === 'screener' ? 'bg-accent text-black' : 'text-muted hover:text-white'
              }`}
            ><Layers size={14} /> Screener</button>
            <button
              onClick={() => setView('dividends')}
              className={`px-3 py-1 text-sm rounded flex items-center gap-1.5 ${
                view === 'dividends' ? 'bg-accent text-black' : 'text-muted hover:text-white'
              }`}
            ><DollarSign size={14} /> Dividends</button>
            <button
              onClick={() => setView('news')}
              className={`px-3 py-1 text-sm rounded flex items-center gap-1.5 ${
                view === 'news' ? 'bg-accent text-black' : 'text-muted hover:text-white'
              }`}
            ><Newspaper size={14} /> News</button>
          </div>
          {view === 'single' && <SearchBar onSelect={handleSelect} />}
          <div className="ml-auto text-xs text-muted hidden md:block">
            Yahoo Finance · unlimited · cached locally
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {view === 'screener' && (
          <Screener onPickRow={(sym) => handleSelect(sym, '')} />
        )}

        {view === 'dividends' && (
          <DividendView onPickRow={(sym) => handleSelect(sym, '')} />
        )}

        {view === 'news' && (
          <div className="grid md:grid-cols-[1fr_280px] gap-6">
            <NewsPanel
              symbols={getWatchlist().map(w => w.symbol)}
              refreshKey={watchKey}
              heading="Watchlist news"
            />
            <Watchlist
              onSelect={(s) => handleSelect(s, '')}
              refreshKey={watchKey}
              onMutate={() => setWatchKey(k => k + 1)}
            />
          </div>
        )}

        {view === 'single' && !symbol && (
          <div className="grid md:grid-cols-[1fr_280px] gap-6">
            <Dashboard
              onPickRow={handleSelect}
              onSwitchView={setView}
              refreshKey={watchKey}
              onWatchlistMutate={() => setWatchKey(k => k + 1)}
            />
            <Watchlist
              onSelect={(s) => handleSelect(s, '')}
              refreshKey={watchKey}
              onMutate={() => setWatchKey(k => k + 1)}
            />
          </div>
        )}

        {view === 'single' && symbol && (
          <div className="grid md:grid-cols-[1fr_280px] gap-6">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="font-mono text-2xl">{symbol}</div>
                <button onClick={toggleStar} className="text-muted hover:text-warn">
                  <Star size={20} className={starred ? 'fill-warn text-warn' : ''} />
                </button>
                <button onClick={refresh} className="text-muted hover:text-white" title="Refresh from API (clears cache)">
                  <RefreshCw size={16} />
                </button>
                {cacheNote && <span className="text-xs text-muted">{cacheNote}</span>}
              </div>

              {loading && (
                <div className="bg-panel border border-line rounded-xl p-8 text-center text-muted">
                  Loading {symbol}…
                </div>
              )}

              {error && (
                <div className="bg-panel border border-bad rounded-xl p-5 text-bad text-sm">
                  <div className="font-medium mb-1">Couldn't load {symbol}</div>
                  <div className="text-xs">{error}</div>
                </div>
              )}

              {scoreResult && <ScoreCard result={scoreResult} />}
              {points     && <PriceChart points={points} />}
              {overview   && <OverviewPanel overview={overview} />}
              {overview   && <CompetitorTable symbol={symbol} />}
              {overview   && <NewsPanel symbol={symbol} refreshKey={watchKey} />}
            </div>

            <div className="space-y-4">
              <Watchlist
                onSelect={(s) => handleSelect(s, '')}
                refreshKey={watchKey}
                onMutate={() => setWatchKey(k => k + 1)}
              />
              <div className="bg-panel border border-line rounded-xl p-4 text-xs text-muted">
                <div className="font-medium text-white mb-1 flex items-center gap-1">
                  <RefreshCw size={12} /> Caching
                </div>
                <p>Data is cached in your browser to speed up repeat visits. Click the refresh icon to force-fetch.</p>
                <button
                  onClick={() => { clearCache(); window.location.reload() }}
                  className="mt-2 text-bad hover:underline flex items-center gap-1"
                >
                  <Trash2 size={12} /> Clear all cached data
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-6 text-xs text-muted text-center">
        Data: Alpha Vantage. Educational use only. Not investment advice.
      </footer>
    </div>
  )
}
