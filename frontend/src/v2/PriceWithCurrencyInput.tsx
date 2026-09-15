import {
  DEFAULT_PRICE_CURRENCY,
  normalizePriceCurrency,
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
  onAmountChange,
  onCurrencyChange,
  onAmountBlur,
}: {
  amount: string
  currency?: string
  disabled?: boolean
  amountPlaceholder?: string
  amountTitle?: string
  amountClassName?: string
  compact?: boolean
  onAmountChange: (value: string) => void
  onCurrencyChange: (code: string) => void
  onAmountBlur?: () => void
}) {
  const code = normalizePriceCurrency(currency)
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
        onChange={(e) => onAmountChange(e.target.value)}
        onBlur={() => onAmountBlur?.()}
      />
      <select
        className="v2-price-currency-select"
        value={code}
        disabled={disabled}
        aria-label="Valuta"
        title="Valuta for beløpet"
        onChange={(e) => onCurrencyChange(e.target.value || DEFAULT_PRICE_CURRENCY)}
      >
        {PRICE_CURRENCY_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.label}
          </option>
        ))}
      </select>
    </span>
  )
}
