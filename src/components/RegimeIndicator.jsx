import { useEffect, useState } from 'react'
import { getRegime } from '../lib/yahoo.js'

const BADGE = {
  growth: {
    className: 'bg-purple-500/20 text-purple-300',
    label: 'Growth-favoured'
  },
  value: {
    className: 'bg-emerald-500/20 text-accent',
    label: 'Value-favoured'
  },
  neutral: {
    className: 'bg-line text-muted',
    label: 'Neutral'
  },
  'risk-off': {
    className: 'bg-bad/20 text-bad',
    label: 'Risk-off'
  }
}

const MESSAGES = {
  growth:
    'Growth/momentum stocks outperforming. Your screener\'s value/quality bias may underperform this regime.',
  value:
    'Value/quality outperforming. Your screener should perform well in this regime.',
  neutral:
    'No strong factor preference. Screener results are roughly comparable to broad market.',
  'risk-off':
    'Defensive positioning rewarded. Watch for quality stocks holding up better.'
}

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

function barPosition(growthVsValue) {
  if (growthVsValue == null || Number.isNaN(growthVsValue)) return 50
  const clamped = Math.max(-15, Math.min(15, growthVsValue))
  return ((clamped + 15) / 30) * 100
}

export default function RegimeIndicator() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const r = await getRegime()
        if (!cancelled) setData(r)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const regime = data?.regime || 'neutral'
  const badge = BADGE[regime] || BADGE.neutral

  const qqq = data?.growth?.etfs?.QQQ
  const vug = data?.growth?.etfs?.VUG
  const vtv = data?.value?.etfs?.VTV
  const spy = data?.spy

  return (
    <div className="bg-panel border border-line rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-sm font-semibold">Market Regime</h2>
        {loading ? (
          <span className="text-xs text-muted font-mono">Loading…</span>
        ) : (
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>

      {loading && (
        <p className="text-xs text-muted">Fetching factor regime data…</p>
      )}

      {!loading && data && (
        <>
          <div className="mb-4">
            <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted mb-1.5">
              <span>Value</span>
              <span>Growth</span>
            </div>
            <div className="relative h-2 bg-line rounded-full">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-line/80" aria-hidden />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-accent border-2 border-panel shadow"
                style={{ left: `calc(${barPosition(data.growthVsValue)}% - 6px)` }}
                title={
                  data.growthVsValue != null
                    ? `Growth vs value: ${fmtPct(data.growthVsValue)}`
                    : 'Neutral'
                }
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted mt-1 font-mono">
              <span>-15%</span>
              <span>0</span>
              <span>+15%</span>
            </div>
          </div>

          <p className="text-xs text-muted leading-relaxed mb-3">
            {MESSAGES[regime]}
          </p>

          <p className="text-[11px] font-mono text-muted">
            QQQ: {fmtPct(qqq)} · SPY: {fmtPct(spy)} · VTV: {fmtPct(vtv)} · VUG: {fmtPct(vug)}
          </p>
        </>
      )}

      {!loading && !data && (
        <p className="text-xs text-muted">Regime data unavailable.</p>
      )}
    </div>
  )
}
