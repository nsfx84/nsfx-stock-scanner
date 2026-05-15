const KEY = 'scanner:watchlist'

export function getWatchlist() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] }
  catch { return [] }
}

export function addToWatchlist(symbol, name) {
  const list = getWatchlist()
  if (list.find(x => x.symbol === symbol)) return list
  const next = [...list, { symbol, name, added: Date.now() }]
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function removeFromWatchlist(symbol) {
  const next = getWatchlist().filter(x => x.symbol !== symbol)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function isOnWatchlist(symbol) {
  return getWatchlist().some(x => x.symbol === symbol)
}
