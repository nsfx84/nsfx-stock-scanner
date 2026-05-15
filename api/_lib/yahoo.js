// Shared Yahoo Finance client + helpers for all serverless functions.
//
// Vercel runs each function in its own ephemeral container, but Node's
// module cache means this file is re-evaluated once per cold start and
// reused across invocations on the same container.

import YahooFinance from 'yahoo-finance2'

// Single instance; Yahoo's startup notice silenced.
export const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

// CORS headers — since the React app and the API share the same Vercel
// domain in production these are mostly belt-and-braces, but useful for
// local development if you ever hit them from another origin.
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// Cache responses at the CDN edge. Vercel honours Cache-Control headers
// and serves repeats from edge nodes for free — equivalent to the
// in-memory cache we had in the old server.
export function setCacheHeaders(res, seconds) {
  // s-maxage = how long the CDN may cache the response
  // stale-while-revalidate = serve stale up to this long while fetching fresh
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

// Wrap a handler with error handling + CORS preflight support.
export function wrap(handler, { cacheSeconds = 3600 } = {}) {
  return async (req, res) => {
    setCors(res)
    if (req.method === 'OPTIONS') { res.status(200).end(); return }
    try {
      const data = await handler(req, res)
      setCacheHeaders(res, cacheSeconds)
      res.status(200).json(data)
    } catch (err) {
      console.error(`[${req.url}]`, err.message)
      res.status(500).json({ error: err.message })
    }
  }
}
