import {
  useEffect,
  useRef,
  type InputHTMLAttributes,
} from 'react'
import {
  commitClockTimeInput,
  formatClockTimeInput,
  normalizeClockTime,
  normalizeCompleteClockTime,
} from '../api'

/** One physical mouse notch (~100px) = one hour or one minute. */
const WHEEL_PX = 100

function hhmm(raw: string): string {
  const n = normalizeClockTime(raw)
  return /^\d{2}:\d{2}$/.test(n) ? n : ''
}

function parseClock(raw: string): { h: number; min: number } | null {
  const n = hhmm(raw)
  if (!n) return null
  return { h: Number(n.slice(0, 2)), min: Number(n.slice(3, 5)) }
}

function formatClock(h: number, min: number): string {
  const hh = ((h % 24) + 24) % 24
  const mm = ((min % 60) + 60) % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function addClock(raw: string, dh: number, dm: number): string {
  const cur = parseClock(raw) ?? { h: 0, min: 0 }
  let total = cur.h * 60 + cur.min + dh * 60 + dm
  total = ((total % 1440) + 1440) % 1440
  return formatClock(Math.floor(total / 60), total % 60)
}

function wheelPixels(e: WheelEvent): number {
  if (e.deltaMode === 1) return e.deltaY * 16
  if (e.deltaMode === 2) return Math.sign(e.deltaY) * WHEEL_PX
  return e.deltaY
}

function targetsHours(el: HTMLInputElement, clientX: number): boolean {
  const pos = el.selectionStart
  const end = el.selectionEnd
  if (document.activeElement === el && pos != null && end != null) {
    if (pos !== end) return pos <= 2
    if (el.value.includes(':')) return pos <= 2
  }
  const rect = el.getBoundingClientRect()
  return clientX < rect.left + rect.width / 2
}

function useClockWheel(
  value: string,
  onChange: (value: string) => void,
  disabled?: boolean,
) {
  const ref = useRef<HTMLInputElement>(null)
  const acc = useRef(0)
  const resetTimer = useRef(0)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  onChangeRef.current = onChange
  valueRef.current = value

  useEffect(() => {
    const el = ref.current
    if (!el || disabled) return

    const onWheel = (e: WheelEvent) => {
      if (el.disabled || document.activeElement !== el) return
      e.preventDefault()
      window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => {
        acc.current = 0
      }, 160)

      acc.current += wheelPixels(e)
      const steps = Math.trunc(acc.current / WHEEL_PX)
      if (!steps) return
      acc.current -= steps * WHEEL_PX

      const hours = targetsHours(el, e.clientX)
      const next = hours
        ? addClock(el.value || valueRef.current, -steps, 0)
        : addClock(el.value || valueRef.current, 0, -steps)
      onChangeRef.current(next)

      requestAnimationFrame(() => {
        if (hours) el.setSelectionRange(0, 2)
        else el.setSelectionRange(3, 5)
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.clearTimeout(resetTimer.current)
    }
  }, [disabled])

  return ref
}

function isCompleteClock(raw: string): boolean {
  return /^\d{2}:\d{2}$/.test(normalizeCompleteClockTime(raw))
}

function focusNextField(from: HTMLInputElement) {
  const root =
    from.closest(
      '.v2-hop-opt-fields, .v2-hop-opt, .v2-activity-body, .v2-cruise-form, .v2-sheet, form',
    ) || document
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea:not([disabled]), select:not([disabled])',
    ),
  ).filter((el) => {
    if (el.tabIndex < 0) return false
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
  const next = nodes[nodes.indexOf(from) + 1]
  if (!next) return
  next.focus()
  if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
    next.select()
  }
}

/** 24-hour clock (HH:mm). Type "1800" → "18:00". Scroll to nudge. */
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
  const wheelRef = useClockWheel(value, onChange, rest.disabled)
  const cls = ['v2-clock-input', className].filter(Boolean).join(' ')
  const wheelTitle =
    rest.title || 'Rull: venstre = time, høyre = minutt. 24-timers klokke.'

  return (
    <input
      {...rest}
      ref={wheelRef}
      className={cls}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      lang="nb-NO"
      title={wheelTitle}
      placeholder={rest.placeholder || 'tt:mm'}
      value={value}
      onChange={(e) => {
        const next = formatClockTimeInput(e.target.value)
        const finished = isCompleteClock(next)
        const wasFinished = isCompleteClock(value)
        onChange(next)
        if (finished && !wasFinished) {
          requestAnimationFrame(() => {
            const el = wheelRef.current
            if (el) focusNextField(el)
          })
        }
      }}
      onBlur={(e) => {
        const next = commitClockTimeInput(e.target.value)
        if (next !== e.target.value) onChange(next)
        onBlur?.(e)
      }}
    />
  )
}
