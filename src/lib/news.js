// Classify Yahoo Finance headlines as material vs trivial (noise).

const NOISE = [
  /\bwhy\b.+\b(moving|down|up|falling|rising)\b/i,
  /\b(stock|shares)\s+(is|are)\s+(moving|down|up)\b/i,
  /\bwhat to (watch|know)\b/i,
  /\bthings to know\b/i,
  /\bmarket wrap\b/i,
  /\bpre-?market\b/i,
  /\bafter hours\b/i,
  /\btechnical analysis\b/i,
  /\bprice target (raised|lowered)\b/i,
  /\banalyst (says|sees|expects|upgrades|downgrades)\b/i,
  /\b(top|best|worst)\s+\d+\s+stocks\b/i,
  /\bwall street (likes|loves|hates)\b/i,
  /\bshould you (buy|sell)\b/i,
  /\b(is it time to)\b/i,
  /\bvideo:/i,
  /\bwatch now\b/i,
  /\bsponsored\b/i
]

const MATERIAL = [
  /\bearnings\b/i,
  /\b(revenue|profit|loss|eps|guidance|outlook)\b/i,
  /\b(acquisition|merger|buyout|takeover|deal)\b/i,
  /\b(dividend|buyback|repurchase)\b/i,
  /\b(layoff|restructur|bankrupt|default)\b/i,
  /\b(ceo|cfo|executive|resign|appoint)\b/i,
  /\b(fda|trial|approval|patent)\b/i,
  /\b(lawsuit|investigation|sec\b|doj\b|subpoena)\b/i,
  /\b(breach|hack|cyber)\b/i,
  /\b(strike|union)\b/i,
  /\b(ipo|offering|spin-?off)\b/i,
  /\b(recall|halt|suspension)\b/i,
  /\b(forecast|warns|warning|cuts guidance)\b/i,
  /\b(beat|miss)(s|ed)?\s+(estimates|expectations)\b/i
]

/** @returns {'material' | 'trivial'} */
export function classify(item) {
  const title = (item?.title || '').trim()
  if (!title) return 'trivial'
  if (NOISE.some(rx => rx.test(title))) return 'trivial'
  if (MATERIAL.some(rx => rx.test(title))) return 'material'
  // Longer, specific headlines without noise patterns are often substantive
  if (title.length >= 55 && !/\?$/.test(title)) return 'material'
  return 'trivial'
}

export function isMaterialNews(item) {
  return classify(item) === 'material'
}
