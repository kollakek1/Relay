import { describe, expect, it } from 'vitest'
import { csvCell, isFormulaInjection, toCsv } from '@/features/export/server/csv'

describe('CSV formula injection', () => {
  it('flags values a spreadsheet would execute', () => {
    expect(isFormulaInjection('=1+1')).toBe(true)
    expect(isFormulaInjection('+SUM(A1)')).toBe(true)
    expect(isFormulaInjection('-2+3')).toBe(true)
    expect(isFormulaInjection('@SUM(A1)')).toBe(true)
    expect(isFormulaInjection('=HYPERLINK("http://evil","x")')).toBe(true)
    // Leading whitespace / tabs / control characters must not hide a formula.
    expect(isFormulaInjection('   =1+1')).toBe(true)
    expect(isFormulaInjection('\t=1+1')).toBe(true)
    expect(isFormulaInjection('\r=1+1')).toBe(true)
  })

  it('does not flag genuine numbers, dates or ordinary text', () => {
    expect(isFormulaInjection('-42')).toBe(false)
    expect(isFormulaInjection('+3.14')).toBe(false)
    expect(isFormulaInjection('1e6')).toBe(false)
    expect(isFormulaInjection('2026-01-31')).toBe(false)
    expect(isFormulaInjection('2026-01-31T10:00:00Z')).toBe(false)
    expect(isFormulaInjection('Onboarding')).toBe(false)
    expect(isFormulaInjection('-1.5')).toBe(false)
  })

  it('neutralises dangerous cells and preserves numbers and dates', () => {
    expect(csvCell('=1+1')).toBe(`"'=1+1"`)
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
    expect(csvCell('  =1+1')).toBe(`"'  =1+1"`)
    // Numbers and dates are untouched.
    expect(csvCell(-42)).toBe('-42')
    expect(csvCell(3.5)).toBe('3.5')
    expect(csvCell(new Date('2026-01-31T00:00:00.000Z'))).toBe('2026-01-31T00:00:00.000Z')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('escapes structural separators', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
  })

  it('strips control characters that could break a row', () => {
    expect(csvCell('a\u0000b')).toBe('ab')
    expect(csvCell('a\u001fb')).toBe('ab')
  })

  it('serialises a full document with CRLF separators', () => {
    const csv = toCsv(['name', 'value'], [['=evil', 1], ['ok', -5]])
    expect(csv.split('\r\n')).toEqual(['name,value', '"\'=evil",1', 'ok,-5'])
  })
})