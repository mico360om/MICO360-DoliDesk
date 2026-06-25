// Tiny, dependency-free charts (SVG + CSS). Kept intentionally simple so
// the app ships no charting library.

export const TONE_HEX = {
  green: '#10b981',
  amber: '#f59e0b',
  red: '#f43f5e',
  blue: '#3366ff',
  slate: '#94a3b8',
}

// Donut chart. `segments` = [{ label, value, tone }]. Renders a ring with
// a centred total. Zero-total renders an empty grey ring.
export function Donut({ segments, centerValue, centerLabel, size = 150 }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s, i) => {
              const len = (s.value / total) * c
              const dash = `${len} ${c - len}`
              const circle = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={TONE_HEX[s.tone] || TONE_HEX.slate}
                  strokeWidth={stroke}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              )
              offset += len
              return circle
            })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-800">{centerValue}</span>
        {centerLabel && <span className="text-xs text-slate-400">{centerLabel}</span>}
      </div>
    </div>
  )
}

// Vertical bar chart. `data` = [{ label, value, display }].
export function BarChart({ data, height = 140 }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.round((d.value / max) * (height - 24))
        return (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <div className="text-[10px] font-medium text-slate-400">{d.value > 0 ? d.display : ''}</div>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-brand-500 to-brand-400 transition-all"
              style={{ height: Math.max(d.value > 0 ? 4 : 0, h) }}
              title={`${d.label}: ${d.display}`}
            />
            <div className="text-[10px] text-slate-500">{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// Horizontal bars, e.g. top customers. `items` = [{ label, value, display }].
export function HBars({ items, tone = 'blue' }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-32 shrink-0 truncate text-sm text-slate-600" title={it.label}>
            {it.label}
          </div>
          <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full rounded"
              style={{
                width: `${Math.max(3, (it.value / max) * 100)}%`,
                backgroundColor: TONE_HEX[tone],
              }}
            />
          </div>
          <div className="w-24 shrink-0 text-right text-sm tabular-nums text-slate-700">{it.display}</div>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TONE_HEX[it.tone] || TONE_HEX.slate }} />
          <span className="flex-1 text-slate-600">{it.label}</span>
          <span className="font-medium tabular-nums text-slate-800">{it.value}</span>
        </li>
      ))}
    </ul>
  )
}
