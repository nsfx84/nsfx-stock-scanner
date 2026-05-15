import { wrap } from './_lib/yahoo.js'

export default wrap(async () => {
  return { ok: true, ts: Date.now() }
}, { cacheSeconds: 0 })
