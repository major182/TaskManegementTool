/**
 * 画面全体の読み込みに失敗したときの表示（05 画面設計書 8.1・9章）。
 *
 * ログイン状態の確認（GET /api/auth/me）が 401 以外で失敗したときに出す。
 * ここでログイン画面を出すと、ログイン済みの人に「ログアウトされた」と
 * 誤解させてしまうため、通信できなかったことをそのまま伝える。
 */
import { TOAST, TOAST_ACTION } from '../messages.ts'
import styles from './LoadFailedScreen.module.css'

export function LoadFailedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.screen} role="alert">
      <p className={styles.message}>{TOAST.loadFailed}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        {TOAST_ACTION.retry}
      </button>
    </div>
  )
}
