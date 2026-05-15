function Stat({ label, value, fmt = (v) => v }) {
  if (value == null || value === 'None' || value === '-' || value === '' || (typeof value === 'number' && isNaN(value))) {
    return (
      <div>
        <div className="text-xs text-muted">{label}</div>
        <div className="text-sm">—</div>
      </div>
    )
  }
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-mono">{fmt(value)}</div>
    </div>
  )
}

function fmtBigNum(v) {
  const n = +v
  if (isNaN(n)) return v
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

function fmtPct(v) {
  const n = +v
  if (isNaN(n)) return v
  return `${(n * 100).toFixed(2)}%`
}

export default function OverviewPanel({ overview }) {
  if (!overview || !overview.Symbol) {
    return <div className="bg-panel border border-line rounded-xl p-5 text-muted">No overview data</div>
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="flex justify-between items-start gap-4 mb-4">
        <div>
          <div className="text-2xl font-bold">{overview.Name}</div>
          <div className="text-sm text-muted">
            {overview.Exchange} : {overview.Symbol}
            {overview.Sector ? ` · ${overview.Sector}` : ''}
            {overview.Industry ? ` · ${overview.Industry}` : ''}
          </div>
          {(overview.Country || overview.Currency) && (
            <div className="text-xs text-muted mt-1">
              {overview.Country}{overview.Currency ? ` · ${overview.Currency}` : ''}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Market Cap</div>
          <div className="text-lg font-mono">{fmtBigNum(overview.MarketCapitalization)}</div>
        </div>
      </div>

      {overview.Description && (
        <div className="text-sm text-gray-300 mb-5 leading-relaxed">
          {overview.Description}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="P/E (TTM)"        value={overview.PERatio} fmt={(v) => (+v).toFixed(2)} />
        <Stat label="Forward P/E"      value={overview.ForwardPE} fmt={(v) => (+v).toFixed(2)} />
        <Stat label="P/B"              value={overview.PriceToBookRatio} fmt={(v) => (+v).toFixed(2)} />
        <Stat label="PEG"              value={overview.PEGRatio} fmt={(v) => (+v).toFixed(2)} />
        <Stat label="EPS (TTM)"        value={overview.EPS} fmt={(v) => `$${(+v).toFixed(2)}`} />
        <Stat label="ROE"              value={overview.ReturnOnEquityTTM} fmt={fmtPct} />
        <Stat label="ROA"              value={overview.ReturnOnAssetsTTM} fmt={fmtPct} />
        <Stat label="Profit Margin"    value={overview.ProfitMargin} fmt={fmtPct} />
        <Stat label="Dividend Yield"   value={overview.DividendYield} fmt={fmtPct} />
        <Stat label="Beta"             value={overview.Beta} fmt={(v) => (+v).toFixed(2)} />
        <Stat label="52W High"         value={overview['52WeekHigh']} fmt={(v) => `$${(+v).toFixed(2)}`} />
        <Stat label="52W Low"          value={overview['52WeekLow']} fmt={(v) => `$${(+v).toFixed(2)}`} />
        <Stat label="Rev (TTM)"        value={overview.RevenueTTM} fmt={fmtBigNum} />
        <Stat label="Rev Growth (YoY)" value={overview.QuarterlyRevenueGrowthYOY} fmt={fmtPct} />
        <Stat label="EPS Growth (YoY)" value={overview.QuarterlyEarningsGrowthYOY} fmt={fmtPct} />
        <Stat label="Analyst Target"   value={overview.AnalystTargetPrice} fmt={(v) => `$${(+v).toFixed(2)}`} />
      </div>
    </div>
  )
}
