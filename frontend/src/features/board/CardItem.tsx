/**
 * カード1枚の表示（05 画面設計書 4.4）。
 * この工程では表示のみ。チェックボックスの切り替えとその場編集は次の工程で作る。
 */
import type { Card } from '../../api/types.ts'
import styles from './CardItem.module.css'
import { formatDueDate, isOverdue } from './dueDate.ts'

export function CardItem({ card }: { card: Card }) {
  const overdue = isOverdue(card.dueDate, card.isDone)

  return (
    <div className={`${styles.card} ${card.isDone ? styles.done : ''}`}>
      <input
        type="checkbox"
        checked={card.isDone}
        aria-label={`${card.title} を完了にする`}
        // 切り替えは次の工程で実装する
        readOnly
      />
      <div className={styles.body}>
        <div className={styles.title}>{card.title}</div>
        {/* 説明文が空のときは行ごと表示しない */}
        {card.description && <p className={styles.description}>{card.description}</p>}
        {/* 期限日が無いときは表示しない */}
        {card.dueDate && (
          <span
            className={`${styles.dueDate} ${overdue ? styles.overdue : ''}`}
            title={card.dueDate}
          >
            🕘 {formatDueDate(card.dueDate)}
          </span>
        )}
      </div>
    </div>
  )
}
