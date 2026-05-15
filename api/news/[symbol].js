import { yahooFinance, wrap } from '../_lib/yahoo.js'

function publishedAtToIso(v) {
  if (v == null) return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString()
  if (typeof v === 'number') {
    const ms = v < 1e12 ? v * 1000 : v
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof v === 'string') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
}

function pickThumbnailUrl(thumbnail) {
  if (!thumbnail) return null
  if (typeof thumbnail === 'string') return thumbnail
  const res = thumbnail.resolutions
  if (!Array.isArray(res) || !res.length) return null
  const sorted = [...res].sort((a, b) => (b.width || 0) - (a.width || 0))
  return sorted[0]?.url || null
}

function mapNewsItem(n) {
  const title = n.title != null ? String(n.title).trim() : ''
  const link = n.link != null ? String(n.link).trim() : ''
  if (!title || !link) return null

  const publishedAt =
    publishedAtToIso(n.providerPublishTime) ??
    publishedAtToIso(n.publishDate) ??
    publishedAtToIso(n.pubDate) ??
    null

  const related = Array.isArray(n.relatedTickers)
    ? n.relatedTickers.map(t => String(t).toUpperCase())
    : []

  return {
    uuid: n.uuid != null ? String(n.uuid) : '',
    title,
    publisher: n.publisher != null ? String(n.publisher) : '',
    link,
    publishedAt,
    thumbnail: pickThumbnailUrl(n.thumbnail),
    relatedTickers: related
  }
}

export default wrap(async (req) => {
  const symbol = (req.query.symbol || '').toString().toUpperCase()
  if (!symbol) throw new Error('Missing symbol')

  try {
    const r = await yahooFinance.search(symbol, {
      quotesCount: 0,
      newsCount: 20,
      enableEnhancedTrivialQuery: true
    })
    const news = (r.news || []).map(mapNewsItem).filter(Boolean)
    return { news }
  } catch {
    return { news: [] }
  }
}, { cacheSeconds: 1800 })
