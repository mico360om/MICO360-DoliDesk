import { describe, expect, it } from 'vitest'
import { toCSV } from './csv.js'

describe('toCSV', () => {
  it('joins headers and rows with CRLF', () => {
    expect(toCSV(['a', 'b'], [['1', '2'], ['3', '4']])).toBe('a,b\r\n1,2\r\n3,4')
  })
  it('quotes values containing comma, quote or newline and doubles quotes', () => {
    expect(toCSV(['x'], [['a,b']])).toBe('x\r\n"a,b"')
    expect(toCSV(['x'], [['he said "hi"']])).toBe('x\r\n"he said ""hi"""')
    expect(toCSV(['x'], [['line1\nline2']])).toBe('x\r\n"line1\nline2"')
  })
  it('renders null/undefined as empty strings', () => {
    expect(toCSV(['a', 'b'], [[null, undefined]])).toBe('a,b\r\n,')
  })
  it('handles an empty row set (headers only)', () => {
    expect(toCSV(['a', 'b'], [])).toBe('a,b')
  })
  it('stringifies numbers', () => {
    expect(toCSV(['n'], [[42]])).toBe('n\r\n42')
  })
})
