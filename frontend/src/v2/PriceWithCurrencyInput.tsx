import { useState } from 'react'
import {
  DEFAULT_PRICE_CURRENCY,
  normalizePriceCurrency,
  persistPriceAsNok,
  PRICE_CURRENCY_OPTIONS,
} from './priceCurrency'

export function PriceWithCurrencyInput({
  amount,
  currency,
  disabled,
  amountPlaceholder = 'Pris',
  amountTitle,
  amountClassName = 'v2-hop-price',
  compact,
  persistAsNok = true,
  onAmountChange,
  onCurrencyChange,
  onAmountBlur,
  onPersist,
}: {
  amount: string
  currency?: string
  disabled?: boolean
  amountPlaceholder?: string
  amountTitle?: string
  amountClassName?: string
  compact?: boolean
  /** When true (default), foreign amounts are converted to NOK on save. */
  persistAsNok?: boolean
  onAmountChange: (value: string) => void
  onCurrencyChange: (code: string) => void
  onAmountBlur?: () => void
  /** Called after blur when amount is stored (NOK when persistAsNok). */
  onPersist?: (price: string) => void
}) {
  const code = normalizePriceCurrency(currency)
  const [hint, setHint] = useState('')

  async function commitAmount() {
    if (!persistAsNok) {
      onAmountBlur?.()
      onPersist?.(amount.trim())
      return
    }
    const result = await persistPriceAsNok(amount, code)
    if (result === 'empty') {
      setHint('')
      onPersist?.('')
      onAmountBlur?.()
      return
    }
    if (result === 'failed') {
      setHint('Kunne ikke hente kurs — prøv igjen')
      onAmountBlur?.()
      return
    }
    setHint('')
    onAmountChange(result.price)
    onCurrencyChange(DEFAULT_PRICE_CURRENCY)
    onPersist?.(result.price)
    onAmountBlur?.()
  }

  return (
    <span
      className={`v2-price-currency${compact ? ' is-compact' : ''}`}
      title={amountTitle}
    >
      <input
        className={amountClassName}
        inputMode="decimal"
        value={amount}
        disabled={disabled}
        placeholder={amountPlaceholder}
        title={amountTitle}
        onChange={(e) => {
          setHint('')
          onAmountChange(e.target.value)
        }}
        onBlur={() => void commitAmount()}
      />
      <select
        className="v2-price-currency-select"
        value={code}
        disabled={disabled}
        aria-label="Valuta"
        title="Valuta for beløpet — lagres som NOK"
        onChange={(e) => {
          setHint('')
          onCurrencyChange(e.target.value || DEFAULT_PRICE_CURRENCY)
        }}
      >
        {PRICE_CURRENCY_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint ? <span className="v2-price-currency-hint">{hint}</span> : null}
    </span>
  )
}
