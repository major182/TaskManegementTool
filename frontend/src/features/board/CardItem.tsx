/**
 * カード1枚の表示（05 画面設計書 4.4）。
 * 押すとその場編集に変わる。チェックボックスは編集を開かずに完了を切り替える。
 */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card } from '../../api/types.ts'
import styles from './CardItem.module.css'
import { formatDueDate, isOverdue } from './dueDate.ts'

type Props = {
  card: Card
  onToggleDone: () => void
  onStartEdit: () => void
  onDelete: () => void
}

/** 見た目だけを受け持つ部分。ドラッグ中の重ね表示でも使い回す */
export function CardContent({ card, onToggleDone, onStartEdit, onDelete }: Props) {
  const overdue = isOverdue(card.dueDate, card.isDone)

  return (
    <>
      {/* チェックボックスはその場編集を開かない（05 画面設計書 4.4） */}
      <input
        type="checkbox"
        checked={card.isDone}
        aria-label={`${card.title} の完了`}
        onChange={onToggleDone}
      />
      <button
        type="button"
        className={styles.body}
        aria-label={`${card.title} を編集`}
        onClick={onStartEdit}
      >
        <span className={styles.title}>{card.title}</span>
        {/* 説明文が空のときは行ごと表示しない */}
        {card.description && <span className={styles.description}>{card.description}</span>}
        {/* 期限日が無いときは表示しない */}
        {card.dueDate && (
          <span
            className={`${styles.dueDate} ${overdue ? styles.overdue : ''}`}
            title={card.dueDate}
          >
            🕘 {formatDueDate(card.dueDate)}
          </span>
        )}
      </button>
      <button
        type="button"
        className={styles.delete}
        aria-label={`${card.title} を削除`}
        onClick={onDelete}
      >
        ×
      </button>
    </>
  )
}

export function CardItem(props: Props) {
  const { card } = props
  // attributes を付けるとカード全体が role="button" になり、中のボタンと
  // 入れ子になってしまう。キーボードでのドラッグは対象外なので付けない
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${card.id}`,
    data: { type: 'card', card },
  })

  return (
    <div
      ref={setNodeRef}
      className={`${styles.card} ${card.isDone ? styles.done : ''} ${
        isDragging ? styles.dragging : ''
      }`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...listeners}
    >
      <CardContent {...props} />
    </div>
  )
}
