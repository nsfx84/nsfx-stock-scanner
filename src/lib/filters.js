// Filter engine. Given a filter spec and rows, returns matching rows.
//
// Defensive against bad data: every numeric coercion guards against
// NaN, undefined, empty string, "None" strings (Yahoo sometimes returns
// these), and missing fields.

export const FILTER_DEFAULTS = {
  minComposite: 0,
  minRoe: null,
  maxPe: null,
  maxPb: null,
  minMarketCap: 0,
  minDivYield: null,
  sectors: []
}

// Safely coerce to number. Returns null for anything that can't be a real number.
function toNum(x) {
  if (x == null) return null
  if (x === '' || x === 'None' || x === '-') return null
  const n = +x
  return (typeof n === 'number' && isFinite(n)) ? n : null
}

export function applyFilters(rows, filters, { useSectorScore = false } = {}) {
  if (!Array.isArray(rows)) return []
  const f = { ...FILTER_DEFAULTS, ...(filters || {}) }

  return rows.filter(r => {
    try {
      if (!r || r.error) return false

      // Composite
      const compositeRaw = useSectorScore ? (r.sectorComposite ?? r.composite) : r.composite
      const composite = toNum(compositeRaw)
      if (f.minComposite > 0) {
        if (composite == null || composite < f.minComposite) return false
      }

      // ROE
      if (f.minRoe != null) {
        const roe = toNum(r.roe)
        if (roe == null || roe < f.minRoe) return false
      }

      // P/E (max)
      if (f.maxPe != null) {
        const pe = toNum(r.pe)
        if (pe == null || pe <= 0 || pe > f.maxPe) return false
      }

      // P/B (max)
      if (f.maxPb != null) {
        const pb = toNum(r.pb)
        if (pb == null || pb <= 0 || pb > f.maxPb) return false
      }

      // Market cap (min) - filter value is in billions, marketCap data is raw dollars
      if (f.minMarketCap > 0) {
        const mc = toNum(r.marketCap)
        const minDollars = f.minMarketCap * 1e9
        if (mc == null || mc < minDollars) return false
      }

      // Dividend yield (min)
      if (f.minDivYield != null) {
        const dy = toNum(r.divYield)
        if (dy == null || dy < f.minDivYield) return false
      }

      // Sectors
      if (Array.isArray(f.sectors) && f.sectors.length > 0) {
        if (!r.sector || !f.sectors.includes(r.sector)) return false
      }

      return true
    } catch {
      // Any unexpected shape — exclude the row rather than crashing render
      return false
    }
  })
}

export function activeFilterCount(filters) {
  if (!filters) return 0
  let n = 0
  if (filters.minComposite > 0) n++
  if (filters.minRoe != null) n++
  if (filters.maxPe != null) n++
  if (filters.maxPb != null) n++
  if (filters.minMarketCap > 0) n++
  if (filters.minDivYield != null) n++
  if (Array.isArray(filters.sectors) && filters.sectors.length > 0) n++
  return n
}
