import { Star, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getWatchlist, removeFromWatchlist } from '../lib/watchlist.js'

export default function Watchlist({ onSelect, refreshKey }) {
  const [list, setList] = useState([])

  useEffect(() => {
    setList(getWatchlist())
  }, [refreshKey])

  function remove(symbol, e) {
    e.stopPropagation()
    setList(removeFromWatchlist(symbol))
  }

  if (!list.length) {
    return (
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Star size={16} className="text-warn" />
          <div className="text-sm font-medium">Watchlist</div>
        </div>
        <div className="text-xs text-muted">Stars appear here. Click ★ on any stock to add it.</div>
      </div>
    )
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Star size={16} className="text-warn fill-warn" />
        <div className="text-sm font-medium">Watchlist ({list.length})</div>
      </div>
      <div className="space-y-1">
        {list.map(item => (
          <button
            key={item.symbol}
            onClick={() => onSelect(item.symbol)}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-line flex items-center justify-between group"
          >
            <div>
              <div className="font-mono text-sm">{item.symbol}</div>
              {item.name && <div className="text-xs text-muted truncate max-w-[140px]">{item.name}</div>}
            </div>
            <button
              onClick={(e) => remove(item.symbol, e)}
              className="opacity-0 group-hover:opacity-100 text-muted hover:text-bad"
            >
              <X size={14} />
            </button>
          </button>
        ))}
      </div>
    </div>
  )
}
