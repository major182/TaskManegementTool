import { createContext, useContext } from 'react'

/** トーストの種類。エラーは手動で閉じるまで残し、お知らせは5秒で消える（05 11章 No.3 の決定） */
export type ToastKind = 'error' | 'info'

export type ToastAction = {
  label: string
  onClick: () => void
}

export type ShowToast = (toast: { kind: ToastKind; message: string; action?: ToastAction }) => void

export const ToastContext = createContext<ShowToast | null>(null)

/** トーストを出すための関数を得る。ToastProvider の中でだけ使える */
export function useToast(): ShowToast {
  const show = useContext(ToastContext)
  if (show === null) {
    throw new Error('useToast は ToastProvider の中で使ってください')
  }
  return show
}
