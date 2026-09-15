/** Shared formatting for currency lines (Live + settings). */

export function formatExchangeAmount(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return ''
  const digits = rate >= 100 ? 0 : rate >= 10 ? 2 : rate >= 1 ? 3 : 4
  return new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(rate)
}

export function foreignUnitLabel(currencyCode: string): string {
  const code = (currencyCode || '').trim().toUpperCase()
  if (code === 'EUR') return 'euro'
  if (!code) return 'enhet'
  return `1 ${code}`
}

/** Unit name for inverse rate (foreign amount per 1 kr). */
export function foreignUnitPerKrLabel(currencyCode: string): string {
  const code = (currencyCode || '').trim().toUpperCase()
  if (code === 'EUR') return 'euro'
  if (!code) return 'enhet'
  return code
}

export function rateFromNok(rateToNok: number): number {
  if (!Number.isFinite(rateToNok) || rateToNok <= 0) return 0
  return 1 / rateToNok
}

export function formatKrPerUnit(
  currencyCode: string,
  rateToNok: number,
  opts?: { custom?: boolean },
): string {
  const rate = formatExchangeAmount(rateToNok)
  if (!rate) return ''
  const unit = foreignUnitLabel(currencyCode)
  const prefix = opts?.custom ? 'din kurs: ' : 'ca. '
  return `${prefix}${rate} kr per ${unit}`
}

export function formatUnitPerKr(currencyCode: string, rateToNok: number): string {
  const inverse = rateFromNok(rateToNok)
  const amount = formatExchangeAmount(inverse)
  if (!amount) return ''
  const unit = foreignUnitPerKrLabel(currencyCode)
  return `ca. ${amount} ${unit} per kr`
}

export function joinCurrencyParts(parts: string[]): string {
  return parts.filter(Boolean).join(' · ')
}
