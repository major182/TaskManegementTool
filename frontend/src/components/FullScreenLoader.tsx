import { useEffect, useState } from 'react'
import { LOADING } from '../messages.ts'
import styles from './FullScreenLoader.module.css'

/** この時間を超えたら、待たせている理由を追加で伝える（05 画面設計書 9章） */
const SLOW_THRESHOLD_MS = 10_000

/**
 * 画面全体の読み込み中表示。
 * 公開先（Render の無料プラン）はスリープ明けの初回アクセスに数十秒かかるため、
 * 10秒を超えたら「サーバーの起動を待っています」を足して、故障ではないと伝える。
 */
export function FullScreenLoader() {
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_THRESHOLD_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <div className={styles.spinner} />
      <span className="sr-only">読み込み中</span>
      {isSlow && <p className={styles.note}>{LOADING.serverWakingUp}</p>}
    </div>
  )
}
