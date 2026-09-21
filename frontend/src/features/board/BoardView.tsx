/**
 * S-01 の表示エリア：ボードを表示しているとき（05 画面設計書 4.3）。
 */
import { InlineEdit } from '../../components/InlineEdit.tsx'
import { FullScreenLoader } from '../../components/FullScreenLoader.tsx'
import type { BoardDetail } from '../../api/types.ts'
import { EMPTY, LIMIT } from '../../messages.ts'
import styles from './BoardView.module.css'
import { ListColumn } from './ListColumn.tsx'

type Props = {
  board: BoardDetail | undefined
  /** ボードの切り替え中。表示エリアだけを読み込み中にする（05 画面設計書 9章） */
  isLoading: boolean
  onRename: (name: string) => void
  onDelete: () => void
  isDeleting: boolean
}

export function BoardView({ board, isLoading, onRename, onDelete, isDeleting }: Props) {
  if (isLoading || !board) {
    return (
      <div className={styles.board}>
        <FullScreenLoader />
      </div>
    )
  }

  return (
    <div className={styles.board}>
      <header className={styles.header}>
        <h2 className={styles.name}>
          <InlineEdit
            value={board.name}
            maxLength={LIMIT.boardName}
            label="ボード名"
            onCommit={onRename}
          />
        </h2>
        {/* 確認なしでゴミ箱へ移動する（業務ルール 5.3。取り消せる操作のため） */}
        <button type="button" className={styles.delete} onClick={onDelete} disabled={isDeleting}>
          ボードを削除
        </button>
      </header>

      <div className={styles.lists}>
        {board.lists.length === 0 ? (
          <p className={styles.emptyMessage}>{EMPTY.lists}</p>
        ) : (
          board.lists.map((list) => <ListColumn key={list.id} list={list} />)
        )}
      </div>
    </div>
  )
}

/** ボードが1つも無いときの表示エリア */
export function NoBoardView() {
  return <div className={styles.noBoard}>{EMPTY.boards}</div>
}
