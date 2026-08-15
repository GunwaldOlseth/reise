import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ConfirmDeleteOptions = {
  title: string
  message?: string
  confirmLabel?: string
  checkLabel?: string
}

type AskDelete = (opts: ConfirmDeleteOptions) => Promise<boolean>

const ConfirmDeleteContext = createContext<AskDelete | null>(null)

export function ConfirmDeleteProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<ConfirmDeleteOptions | null>(null)
  const [checked, setChecked] = useState(false)
  const resolveRef = useRef<(ok: boolean) => void>(undefined)

  const ask = useCallback((opts: ConfirmDeleteOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current?.(false)
      resolveRef.current = resolve
      setChecked(false)
      setReq(opts)
    })
  }, [])

  const finish = useCallback((ok: boolean) => {
    resolveRef.current?.(ok)
    resolveRef.current = undefined
    setReq(null)
    setChecked(false)
  }, [])

  useEffect(() => {
    if (!req) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [req, finish])

  return (
    <ConfirmDeleteContext.Provider value={ask}>
      {children}
      {req ? (
        <div
          className="v2-sheet is-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="v2-confirm-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) finish(false)
          }}
        >
          <div className="v2-sheet-panel is-confirm">
            <div className="v2-sheet-head">
              <h2 id="v2-confirm-title">{req.title}</h2>
            </div>
            <p className="v2-meta" style={{ margin: '0 0 0.85rem' }}>
              {req.message || 'Dette kan ikke angres.'}
            </p>
            <label className="v2-check-row">
              <input
                type="checkbox"
                checked={checked}
                autoFocus
                onChange={(e) => setChecked(e.target.checked)}
              />
              {req.checkLabel || 'Ja, slett'}
            </label>
            <div className="v2-sheet-actions">
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => finish(false)}
              >
                Avbryt
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!checked}
                onClick={() => finish(true)}
              >
                {req.confirmLabel || 'Slett'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmDeleteContext.Provider>
  )
}

export function useConfirmDelete(): AskDelete {
  const ask = useContext(ConfirmDeleteContext)
  if (!ask) {
    throw new Error('useConfirmDelete krever ConfirmDeleteProvider')
  }
  return ask
}
