/**
 * 通信に失敗したときの知らせ方を1か所にまとめたもの（05 画面設計書 8.1）。
 *
 * 操作ごとに書くと必ずどこかで書き漏れる（実際に、ボードの作成・削除では
 * トーストが出ず、401 でもログイン画面へ戻らない不具合になっていた）。
 * 画面・フックはこのフックを呼ぶだけにする。
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { describeError } from './errorHandling.ts'
import { TOAST_ACTION } from '../messages.ts'
import { useToast } from '../components/toastContext.ts'
import { useSessionExpiredHandler } from '../features/auth/useAuth.ts'

type NotifyOptions = {
  /** 'save' は作成・更新・削除など、'load' は読み込み */
  operation: 'save' | 'load'
  /**
   * [再試行] を押したときにやり直す処理。
   * 渡さないと、押しても同じことが起きないので [再試行] は出さない
   */
  onRetry?: () => void
}

export function useApiErrorNotifier() {
  const showToast = useToast()
  const onSessionExpired = useSessionExpiredHandler()
  const queryClient = useQueryClient()

  // 読み込みエラーの通知は useEffect から呼ぶため、
  // 毎回中身が変わると effect が動き続けてしまう。useCallback で同じものを返す
  return useCallback(
    (error: unknown, { operation, onRetry }: NotifyOptions) => {
      const handling = describeError(error, operation)

      // 401：ログイン画面（S-02）へ戻す（業務ルール 5.6）
      if (handling.sessionExpired) {
        onSessionExpired()
        return
      }

      // 404：他の人が消したなど、画面が古い。取り直して最新に合わせる（05 8.1）
      if (handling.shouldReload) {
        void queryClient.invalidateQueries()
      }

      showToast({
        kind: handling.kind,
        message: handling.message,
        action: buildAction(handling.actionLabel, onRetry),
      })
    },
    [showToast, onSessionExpired, queryClient],
  )
}

/**
 * [再試行] は同じ操作をやり直す。[再読み込み] はページを読み込み直す。
 * 以前は [再試行] でもページを読み込み直していて、文言と動きが食い違っていた
 */
function buildAction(label: string | undefined, onRetry?: () => void) {
  if (label === undefined) return undefined
  if (label === TOAST_ACTION.retry) {
    return onRetry ? { label, onClick: onRetry } : undefined
  }
  return { label, onClick: () => location.reload() }
}
