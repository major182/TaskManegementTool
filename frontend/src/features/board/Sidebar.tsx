/**
 * S-01 のサイドバー（05 画面設計書 4.2）。
 * ボードの切り替え・作成、ゴミ箱への切り替え、ログアウト。
 */
import { useState } from 'react'
import { InlineAddForm } from '../../components/InlineAddForm.tsx'
import { validateName } from '../../components/InlineEdit.ts'
import type { BoardSummary } from '../../api/types.ts'
import { EMPTY, LIMIT } from '../../messages.ts'
import styles from './Sidebar.module.css'

type Props = {
  boards: BoardSummary[]
  /** 表示中のボード。ゴミ箱を見ているときは null */
  activeBoardId: number | null
  /** ゴミ箱を表示中かどうか */
  isTrashActive: boolean
  trashCount: number
  onSelectBoard: (boardId: number) => void
  onSelectTrash: () => void
  onCreateBoard: (name: string) => void
  onLogout: () => void
  isLoggingOut: boolean
}

export function Sidebar({
  boards,
  activeBoardId,
  isTrashActive,
  trashCount,
  onSelectBoard,
  onSelectTrash,
  onCreateBoard,
  onLogout,
  isLoggingOut,
}: Props) {
  const [isAdding, setIsAdding] = useState(false)

  return (
    <nav className={styles.sidebar} aria-label="ボード">
      <h1 className={styles.title}>タスク管理</h1>
      <div className={styles.label}>ボード</div>

      {boards.length === 0 && !isAdding ? (
        <p className={styles.empty}>{EMPTY.boards}</p>
      ) : (
        <ul className={styles.nav}>
          {boards.map((board) => {
            const isActive = !isTrashActive && board.id === activeBoardId
            return (
              <li key={board.id}>
                <button
                  type="button"
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                  // 幅で省略されたときに全文を読めるようにする
                  title={board.name}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onSelectBoard(board.id)}
                >
                  {board.name}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {isAdding ? (
        <div className={styles.addForm}>
          <InlineAddForm
            label="ボード名"
            placeholder="ボード名を入力"
            submitLabel="作成"
            maxLength={LIMIT.boardName}
            validate={(value) => validateName(value, LIMIT.boardName)}
            onSubmit={onCreateBoard}
            onCancel={() => setIsAdding(false)}
          />
        </div>
      ) : (
        <button type="button" className={styles.add} onClick={() => setIsAdding(true)}>
          ＋ ボードを作成
        </button>
      )}

      <button
        type="button"
        className={`${styles.trash} ${isTrashActive ? styles.active : ''}`}
        aria-current={isTrashActive ? 'page' : undefined}
        onClick={onSelectTrash}
      >
        {/* 0件のときも (0) と出す（05 画面設計書 4.2 No.4） */}
        🗑 ゴミ箱 ({trashCount})
      </button>

      <button type="button" className={styles.logout} onClick={onLogout} disabled={isLoggingOut}>
        ログアウト
      </button>
    </nav>
  )
}
