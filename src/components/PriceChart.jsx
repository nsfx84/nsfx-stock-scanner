import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const RANGES = [
  { label: '1M', days: 21 },
  { label: '3M', days: 63 },
  { label: '6M', days: 126 },
  { label: '1Y', days: 252 },
  { label: '2Y', days: 504 },
  { label: '5Y', days: 1260 },
  { label: 'All', days: Infinity }
]

function sma(arr, key, n) {
  const out = []
  for (let i = 0; i < arr.length; i++) {
    if (i < n - 1) { out.push(null); continue }
    let s = 0
    for (let j = i - n + 1; j <= i; j++) s += arr[j][key]
    out.push(s / n)
  }
  return out
}

export default function PriceChart({ points }) {
  const [range, setRange] = useState('5Y')
  const [showSma50, setShowSma50] = useState(true)
  const [showSma200, setShowSma200] = useState(true)

  const data = useMemo(() => {
    if (!points || !points.length) return []
    const days = RANGES.find(r => r.label === range)?.days || 1260
    // Compute SMAs over full series, then slice for display so the SMA
    // at the start of the window isn't distorted by the truncation.
    const sma50  = sma(points, 'close', 50)
    const sma200 = sma(points, 'close', 200)
    const enriched = points.map((p, i) => ({ ...p, sma50: sma50[i], sma200: sma200[i] }))
    const sliced = days === Infinity ? enriched : enriched.slice(-days)
    return sliced
  }, [points, range])

  if (!points || points.length === 0) {
    return <div className="bg-panel border border-line rounded-xl p-5 text-muted">No price data</div>
  }

  const first = data[0]?.close
  const last = data[data.length - 1]?.close
  const change = first ? ((last - first) / first) * 100 : 0
  const positive = change >= 0

  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-sm text-muted">Price ({range})</div>
          <div className="text-2xl font-mono">${last?.toFixed(2)}</div>
          <div className={`text-sm ${positive ? 'text-accent' : 'text-bad'}`}>
            {positive ? '+' : ''}{change.toFixed(2)}% over period
          </div>
        </div>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => setRange(r.label)}
              className={`px-2 py-1 text-xs rounded ${range === r.label ? 'bg-accent text-black' : 'bg-line text-muted hover:text-white'}`}
            >{r.label}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 text-xs mb-2">
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={showSma50} onChange={e => setShowSma50(e.target.checked)} />
          <span className="text-amber-400">SMA50</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={showSma200} onChange={e => setShowSma200(e.target.checked)} />
          <span className="text-sky-400">SMA200</span>
        </label>
      </div>

      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={(d) => d.slice(0, 7)}
              minTickGap={40}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              width={55}
            />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(v) => v ? `$${(+v).toFixed(2)}` : null}
            />
            <Line type="monotone" dataKey="close" stroke="#10b981" dot={false} strokeWidth={2} name="Close" />
            {showSma50  && <Line type="monotone" dataKey="sma50"  stroke="#f59e0b" dot={false} strokeWidth={1} name="SMA50" />}
            {showSma200 && <Line type="monotone" dataKey="sma200" stroke="#38bdf8" dot={false} strokeWidth={1} name="SMA200" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
