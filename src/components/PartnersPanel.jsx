import { useEffect, useMemo, useState } from 'react'
import { getManualPartners } from '../data/manualPartners.js'
import { getPartners } from '../lib/yahoo.js'

const CONFIDENCE_STYLES = {
  high: 'text-accent',
  medium: 'text-warn',
  low: 'text-muted'
}

function ConfidenceBadge({ confidence }) {
  const level = String(confidence || 'low').toLowerCase()
  const cls = CONFIDENCE_STYLES[level] || CONFIDENCE_STYLES.low
  return (
    <span className={`text-[10px] uppercase tracking-wide font-medium ${cls}`}>
      {level}
    </span>
  )
}

function groupByRelationship(items) {
  const groups = new Map()
  for (const item of items || []) {
    const rel = item.relationship?.trim() || 'Other'
    if (!groups.has(rel)) groups.set(rel, [])
    groups.get(rel).push(item)
  }
  return [...groups.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })
  )
}

export default function PartnersPanel({ symbol }) {
  const [data, setData] = useState(null)
  const [source, setSource] = useState('none')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setData(null)
      setSource('none')

      const manual = getManualPartners(symbol)
      if (manual) {
        if (!cancelled) {
          setData(manual)
          setSource('manual')
          setLoading(false)
        }
        return
      }

      try {
        const partners = await getPartners(symbol)
        if (!cancelled) {
          setData(partners)
          setSource(partners ? 'ai' : 'none')
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [symbol])

  const groups = useMemo(
    () => groupByRelationship(data?.items),
    [data]
  )

  const hasItems = groups.length > 0
  const revenueConcentration = data?.revenueConcentration || []

  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="text-lg font-semibold mb-1">Partners & Customers</div>
      <div className="text-xs text-muted mb-3">
        Key suppliers, customers, and strategic relationships
      </div>

      {loading && (
        <div className="text-sm text-muted">Loading partners…</div>
      )}

      {error && (
        <div className="text-sm text-warn mb-2">{error}</div>
      )}

      {!loading && !hasItems && !error && (
        <p className="text-sm text-muted">No partners identified for {symbol}.</p>
      )}

      {hasItems && (
        <div className="space-y-5">
          {groups.map(([relationship, items]) => (
            <div key={relationship}>
              <div className="text-xs text-muted uppercase tracking-wide mb-2">
                {relationship}
              </div>
              <ul className="space-y-3">
                {items.map((item, i) => (
                  <li
                    key={`${item.name}-${item.ticker || i}`}
                    className="border-b border-line/50 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-medium text-white">{item.name}</span>
                      {item.ticker && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-line/40 text-muted">
                          {item.ticker}
                        </span>
                      )}
                      <ConfidenceBadge confidence={item.confidence} />
                    </div>
                    {item.context && (
                      <p className="text-sm text-muted">{item.context}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {revenueConcentration.length > 0 && (
        <div className="mt-5 pt-4 border-t border-line">
          <div className="text-xs text-muted uppercase tracking-wide mb-2">
            Revenue concentration
          </div>
          <ul className="space-y-2 text-sm">
            {revenueConcentration.map((row, i) => (
              <li key={`${row.name}-${i}`} className="text-muted">
                <span className="text-white font-medium">{row.name}</span>
                {row.percent != null && (
                  <span className="font-mono ml-2">{row.percent}%</span>
                )}
                {row.context && <span className="ml-2">— {row.context}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-line text-xs text-muted">
        {source === 'manual' && (
          <p>Curated reference data (not live filings).</p>
        )}
        {source === 'ai' && (
          <p>Inferred from Yahoo business summary via Claude. Not verified against SEC filings.</p>
        )}
        {source === 'none' && !loading && (
          <p>Set ANTHROPIC_API_KEY on the server to enable AI extraction.</p>
        )}
      </div>
    </div>
  )
}
