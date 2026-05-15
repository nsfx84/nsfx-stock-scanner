export const DENSITIES = ['compact', 'comfortable', 'spacious']

export const DENSITY_CLASSES = {
  compact:     { card: 'p-3',  text: 'text-xs',  gap: 'gap-2', row: 'py-1' },
  comfortable: { card: 'p-5',  text: 'text-sm',  gap: 'gap-4', row: 'py-2' },
  spacious:    { card: 'p-7',  text: 'text-base', gap: 'gap-6', row: 'py-3' }
}

export function getDensity() {
  try {
    const d = localStorage.getItem('ui:density')
    if (DENSITIES.includes(d)) return d
  } catch {}
  return 'comfortable'
}

export function setDensity(d) {
  if (!DENSITIES.includes(d)) return
  try { localStorage.setItem('ui:density', d) } catch {}
  document.documentElement.dataset.density = d
  window.dispatchEvent(new CustomEvent('density-change', { detail: d }))
}
