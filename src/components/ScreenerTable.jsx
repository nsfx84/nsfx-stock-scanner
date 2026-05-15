import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'

function scoreColor(s) {
  if (s == null) return 'text-muted'
  if (s >= 75) return 'text-accent'
  if (s >= 60) return 'text-emerald-300'
  if (s >= 45) return 'text-warn'
  if (s >= 30) return 'text-orange-400'
  return 'text-bad'
}

function bandHeaderColor(tone) {
  if (tone === 'accent') return 'text-accent'
  if (tone === 'warn')   return 'text-warn'
  if (tone === 'bad')    return 'text-bad'
  return 'text-muted'
}

function fmt(v, kind) {
  if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return '—'
  const n = +v
  if (isNaN(n)) return v
  if (kind === 'pct') return `${(n * 100).toFixed(1)}%`
  if (kind === 'cap') {
    if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`
    if (n >= 1e9)  return `${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6)  return `${(n / 1e6).toFixed(0)}M`
    return n.toFixed(0)
  }
  return n.toFixed(2)
}

function deltaIndicator(delta) {
  if (delta == null) return null
  if (Math.abs(delta) < 1) return <span className="text-muted text-[10px] ml-1">·</span>
  const sign = delta > 0 ? '▲' : '▼'
  const cls = delta > 0 ? 'text-accent' : 'text-bad'
  return <span className={`${cls} text-[10px] ml-1`}>{sign}{Math.abs(Math.round(delta))}</span>
}

const COLUMNS = [
  { key: 'symbol',    label: 'Ticker',    sortable: true,  align: 'left', width: 'w-20' },
  { key: 'name',      label: 'Name',      sortable: false, align: 'left' },
  { key: 'sector',    label: 'Sector',    sortable: false, align: 'left' },
  { key: 'composite', label: 'Score',     sortable: true,  align: 'right', width: 'w-16' },
  { key: 'fund',      label: 'Fund',      sortable: true,  align: 'right', width: 'w-14' },
  { key: 'analysts',  label: 'Analyst',   sortable: true,  align: 'right', width: 'w-14' },
  { key: 'growth',    label: 'Growth',    sortable: true,  align: 'right', width: 'w-14' },
  { key: 'marketCap', label: 'Cap',       sortable: true,  align: 'right', width: 'w-16' },
  { key: 'pe',        label: 'P/E',       sortable: true,  align: 'right', width: 'w-16' },
  { key: 'pb',        label: 'P/B',       sortable: true,  align: 'right', width: 'w-16' },
  { key: 'roe',       label: 'ROE',       sortable: true,  align: 'right', width: 'w-16' },
  { key: 'margin',    label: 'Margin',    sortable: true,  align: 'right', width: 'w-16' },
  { key: 'revGrowth', label: 'Rev YoY',   sortable: true,  align: 'right', width: 'w-16' },
  { key: 'divYield',  label: 'Div',       sortable: true,  align: 'right', width: 'w-14' }
]

function pillarScore(row, key) {
  const p = row.pillars?.find(x => x.key === key)
  return p?.score ?? null
}

function Band({ band, sortKey, sortDir, onSort, onPickRow, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  // Sorting per-band — must run unconditionally for hook order
  const sorted = useMemo(() => {
    const arr = [...(band?.items || [])]
    const cmp = (a, b) => {
      let av, bv
      if (sortKey === 'fund')      { av = pillarScore(a, 'fundamentals'); bv = pillarScore(b, 'fundamentals') }
      else if (sortKey === 'analysts') { av = pillarScore(a, 'analysts'); bv = pillarScore(b, 'analysts') }
      else if (sortKey === 'growth')   { av = pillarScore(a, 'growth');   bv = pillarScore(b, 'growth') }
      else { av = a[sortKey]; bv = b[sortKey] }
      av = (av == null || av === '') ? -Infinity : +av
      bv = (bv == null || bv === '') ? -Infinity : +bv
      if (isNaN(av)) av = -Infinity
      if (isNaN(bv)) bv = -Infinity
      return sortDir === 'asc' ? av - bv : bv - av
    }
    arr.sort(cmp)
    return arr
  }, [band?.items, sortKey, sortDir])

  // Early return AFTER all hooks have run
  if (!band || band.items.length === 0) return null

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 py-2 px-3 bg-line/40 hover:bg-line rounded-t border-b border-line"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className={`font-semibold ${bandHeaderColor(band.tone)}`}>{band.label}</span>
        <span className="text-xs text-muted">({band.range})</span>
        <span className="ml-auto text-sm text-muted">{band.items.length} stocks</span>
      </button>
      {open && (
        <div className="overflow-x-auto bg-panel border border-line border-t-0 rounded-b">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr className="border-b border-line">
                {COLUMNS.map(c => (
                  <th
                    key={c.key}
                    className={`py-2 px-2 ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.width || ''} ${c.sortable ? 'cursor-pointer hover:text-white' : ''}`}
                    onClick={() => c.sortable && onSort(c.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sortKey === c.key && (
                        sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr
                  key={row.symbol}
                  onClick={() => onPickRow(row.symbol)}
                  className="border-b border-line/40 hover:bg-line/30 cursor-pointer"
                  title={row.error || 'Click to open detail view'}
                >
                  <td className="py-2 px-2 font-mono">{row.symbol}</td>
                  <td className="py-2 px-2 text-xs text-muted truncate max-w-[180px]">{row.name || '—'}</td>
                  <td className="py-2 px-2 text-xs text-muted truncate max-w-[140px]">{row.sector || '—'}</td>
                  <td className={`py-2 px-2 text-right font-mono font-semibold ${scoreColor(row.composite)}`}>
                    {row.composite ?? '—'}
                    {deltaIndicator(row.delta)}
                  </td>
                  <td className={`py-2 px-2 text-right font-mono text-xs ${scoreColor(pillarScore(row, 'fundamentals'))}`}>
                    {pillarScore(row, 'fundamentals') ?? '—'}
                  </td>
                  <td className={`py-2 px-2 text-right font-mono text-xs ${scoreColor(pillarScore(row, 'analysts'))}`}>
                    {pillarScore(row, 'analysts') ?? '—'}
                  </td>
                  <td className={`py-2 px-2 text-right font-mono text-xs ${scoreColor(pillarScore(row, 'growth'))}`}>
                    {pillarScore(row, 'growth') ?? '—'}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{fmt(row.marketCap, 'cap')}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{fmt(row.pe)}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{fmt(row.pb)}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{fmt(row.roe, 'pct')}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{fmt(row.margin, 'pct')}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{fmt(row.revGrowth, 'pct')}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{fmt(row.divYield, 'pct')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ScreenerTable({ bands, onPickRow }) {
  const [sortKey, setSortKey] = useState('composite')
  const [sortDir, setSortDir] = useState('desc')

  function onSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  return (
    <div>
      <Band band={bands.strongBuy}  sortKey={sortKey} sortDir={sortDir} onSort={onSort} onPickRow={onPickRow} defaultOpen={true} />
      <Band band={bands.closerLook} sortKey={sortKey} sortDir={sortDir} onSort={onSort} onPickRow={onPickRow} defaultOpen={true} />
      <Band band={bands.mixed}      sortKey={sortKey} sortDir={sortDir} onSort={onSort} onPickRow={onPickRow} defaultOpen={false} />
      <Band band={bands.weak}       sortKey={sortKey} sortDir={sortDir} onSort={onSort} onPickRow={onPickRow} defaultOpen={false} />
      <Band band={bands.avoid}      sortKey={sortKey} sortDir={sortDir} onSort={onSort} onPickRow={onPickRow} defaultOpen={false} />
      <Band band={bands.nodata}     sortKey={sortKey} sortDir={sortDir} onSort={onSort} onPickRow={onPickRow} defaultOpen={false} />
    </div>
  )
}
