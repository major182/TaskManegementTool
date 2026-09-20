/**
 * 通信エラーを、05 画面設計書 8.1 の「何を出して、どう振る舞うか」に変換する。
 * 画面ごとに if 文を書くと文言がぶれるため、判断はここに集約する。
 */
import { ApiError, NetworkError } from '../api/client.ts'
import { TOAST, TOAST_ACTION } from '../messages.ts'

export type ErrorHandling = {
  kind: 'error' | 'info'
  message: string
  /** 付けるべきボタンの文言。無ければ undefined */
  actionLabel?: string
  /** セッション切れ。画面はログイン画面（S-02）へ戻す */
  sessionExpired: boolean
  /** 404。画面を再読み込みして最新に合わせる */
  shouldReload: boolean
}

/**
 * @param error 捕まえた例外
 * @param operation 'save' は作成・更新・削除など、'load' は読み込み
 */
export function describeError(error: unknown, operation: 'save' | 'load'): ErrorHandling {
  const base = { sessionExpired: false, shouldReload: false } as const

  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return {
          ...base,
          kind: 'error',
          message: TOAST.sessionExpired,
          sessionExpired: true,
        }
      case 403:
        // CSRF トークンの不一致。再読み込みで新しいトークンを取り直してもらう
        return {
          ...base,
          kind: 'error',
          message: TOAST.csrfFailed,
          actionLabel: TOAST_ACTION.reload,
        }
      case 404:
        return {
          ...base,
          kind: 'error',
          message: TOAST.notFound,
          shouldReload: true,
        }
      case 409:
        // 409 の detail はそのまま画面に出せる日本語（04 2.6）
        return {
          ...base,
          kind: 'error',
          message: error.detail ?? TOAST.saveFailed,
        }
      case 400:
        // 入力エラーは本来この関数ではなく入力欄の近くに出す。
        // ここに来るのは画面側のチェック漏れなので、サーバーの文言をそのまま出す
        return {
          ...base,
          kind: 'error',
          message: error.errors[0]?.message ?? error.detail ?? TOAST.saveFailed,
        }
    }
  }

  // NetworkError と 500 系はまとめて「もう一度お試しください」
  if (error instanceof NetworkError || error instanceof ApiError) {
    return operation === 'load'
      ? {
          ...base,
          kind: 'error',
          message: TOAST.loadFailed,
          actionLabel: TOAST_ACTION.reload,
        }
      : {
          ...base,
          kind: 'error',
          message: TOAST.saveFailed,
          actionLabel: TOAST_ACTION.retry,
        }
  }

  return {
    ...base,
    kind: 'error',
    message: operation === 'load' ? TOAST.loadFailed : TOAST.saveFailed,
  }
}
