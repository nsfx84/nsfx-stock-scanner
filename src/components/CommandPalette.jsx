import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  TrendingUp,
  Home,
  Layers,
  DollarSign,
  Newspaper
} from 'lucide-react'

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

function itemMatches(item, q) {
  return (
    matchesQuery(item.searchText, q) ||
    matchesQuery(item.label, q) ||
    (item.secondary && matchesQuery(item.secondary, q))
  )
}

export default function CommandPalette({
  open,
  onClose,
  onSelect,
  setView,
  watchlist
}) {
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef(null)
  const rowRefs = useRef([])

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
      label: symbol,
      secondary: tickerName(symbol) || undefined,
      icon: TrendingUp,
      searchText: `${symbol} ${tickerName(symbol)}`,
      onActivate: () => onSelect(symbol)
    }))

    const watch = (watchlist || []).map(w => ({
      id: `watch:${w.symbol}`,
      label: w.symbol,
      secondary: w.name || tickerName(w.symbol) || undefined,
      icon: TrendingUp,
      searchText: `${w.symbol} ${w.name || ''} ${tickerName(w.symbol)}`,
      onActivate: () => onSelect(w.symbol)
    }))

    const navigate = [
      { id: 'nav:dashboard', view: 'single', label: 'Go to Dashboard', icon: Home },
      { id: 'nav:screener', view: 'screener', label: 'Go to Screener', icon: Layers },
      { id: 'nav:dividends', view: 'dividends', label: 'Go to Dividends', icon: DollarSign },
      { id: 'nav:news', view: 'news', label: 'Go to News', icon: Newspaper }
    ].map(n => ({
      id: n.id,
      label: n.label,
      secondary: undefined,
      icon: n.icon,
      searchText: n.label,
      onActivate: () => setView(n.view)
    }))

    return [
      { title: 'Recent', items: recent },
      { title: 'Watchlist', items: watch },
      { title: 'Navigate', items: navigate }
    ]
  }, [watchlist, onSelect, setView])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) {
      return sections.filter(s => s.items.length > 0)
    }

    const matched = sections
      .map(s => ({
        title: s.title,
        items: s.items.filter(item => itemMatches(item, q))
      }))
      .filter(s => s.items.length > 0)

    const upper = q.toUpperCase()
    const inLists = sections
      .flatMap(s => s.items)
      .some(
        item =>
          item.label === upper ||
          item.label === `Open ${upper}` ||
          itemMatches(item, q)
      )

    if (/^[A-Z]{1,5}$/.test(upper) && !inLists) {
      const openItem = {
        id: `open:${upper}`,
        label: `Open ${upper}`,
        secondary: tickerName(upper) || undefined,
        icon: TrendingUp,
        searchText: upper,
        onActivate: () => onSelect(upper)
      }
      return [{ title: null, items: [openItem] }, ...matched]
    }

    return matched
  }, [query, sections])

  const flatItems = useMemo(() => filtered.flatMap(s => s.items), [filtered])

  useEffect(() => {
    if (highlightedIndex >= flatItems.length) {
      setHighlightedIndex(Math.max(0, flatItems.length - 1))
    }
  }, [flatItems.length, highlightedIndex])

  useEffect(() => {
    rowRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, flatItems])

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
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-xl mt-32 mx-auto bg-panel border border-line rounded-xl shadow-2xl overflow-hidden"
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

        <div className="max-h-96 overflow-y-auto">
          {flatItems.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted text-center">No results</p>
          ) : (
            filtered.map(section => (
              <div key={section.title || 'open'}>
                {section.title && (
                  <div className="text-xs uppercase tracking-wide text-muted px-3 pt-3 pb-1">
                    {section.title}
                  </div>
                )}
                {section.items.map(item => {
                  const idx = rowIndex++
                  const Icon = item.icon
                  const highlighted = idx === highlightedIndex
                  return (
                    <div
                      key={item.id}
                      ref={el => { rowRefs.current[idx] = el }}
                      role="option"
                      aria-selected={highlighted}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => item.onActivate()}
                      className={`px-3 py-2 flex items-center gap-3 cursor-pointer ${
                        highlighted ? 'bg-line' : 'hover:bg-line/60'
                      }`}
                    >
                      <Icon size={16} className="shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-sm font-medium truncate">{item.label}</div>
                        {item.secondary && (
                          <div className="text-xs text-muted truncate">{item.secondary}</div>
                        )}
                      </div>
                      {highlighted && (
                        <kbd className="shrink-0 text-[10px] font-mono text-muted bg-ink border border-line/50 px-1.5 py-0.5 rounded">
                          ↵
                        </kbd>
                      )}
                    </div>
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
