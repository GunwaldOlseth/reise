import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { normalizeClockTime } from '../api'

const CLOCK_MQ = '(max-width: 720px), (pointer: coarse)'

function useNativeClock() {
  const [native, setNative] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(CLOCK_MQ).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(CLOCK_MQ)
    const sync = () => setNative(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return native
}

function hhmm(raw: string): string {
  const n = normalizeClockTime(raw)
  return /^\d{2}:\d{2}$/.test(n) ? n : ''
}

/** Desktop: type "1800" → "18:00". Mobile: native clock picker. */
export function ClockTimeInput({
  value,
  onChange,
  onBlur,
  className,
  ...rest
}: {
  value: string
  onChange: (value: string) => void
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
>) {
  const native = useNativeClock()
  const cls = ['v2-clock-input', className].filter(Boolean).join(' ')

  function commit(raw: string) {
    const next = normalizeClockTime(raw)
    if (next !== raw) onChange(next)
  }

  function openPicker(el: HTMLInputElement) {
    if (typeof el.showPicker !== 'function') return
    try {
      el.showPicker()
    } catch {
      /* already open, or browser blocked it */
    }
  }

  if (native) {
    return (
      <input
        {...rest}
        className={cls}
        type="time"
        step={60}
        value={hhmm(value)}
        aria-label={
          rest['aria-label'] ||
          (typeof rest.placeholder === 'string' ? rest.placeholder : undefined)
        }
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onClick={(e) => openPicker(e.currentTarget)}
      />
    )
  }

  return (
    <input
      {...rest}
      className={cls}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(e) => {
        const raw = e.target.value
        onChange(raw)
        if (/^\d{4}$/.test(raw.trim())) {
          const next = normalizeClockTime(raw)
          if (next !== raw) onChange(next)
        }
      }}
      onBlur={(e) => {
        commit(e.target.value)
        onBlur?.(e)
      }}
    />
  )
}
