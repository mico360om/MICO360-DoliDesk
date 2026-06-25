// Minimal RFC-4180 CSV serialiser. Values containing a comma, quote or
// newline are quoted, and embedded quotes are doubled.
function escape(v) {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function toCSV(headers, rows) {
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) lines.push(row.map(escape).join(','))
  return lines.join('\r\n')
}
