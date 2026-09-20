import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import styles from './Toast.module.css'
import { ToastContext, type ShowToast, type ToastAction, type ToastKind } from './toastContext.ts'

type Toast = {
  id: number
  kind: ToastKind
  message: string
  action?: ToastAction
}

/** お知らせが自動で消えるまでの時間（05 11章 No.3） */
const INFO_DURATION_MS = 5000

/**
 * 画面右下のトースト通知（05 画面設計書 8.1）。
 * エラーは利用者が閉じるまで残す。取り逃がすと何が起きたか分からなくなるため。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const show = useCallback<ShowToast>(
    ({ kind, message, action }) => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, kind, message, action }])
      if (kind === 'info') {
        setTimeout(() => dismiss(id), INFO_DURATION_MS)
      }
    },
    [dismiss],
  )

  const value = useMemo(() => show, [show])

  return (
    <ToastContext value={value}>
      {children}
      <div className={styles.container} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${toast.kind === 'error' ? styles.error : styles.info}`}
          >
            <span className={styles.message}>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  dismiss(toast.id)
                  toast.action?.onClick()
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              className={styles.close}
              aria-label="閉じる"
              onClick={() => dismiss(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  )
}
