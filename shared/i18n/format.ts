import type { Locale } from './config'

/**
 * Locale-aware formatting. Every helper takes the locale explicitly so it works
 * identically in server and client components. Dates, numbers, percentages and
 * durations are formatted with `Intl`, so e.g. Russian dates render as
 * "31 дек. 2026 г." without hand-written month tables.
 */

export function formatDateLocale(
  locale: Locale,
  value: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function formatDateTimeLocale(
  locale: Locale,
  value: Date | string | null | undefined
): string {
  return formatDateLocale(locale, value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatNumberLocale(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value)
}

export function formatPercentLocale(locale: Locale, ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined) return '—'
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio)
}

/** Human-friendly duration from milliseconds, localised ("2 d 4 h", "45 s"). */
export function formatDurationLocale(locale: Locale, ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return formatNumberLocale(locale, 0) + 's'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
  ['second', 1000],
]

/** Localised relative time ("3 days ago", "через 2 часа"). */
export function formatRelativeTimeLocale(
  locale: Locale,
  value: Date | string,
  now: Date = new Date()
): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const delta = date.getTime() - now.getTime()
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(delta) >= ms || unit === 'second') {
      return formatter.format(Math.round(delta / ms), unit)
    }
  }
  return formatter.format(0, 'second')
}