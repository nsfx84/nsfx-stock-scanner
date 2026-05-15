import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

function scoreColor(s) {
  if (s == null) return 'text-muted'
  if (s >= 75) return 'text-accent'
  if (s >= 60) return 'text-emerald-300'
  if (s >= 45) return 'text-warn'
  if (s >= 30) return 'text-orange-400'
  return 'text-bad'
}

function barColor(s) {
  if (s == null) return 'bg-line'
  if (s >= 75) return 'bg-accent'
  if (s >= 60) return 'bg-emerald-400'
  if (s >= 45) return 'bg-warn'
  if (s >= 30) return 'bg-orange-500'
  return 'bg-bad'
}

function PillarRow({ p }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-line first:border-t-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3 hover:bg-line/30 px-1"
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="w-28 text-left">
            <div className="text-sm">{p.label}</div>
            <div className="text-xs text-muted">{Math.round(p.weight * 100)}% weight</div>
          </div>
          <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor(p.score)}`}
              style={{ width: p.score != null ? `${p.score}%` : '0%' }}
            />
          </div>
          <div className={`w-12 text-right font-mono ${scoreColor(p.score)}`}>
            {p.score ?? '—'}
          </div>
        </div>
        {open ? <ChevronUp size={16} className="ml-2 text-muted" /> : <ChevronDown size={16} className="ml-2 text-muted" />}
      </button>
      {open && (
        <div className="pb-3 px-1 space-y-1">
          {p.metrics.length === 0 && (
            <div className="text-xs text-muted">No data available for this pillar.</div>
          )}
          {p.metrics.map((m, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 bg-line/30 rounded">
              <div className="flex-1">
                <div>{m.name}</div>
                {m.note && <div className="text-xs text-muted">{m.note}</div>}
              </div>
              <div className="font-mono text-muted mr-3 w-24 text-right">{m.value}</div>
              <div className={`font-mono w-10 text-right ${scoreColor(m.score)}`}>
                {m.score != null ? Math.round(m.score) : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ScoreCard({ result }) {
  if (!result) return null
  const { composite, pillars, verdict, coverage } = result
  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm text-muted uppercase tracking-wide">Composite Score</div>
          <div className={`text-5xl font-bold ${scoreColor(composite)}`}>{composite ?? '—'}</div>
          <div className={`text-sm mt-1 ${
            verdict.tone === 'accent' ? 'text-accent' :
            verdict.tone === 'warn'   ? 'text-warn' :
            verdict.tone === 'bad'    ? 'text-bad'  : 'text-muted'
          }`}>{verdict.label}</div>
        </div>
        <div className="text-right text-xs text-muted">
          Data coverage: {Math.round(coverage * 100)}%
          <div className="text-[10px] mt-1 max-w-[180px]">
            Educational tool only. Not investment advice.
          </div>
        </div>
      </div>
      <div className="mt-4">
        {pillars.map(p => <PillarRow key={p.key} p={p} />)}
      </div>
    </div>
  )
}
