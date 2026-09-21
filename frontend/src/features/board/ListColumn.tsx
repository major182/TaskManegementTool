/**
 * リストの列1本（05 画面設計書 4.3）。
 * この工程では表示のみ。名前の変更・削除・カード追加・並び替えは次の工程で作る。
 */
import type { TaskList } from '../../api/types.ts'
import { CardItem } from './CardItem.tsx'
import styles from './ListColumn.module.css'

export function ListColumn({ list }: { list: TaskList }) {
  return (
    <section className={styles.list} aria-label={`リスト ${list.name}`}>
      <header className={styles.header}>
        <h3 className={styles.name}>{list.name}</h3>
      </header>
      <div className={styles.cards}>
        {list.cards.map((card) => (
          <CardItem key={card.id} card={card} />
        ))}
      </div>
    </section>
  )
}
