import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { searchSymbol } from '../lib/yahoo.js'

export default function SearchBar({ onSelect }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!q || q.length < 1) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await searchSymbol(q)
        setResults(r.slice(0, 8))
        setOpen(true)
      } catch (e) {
        setResults([])
      } finally { setLoading(false) }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [q])

  function pick(sym, name) {
    onSelect(sym, name)
    setQ('')
    setResults([])
    setOpen(false)
  }

  // Allow pressing Enter to submit the exact text as ticker
  function onKey(e) {
    if (e.key === 'Enter' && q.trim()) {
      pick(q.trim().toUpperCase(), '')
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-xl">
      <div className="flex items-center bg-panel border border-line rounded-lg px-3 py-2">
        <Search size={18} className="text-muted mr-2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search ticker or company (e.g. AAPL, Nvidia)..."
          className="bg-transparent outline-none flex-1 text-white placeholder:text-muted"
        />
        {q && (
          <button onClick={() => setQ('')} className="text-muted hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>
      {open && (results.length > 0 || loading) && (
        <div className="absolute z-20 mt-1 w-full bg-panel border border-line rounded-lg shadow-xl overflow-hidden">
          {loading && <div className="px-3 py-2 text-muted text-sm">Searching…</div>}
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => pick(r.symbol, r.name)}
              className="w-full text-left px-3 py-2 hover:bg-line flex justify-between items-center"
            >
              <div>
                <div className="font-mono font-semibold">{r.symbol}</div>
                <div className="text-xs text-muted">{r.name}</div>
              </div>
              <div className="text-xs text-muted">{r.currency}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
