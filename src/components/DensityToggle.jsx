import { useEffect, useState } from 'react'
import { Rows3, Rows2, Square } from 'lucide-react'
import { getDensity, setDensity } from '../lib/density.js'

const OPTIONS = [
  { id: 'compact', label: 'Compact', icon: Rows3 },
  { id: 'comfortable', label: 'Comfortable', icon: Rows2 },
  { id: 'spacious', label: 'Spacious', icon: Square }
]

export default function DensityToggle() {
  const [density, setDensityState] = useState(getDensity)

  useEffect(() => {
    document.documentElement.dataset.density = getDensity()
    function onChange(e) {
      setDensityState(e.detail || getDensity())
    }
    window.addEventListener('density-change', onChange)
    return () => window.removeEventListener('density-change', onChange)
  }, [])

  function select(d) {
    setDensity(d)
    setDensityState(d)
  }

  return (
    <div
      className="flex items-center bg-line/30 border border-line rounded-md p-0.5"
      role="group"
      aria-label="Display density"
    >
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => select(id)}
          title={label}
          className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
            density === id
              ? 'bg-accent text-black'
              : 'text-muted hover:text-white'
          }`}
        >
          <Icon size={12} aria-hidden />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
