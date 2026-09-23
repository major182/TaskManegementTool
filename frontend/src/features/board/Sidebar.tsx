/**
 * S-01 のサイドバー（05 画面設計書 4.2）。
 * ボードの切り替え・作成、ゴミ箱への切り替え、ログアウト。
 */
import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  /** 並び替え（F-16）。上から何番目に置くかを渡す */
  onMoveBoard: (boardId: number, position: number) => void
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
  onMoveBoard,
  onLogout,
  isLoggingOut,
}: Props) {
  const [isAdding, setIsAdding] = useState(false)

  // 5px 動かすまでは並び替えとみなさない。押しただけでボードが動くと、
  // 切り替えのつもりが並び替えになってしまうため（05 画面設計書 11章 No.4）
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const to = boards.findIndex((b) => `board-${b.id}` === String(over.id))
    if (to < 0) return

    onMoveBoard(Number(String(active.id).replace('board-', '')), to)
  }

  return (
    <nav className={styles.sidebar} aria-label="ボード">
      <h1 className={styles.title}>タスク管理</h1>
      <div className={styles.label}>ボード</div>

      {boards.length === 0 && !isAdding ? (
        <p className={styles.empty}>{EMPTY.boards}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={boards.map((b) => `board-${b.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <ul className={styles.nav}>
              {boards.map((board) => (
                <BoardNavItem
                  key={board.id}
                  board={board}
                  isActive={!isTrashActive && board.id === activeBoardId}
                  onSelect={() => onSelectBoard(board.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
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

/**
 * サイドバーのボード1行。押すと切り替え、つかんで動かすと並び替え（F-16）。
 *
 * リストの並び替えと違い、行そのものをつかめるようにしている。
 * サイドバーの行は面積が小さく、つかむ場所を分けると押しにくくなるため。
 * 押したつもりが動かないよう、5px 動かすまでは並び替えにしない（上の sensors）。
 */
function BoardNavItem({
  board,
  isActive,
  onSelect,
}: {
  board: BoardSummary
  isActive: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `board-${board.id}`,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? styles.dragging : undefined}
    >
      <button
        type="button"
        className={`${styles.navItem} ${isActive ? styles.active : ''}`}
        // 幅で省略されたときに全文を読めるようにする
        title={board.name}
        aria-current={isActive ? 'page' : undefined}
        onClick={onSelect}
        {...attributes}
        {...listeners}
      >
        {board.name}
      </button>
    </li>
  )
}
