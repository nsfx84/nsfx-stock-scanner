import { useMemo, useState } from 'react'
import { BarChart3, Play } from 'lucide-react'
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ZAxis
} from 'recharts'

import { UNIVERSES } from '../data/universes.js'
import { runBacktest, getBacktestAsOfDate } from '../lib/backtest.js'

const QUINTILES = [
  { label: '0–19', min: 0, max: 19 },
  { label: '20–39', min: 20, max: 39 },
  { label: '40–59', min: 40, max: 59 },
  { label: '60–79', min: 60, max: 79 },
  { label: '80–100', min: 80, max: 100 }
]

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return `${(v * 100).toFixed(1)}%`
}

// Simple text color mapping matching your dark dashboard theme
function returnColor(pct) {
  if (pct == null || Number.isNaN(pct)) return 'text-muted'
  const p = pct * 100
  if (p >= 15) return 'text-accent'
  if (p >= 5) return 'text-emerald-300'
  if (p >= 0) return 'text-warn'
  return 'text-bad'
}

function quintileStats(rows) {
  const rets = rows.map(r => r.return).filter(r => r != null && !Number.isNaN(r))
  if (!rets.length) {
    return { count: 0, avg: null, median: null, std: null, pctPos: null }
  }
  const sorted = [...rets].sort((a, b) => a - b)
  const avg = rets.reduce((a, b) => a + b, 0) / rets.length
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const variance = rets.reduce((a, r) => a + (r - avg) ** 2, 0) / rets.length
  const std = Math.sqrt(variance)
  const pctPos = (rets.filter(r => r > 0).length / rets.length) * 100
  return { count: rets.length, avg, median, std, pctPos }
}

function linearRegression(points) {
  if (points.length < 2) return null
  const n = points.length
  const meanX = points.reduce((a, p) => a + p.x, 0) / n
  const meanY = points.reduce((a, p) => a + p.y, 0) / n
  let num = 0
  let den = 0
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY)
    den += (p.x - meanX) ** 2
  }
  if (den === 0) return null
  const slope = num / den
  const intercept = meanY - slope * meanX
  return { slope, intercept }
}

function verdictForSpread(spreadPct) {
  if (spreadPct > 10) {
    return 'Score appears to have strong signal. Be cautious — this is one window.'
  }
  if (spreadPct > 3) {
    return 'Modest evidence of signal. Treat results with skepticism.'
  }
  if (spreadPct >= -3) {
    return 'No meaningful signal. Score is not differentiating winners from losers in this window.'
  }
  return 'Score is anti-predictive in this window. Either methodology has issues or this regime was unusual.'
}

function UniverseTab({ id, current, onPick, label }) {
  return (
    <button
      type="button"
      onClick={() => onPick(id)}
      className={`px-3 py-1.5 text-sm rounded ${
        current === id ? 'bg-accent text-black' : 'bg-line text-muted hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

export default function Backtest() {
  const asOfDate = useMemo(() => getBacktestAsOfDate(), [])
  const [universe, setUniverse] = useState('sp500')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [output, setOutput] = useState(null)
  const [error, setError] = useState(null)

  const tickers = UNIVERSES[universe]?.tickers || []

  async function start() {
    setRunning(true)
    setError(null)
    setOutput(null)
    setProgress({ completed: 0, total: tickers.length })
    try {
      const out = await runBacktest(tickers, asOfDate, setProgress)
      setOutput(out)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const results = output?.results || []
  const spy = output?.benchmarks?.spy
  const qqq = output?.benchmarks?.qqq

  const topRows = results.filter(r => r.score >= 80)
  const bottomRows = results.filter(r => r.score < 40)
  const topAvg = topRows.length
    ? topRows.reduce((a, r) => a + r.return, 0) / topRows.length
    : null
  const bottomAvg = bottomRows.length
    ? bottomRows.reduce((a, r) => a + r.return, 0) / bottomRows.length
    : null
  const spread = topAvg != null && bottomAvg != null ? (topAvg - bottomAvg) * 100 : null

  const quintileRows = useMemo(() => {
    return QUINTILES.map(q => ({
      ...q,
      ...quintileStats(results.filter(r => r.score >= q.min && r.score <= q.max))
    }))
  }, [results])

  const scatterData = useMemo(
    () =>
      results.map(r => ({
        symbol: r.symbol,
        score: r.score,
        returnPct: r.return * 100
      })),
    [results]
  )

  const trend = useMemo(() => {
    const pts = scatterData.map(d => ({ x: d.score, y: d.returnPct }))
    return linearRegression(pts)
  }, [scatterData])

  const trendLine = useMemo(() => {
    if (!trend) return []
    return [
      { score: 0, returnPct: trend.intercept },
      { score: 100, returnPct: trend.slope * 100 + trend.intercept }
    ]
  }, [trend])

  const spyPct = spy != null ? spy * 100 : null

  const wrongHigh = useMemo(() => {
    if (spy == null) return []
    return results
      .filter(r => r.score >= 70 && r.return < spy)
      .sort((a, b) => a.return - b.return)
      .slice(0, 10)
  }, [results, spy])

  const missedLow = useMemo(() => {
    return results
      .filter(r => r.score < 40 && r.return > 0.1)
      .sort((a, b) => b.return - a.return)
      .slice(0, 10)
  }, [results])

  return (
    <div className="space-y-6">
      <div className="bg-panel border border-line rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={20} className="text-accent" />
          <h2 className="text-xl font-semibold">Score Backtest</h2>
        </div>

        <p className="text-sm text-muted mb-4">
          Testing scores from <span className="font-mono text-white">{asOfDate}</span> to today
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <UniverseTab
            id="sp500"
            current={universe}
            onPick={setUniverse}
            label={`S&P 500 (${UNIVERSES.sp500.tickers.length})`}
          />
          <UniverseTab
            id="nasdaq100"
            current={universe}
            onPick={setUniverse}
            label={`NASDAQ 100 (${UNIVERSES.nasdaq100.tickers.length})`}
          />
        </div>

        <button
          type="button"
          onClick={start}
          disabled={running}
          className="bg-accent text-black px-4 py-2 rounded font-medium flex items-center gap-2 disabled:opacity-40"
        >
          <Play size={16} />
          {running ? 'Running…' : `Run backtest (${tickers.length} stocks)`}
        </button>

        {running && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>
                {progress.completed}/{progress.total}
                {progress.current && ` · ${progress.current}`}
              </span>
              <span>
                {progress.total
                  ? Math.round((progress.completed / progress.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="h-2 bg-line rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{
                  width: progress.total
                    ? `${(progress.completed / progress.total) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-bad">{error}</p>}

        <p className="mt-4 text-xs text-muted leading-relaxed border-t border-line pt-4">
          This backtest uses annual fundamentals filed before each as-of date, daily prices filtered to
          that date for momentum, and today&apos;s index membership (survivorship bias). Historical
          analyst ratings are unavailable, so the Analysts pillar is omitted. Results are one 12-month
          window — not proof of future performance. Look-ahead risk is reduced but not eliminated when
          annual reports are restated or reported with lag.
        </p>
      </div>

      {output && results.length > 0 && (
        <>
          <div className="bg-panel border border-line rounded-xl p-5 space-y-2 text-sm">
            <h3 className="font-semibold text-lg mb-3">Summary</h3>
            <p>
              Top quintile (scores 80+) returned:{' '}
              <span className={`font-mono ${returnColor(topAvg)}`}>{fmtPct(topAvg)}</span>
              <span className="text-muted text-xs ml-1">({topRows.length} stocks)</span>
            </p>
            <p>
              Bottom quintile (scores &lt;40) returned:{' '}
              <span className={`font-mono ${returnColor(bottomAvg)}`}>{fmtPct(bottomAvg)}</span>
              <span className="text-muted text-xs ml-1">({bottomRows.length} stocks)</span>
            </p>
            <p>
              S&P 500 (SPY) returned:{' '}
              <span className={`font-mono ${returnColor(spy)}`}>{fmtPct(spy)}</span>
            </p>
            <p>
              NASDAQ 100 (QQQ) returned:{' '}
              <span className={`font-mono ${returnColor(qqq)}`}>{fmtPct(qqq)}</span>
            </p>
            <p className="font-medium pt-2">
              Score spread (top minus bottom):{' '}
              <span className={`font-mono ${returnColor(spread != null ? spread / 100 : null)}`}>
                {spread != null ? `${spread.toFixed(1)}%` : '—'}
              </span>
              <span className="text-muted font-normal text-xs ml-1">— key metric</span>
            </p>
            {spread != null && (
              <p className="text-muted text-xs border-t border-line pt-3 mt-2">
                {verdictForSpread(spread)}
              </p>
            )}
            {output.failures?.length > 0 && (
              <p className="text-xs text-warn pt-2">
                {output.failures.length} tickers skipped (missing data or API errors).
              </p>
            )}
          </div>

          <div className="bg-panel border border-line rounded-xl p-5 overflow-x-auto">
            <h3 className="font-semibold mb-3">Returns by score quintile</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted uppercase">
                <tr className="border-b border-line">
                  <th className="py-2 text-left">Score range</th>
                  <th className="py-2 text-right"># stocks</th>
                  <th className="py-2 text-right">Avg return</th>
                  <th className="py-2 text-right">Median</th>
                  <th className="py-2 text-right">Std dev</th>
                  <th className="py-2 text-right">% positive</th>
                </tr>
              </thead>
              <tbody>
                {quintileRows.map(q => (
                  <tr key={q.label} className="border-b border-line/40">
                    <td className="py-2 font-mono">{q.label}</td>
                    <td className="py-2 text-right font-mono">{q.count}</td>
                    <td className={`py-2 text-right font-mono ${returnColor(q.avg)}`}>
                      {fmtPct(q.avg)}
                    </td>
                    <td className="py-2 text-right font-mono text-muted">{fmtPct(q.median)}</td>
                    <td className="py-2 text-right font-mono text-muted">
                      {q.std != null ? fmtPct(q.std) : '—'}
                    </td>
                    <td className="py-2 text-right font-mono text-muted">
                      {q.pctPos != null ? `${q.pctPos.toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-panel border border-line rounded-xl p-5">
            <h3 className="font-semibold mb-3">Score vs forward return</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="score"
                    name="Score"
                    domain={[0, 100]}
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    label={{ value: 'Score', position: 'insideBottom', offset: -4, fill: '#9ca3af' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="returnPct"
                    name="Return %"
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    label={{
                      value: '12M return %',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#9ca3af'
                    }}
                  />
                  <ZAxis range={[40, 40]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      
                      // Pull carefully across standard entries or coordinate references
                      const scatterPoint = payload.find(p => p.name === 'Score' || p.dataKey === 'score' || p.payload?.symbol);
                      const p = scatterPoint?.payload;
                      
                      if (!p || !p.symbol) return null
                      return (
                        <div className="rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-lg">
                          <p className="font-mono text-white">
                            {p.symbol} · score {p.score}
                          </p>
                          <p className="text-muted mt-0.5">
                            Return:{' '}
                            <span className="font-mono text-accent">
                              {Number(p.returnPct).toFixed(1)}%
                            </span>
                          </p>
                        </div>
                      )
                    }}
                  />
                  {spyPct != null && (
                    <ReferenceLine
                      y={spyPct}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{ value: 'SPY', fill: '#f59e0b', fontSize: 10 }}
                    />
                  )}
                  <ReferenceLine
                    x={60}
                    stroke="#6b7280"
                    strokeDasharray="4 4"
                    label={{ value: '60', fill: '#9ca3af', fontSize: 10 }}
                  />
                  <Scatter data={scatterData} fill="#10b981" fillOpacity={0.75} />
                  {trendLine.length === 2 && (
                    <Line
                      data={trendLine}
                      type="linear"
                      dataKey="returnPct"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={false}
                      legendType="none"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-panel border border-line rounded-xl p-5 overflow-x-auto">
              <h3 className="font-semibold mb-2 text-sm">High score, weak return</h3>
              <p className="text-xs text-muted mb-3">
                Scored 70+ but underperformed SPY ({fmtPct(spy)})
              </p>
              {wrongHigh.length === 0 ? (
                <p className="text-xs text-muted">None in this window.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-muted uppercase">
                    <tr className="border-b border-line">
                      <th className="py-1 text-left">Ticker</th>
                      <th className="py-1 text-left">Name</th>
                      <th className="py-1 text-left">Sector</th>
                      <th className="py-1 text-right">Score</th>
                      <th className="py-1 text-right">Return</th>
                      <th className="py-1 text-right">S&P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wrongHigh.map(r => (
                      <tr key={r.symbol} className="border-b border-line/30">
                        <td className="py-1.5 font-mono">{r.symbol}</td>
                        <td className="py-1.5 text-muted truncate max-w-[100px]">{r.name || '—'}</td>
                        <td className="py-1.5 text-muted">{r.sector || '—'}</td>
                        <td className="py-1.5 text-right font-mono">{r.score}</td>
                        <td className={`py-1.5 text-right font-mono ${returnColor(r.return)}`}>
                          {fmtPct(r.return)}
                        </td>
                        <td className="py-1.5 text-right font-mono text-muted">{fmtPct(spy)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-panel border border-line rounded-xl p-5 overflow-x-auto">
              <h3 className="font-semibold mb-2 text-sm">Low score, strong return</h3>
              <p className="text-xs text-muted mb-3">Scored &lt;40 but returned &gt;10%</p>
              {missedLow.length === 0 ? (
                <p className="text-xs text-muted">None in this window.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-muted uppercase">
                    <tr className="border-b border-line">
                      <th className="py-1 text-left">Ticker</th>
                      <th className="py-1 text-left">Name</th>
                      <th className="py-1 text-left">Sector</th>
                      <th className="py-1 text-right">Score</th>
                      <th className="py-1 text-right">Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missedLow.map(r => (
                      <tr key={r.symbol} className="border-b border-line/30">
                        <td className="py-1.5 font-mono">{r.symbol}</td>
                        <td className="py-1.5 text-muted truncate max-w-[100px]">{r.name || '—'}</td>
                        <td className="py-1.5 text-muted">{r.sector || '—'}</td>
                        <td className="py-1.5 text-right font-mono">{r.score}</td>
                        <td className={`py-1.5 text-right font-mono ${returnColor(r.return)}`}>
                          {fmtPct(r.return)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}