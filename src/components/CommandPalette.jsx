import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  TrendingUp,
  Layers,
  DollarSign,
  Newspaper,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { clearCache } from '../lib/yahoo.js'

const RECENT_KEY = 'recent:tickers'

function getRecentTickers() {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.slice(0, 5) : []
  } catch {
    return []
  }
}

function tickerName(symbol) {
  return sessionStorage.getItem(`name:${symbol}`) || ''
}

function matchesQuery(text, q) {
  if (!q) return true
  return (text || '').toLowerCase().includes(q.toLowerCase())
}

function isValidTickerQuery(q) {
  return /^[A-Z]{1,5}$/.test(q.trim().toUpperCase())
}

function Highlight({ text, query }) {
  if (!query || !text) return <>{text}</>
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-accent">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}

function ResultRow({ item, query, highlighted, onMouseEnter, onClick }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
        highlighted ? 'bg-line' : 'hover:bg-line/60'
      }`}
    >
      <Icon size={16} className="shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <div className="text-white font-medium truncate">
          <Highlight text={item.label} query={query} />
        </div>
        {item.secondary && (
          <div className="text-xs text-muted truncate">
            <Highlight text={item.secondary} query={query} />
          </div>
        )}
      </div>
      {item.hint && (
        <kbd className="shrink-0 text-[10px] font-mono text-muted bg-ink border border-line/50 px-1.5 py-0.5 rounded">
          {item.hint}
        </kbd>
      )}
    </button>
  )
}

export default function CommandPalette({
  open,
  onClose,
  onSelect,
  currentView,
  setView,
  watchlist
}) {
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setHighlightedIndex(0)
      return
    }
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const sections = useMemo(() => {
    const recent = getRecentTickers().map(symbol => ({
      id: `recent:${symbol}`,
      type: 'ticker',
      label: symbol,
      secondary: tickerName(symbol) || undefined,
      icon: TrendingUp,
      hint: null,
      searchText: `${symbol} ${tickerName(symbol)}`,
      onActivate: () => onSelect(symbol)
    }))

    const watch = (watchlist || []).map(w => ({
      id: `watch:${w.symbol}`,
      type: 'ticker',
      label: w.symbol,
      secondary: w.name || tickerName(w.symbol) || undefined,
      icon: TrendingUp,
      hint: null,
      searchText: `${w.symbol} ${w.name || ''} ${tickerName(w.symbol)}`,
      onActivate: () => onSelect(w.symbol)
    }))

    const navigate = [
      { id: 'nav:single', view: 'single', label: 'Go to Search', icon: Search, hint: null },
      { id: 'nav:screener', view: 'screener', label: 'Go to Screener', icon: Layers, hint: 'G S' },
      { id: 'nav:dividends', view: 'dividends', label: 'Go to Dividends', icon: DollarSign, hint: 'G D' },
      { id: 'nav:news', view: 'news', label: 'Go to News', icon: Newspaper, hint: 'G N' }
    ].map(n => ({
      id: n.id,
      type: 'navigate',
      label: n.label,
      secondary: undefined,
      icon: n.icon,
      hint: n.hint,
      searchText: n.label,
      onActivate: () => setView(n.view)
    }))

    const actions = [
      {
        id: 'action:clear',
        label: 'Clear all cache',
        icon: Trash2,
        hint: null,
        searchText: 'clear all cache',
        onActivate: () => {
          clearCache()
          window.location.reload()
        }
      },
      {
        id: 'action:refresh',
        label: 'Refresh current view',
        icon: RefreshCw,
        hint: null,
        searchText: 'refresh current view',
        onActivate: () => window.location.reload()
      }
    ].map(a => ({
      ...a,
      type: 'action',
      secondary: currentView ? `View: ${currentView}` : undefined,
      onActivate: a.onActivate
    }))

    return [
      { title: 'Recent', items: recent },
      { title: 'Watchlist', items: watch },
      { title: 'Navigate', items: navigate },
      { title: 'Actions', items: actions }
    ]
  }, [watchlist, onSelect, setView, currentView])

  const filtered = useMemo(() => {
    const q = query.trim()
    const qLower = q.toLowerCase()

    const filterItems = (items) =>
      items.filter(item => matchesQuery(item.searchText, qLower) || matchesQuery(item.label, qLower))

    if (!q) return sections.filter(s => s.items.length > 0)

    const allItems = sections.flatMap(s => s.items)
    const matched = allItems.filter(
      item =>
        matchesQuery(item.searchText, q) ||
        matchesQuery(item.label, q) ||
        (item.secondary && matchesQuery(item.secondary, q))
    )

    const upper = q.toUpperCase()
    if (isValidTickerQuery(q) && !matched.some(i => i.type === 'ticker' && i.label === upper)) {
      matched.unshift({
        id: `open:${upper}`,
        type: 'ticker',
        label: `Open ${upper}`,
        secondary: tickerName(upper) || 'Open ticker',
        icon: TrendingUp,
        hint: null,
        searchText: upper,
        onActivate: () => onSelect(upper)
      })
    }

    if (matched.length === 0) return []

    return [{ title: 'Results', items: matched }]
  }, [query, sections])

  const flatItems = useMemo(() => filtered.flatMap(s => s.items), [filtered])

  useEffect(() => {
    if (highlightedIndex >= flatItems.length) {
      setHighlightedIndex(Math.max(0, flatItems.length - 1))
    }
  }, [flatItems.length, highlightedIndex])

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(i => (i + 1) % Math.max(flatItems.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(i => (i - 1 + flatItems.length) % Math.max(flatItems.length, 1))
    } else if (e.key === 'Enter' && flatItems[highlightedIndex]) {
      e.preventDefault()
      flatItems[highlightedIndex].onActivate()
    }
  }

  if (!open) return null

  let rowIndex = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-xl bg-panel border border-line rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <Search size={18} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tickers, actions..."
            className="flex-1 bg-transparent text-white placeholder:text-muted outline-none text-sm"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="max-h-[min(50vh,400px)] overflow-y-auto py-2">
          {flatItems.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted text-center">No results</p>
          ) : (
            filtered.map(section => (
              <div key={section.title}>
                <div className="px-4 py-1.5 text-[10px] uppercase tracking-wide text-muted font-medium">
                  {section.title}
                </div>
                {section.items.map(item => {
                  const idx = rowIndex++
                  return (
                    <ResultRow
                      key={item.id}
                      item={item}
                      query={query.trim()}
                      highlighted={idx === highlightedIndex}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => item.onActivate()}
                    />
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
