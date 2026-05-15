import { useState } from 'react'
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react'
import { FILTER_DEFAULTS, activeFilterCount } from '../lib/filters.js'

function SliderRow({ label, value, onChange, min, max, step, format, allowNull = true, defaultValue }) {
  // value is the current filter value (number or null).
  // For allowNull=false sliders, value is always a number.
  // For allowNull=true sliders, null = disabled, number = enabled.
  const enabled = value != null
  const displayValue = enabled ? value : (defaultValue ?? (min + (max - min) / 2))

  function handleToggle(checked) {
    onChange(checked ? (defaultValue ?? (min + (max - min) / 2)) : null)
  }

  function handleSlide(v) {
    const n = +v
    if (isFinite(n)) onChange(n)
  }

  let formatted = '—'
  try { formatted = enabled ? format(value) : '—' } catch { formatted = '—' }

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm flex items-center gap-2">
          {allowNull && (
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleToggle(e.target.checked)}
              className="cursor-pointer"
            />
          )}
          {label}
        </label>
        <span className={`text-sm font-mono ${enabled ? 'text-accent' : 'text-muted'}`}>
          {formatted}
        </span>
      </div>
      {(enabled || !allowNull) && (
        <input
          type="range"
          min={min} max={max} step={step}
          value={displayValue}
          onChange={(e) => handleSlide(e.target.value)}
          disabled={!enabled && allowNull}
          className="w-full accent-emerald-500"
        />
      )}
    </div>
  )
}

export default function FilterBar({ filters, onChange, allSectors }) {
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(filters)

  function patch(p) { onChange({ ...filters, ...p }) }
  function clear() { onChange({ ...FILTER_DEFAULTS }) }

  function toggleSector(sector) {
    const has = filters.sectors.includes(sector)
    patch({ sectors: has ? filters.sectors.filter(s => s !== sector) : [...filters.sectors, sector] })
  }

  return (
    <div className="bg-panel border border-line rounded-xl mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-line/30"
      >
        <div className="flex items-center gap-2">
          <Filter size={16} className={count > 0 ? 'text-accent' : 'text-muted'} />
          <span className="font-medium">Custom Filters</span>
          {count > 0 && (
            <span className="bg-accent text-black text-xs px-2 py-0.5 rounded-full font-mono">{count} active</span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t border-line p-4 grid md:grid-cols-2 gap-x-6">
          <div>
            <SliderRow
              label="Min Composite Score"
              value={filters.minComposite ?? 0}
              onChange={(v) => patch({ minComposite: v ?? 0 })}
              min={0} max={100} step={1}
              format={(v) => (+v).toFixed(0)}
              allowNull={false}
            />
            <SliderRow
              label="Min ROE"
              value={filters.minRoe}
              onChange={(v) => patch({ minRoe: v })}
              min={0} max={0.5} step={0.01}
              defaultValue={0.15}
              format={(v) => `${((+v) * 100).toFixed(0)}%`}
            />
            <SliderRow
              label="Max P/E"
              value={filters.maxPe}
              onChange={(v) => patch({ maxPe: v })}
              min={5} max={60} step={1}
              defaultValue={25}
              format={(v) => (+v).toFixed(0)}
            />
            <SliderRow
              label="Max P/B"
              value={filters.maxPb}
              onChange={(v) => patch({ maxPb: v })}
              min={0.5} max={15} step={0.5}
              defaultValue={5}
              format={(v) => (+v).toFixed(1)}
            />
            <SliderRow
              label="Min Market Cap"
              value={filters.minMarketCap ?? 0}
              onChange={(v) => patch({ minMarketCap: v ?? 0 })}
              min={0} max={500} step={5}
              format={(v) => +v === 0 ? 'Any' : `$${(+v).toFixed(0)}B`}
              allowNull={false}
            />
            <SliderRow
              label="Min Dividend Yield"
              value={filters.minDivYield}
              onChange={(v) => patch({ minDivYield: v })}
              min={0} max={0.10} step={0.005}
              defaultValue={0.02}
              format={(v) => `${((+v) * 100).toFixed(1)}%`}
            />
          </div>

          <div>
            <div className="text-sm mb-2">Sectors</div>
            <div className="flex flex-wrap gap-1.5">
              {allSectors.map(s => {
                const active = filters.sectors.includes(s)
                return (
                  <button
                    key={s}
                    onClick={() => toggleSector(s)}
                    className={`text-xs px-2 py-1 rounded ${
                      active ? 'bg-accent text-black' : 'bg-line text-muted hover:text-white'
                    }`}
                  >{s}</button>
                )
              })}
            </div>
            <div className="mt-3 text-xs text-muted">
              {filters.sectors.length === 0
                ? 'No filter — all sectors shown'
                : `Showing ${filters.sectors.length} of ${allSectors.length} sectors`}
            </div>

            <button
              onClick={clear}
              className="mt-6 text-sm text-warn hover:text-bad flex items-center gap-1 disabled:opacity-40"
              disabled={count === 0}
            >
              <X size={14} /> Clear all filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
