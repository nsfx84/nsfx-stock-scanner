export default function Sparkline({ data, width = 80, height = 24, strokeWidth = 1.5 }) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden />
  }

  const n = data.length
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min

  const points = data.map((value, i) => {
    const x = (i / (n - 1)) * width
    const y = range === 0 ? height / 2 : height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const color = data[n - 1] > data[0] ? '#10b981' : '#ef4444'
  const lastX = width
  const lastY = range === 0
    ? height / 2
    : height - ((data[n - 1] - min) / range) * height

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={1.5} fill={color} />
    </svg>
  )
}
