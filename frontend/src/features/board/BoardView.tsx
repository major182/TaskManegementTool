/**
 * S-01 の表示エリア：ボードを表示しているとき（05 画面設計書 4.3）。
 * リストとカードのドラッグ＆ドロップもここで受ける。
 */
import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { FullScreenLoader } from '../../components/FullScreenLoader.tsx'
import { InlineAddForm } from '../../components/InlineAddForm.tsx'
import { InlineEdit } from '../../components/InlineEdit.tsx'
import { validateName } from '../../components/InlineEdit.ts'
import type { CardUpdateRequest } from '../../api/endpoints.ts'
import type { BoardDetail, Card } from '../../api/types.ts'
import { EMPTY, LIMIT } from '../../messages.ts'
import styles from './BoardView.module.css'
import { CardContent } from './CardItem.tsx'
import { ListColumn } from './ListColumn.tsx'
import { findCardLocation } from './boardUpdates.ts'
import { parseDragId, resolveCardDrop, resolveListDrop } from './dragAndDrop.ts'

type Props = {
  board: BoardDetail | undefined
  /** ボードの切り替え中。表示エリアだけを読み込み中にする（05 画面設計書 9章） */
  isLoading: boolean
  onRename: (name: string) => void
  onDelete: () => void
  isDeleting: boolean

  onCreateList: (name: string) => void
  onRenameList: (listId: number, name: string) => void
  onDeleteList: (listId: number) => void
  onMoveList: (listId: number, position: number) => void

  onCreateCard: (listId: number, title: string) => void
  onToggleCardDone: (card: Card) => void
  onSaveCard: (cardId: number, values: CardUpdateRequest) => void
  onDeleteCard: (cardId: number) => void
  onMoveCard: (cardId: number, listId: number, position: number) => void
}

export function BoardView({
  board,
  isLoading,
  onRename,
  onDelete,
  isDeleting,
  onCreateList,
  onRenameList,
  onDeleteList,
  onMoveList,
  onCreateCard,
  onToggleCardDone,
  onSaveCard,
  onDeleteCard,
  onMoveCard,
}: Props) {
  const [isAddingList, setIsAddingList] = useState(false)
  // 同時に編集できるのは1枚だけ（業務ルール 5.5）
  const [editingCardId, setEditingCardId] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // 少し動かして初めてドラッグとみなす。
  // こうしないと、カードを押して編集を開く操作がドラッグとして扱われてしまう
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  if (isLoading || !board) {
    return (
      <div className={styles.board}>
        <FullScreenLoader />
      </div>
    )
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    if (!board || !event.over) return

    const active = parseDragId(String(event.active.id))
    const overId = String(event.over.id)
    if (!active) return

    if (active.type === 'list') {
      const drop = resolveListDrop(board, active.id, overId)
      if (drop) onMoveList(drop.listId, drop.position)
      return
    }

    const drop = resolveCardDrop(board, active.id, overId)
    if (drop) onMoveCard(drop.cardId, drop.listId, drop.position)
  }

  const draggingCard = (() => {
    if (!draggingId) return null
    const parsed = parseDragId(draggingId)
    if (!parsed || parsed.type !== 'card') return null
    return findCardLocation(board, parsed.id)?.card ?? null
  })()

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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div className={styles.lists}>
          {board.lists.length === 0 && !isAddingList && (
            <p className={styles.emptyMessage}>{EMPTY.lists}</p>
          )}

          <SortableContext
            items={board.lists.map((l) => `list-${l.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {board.lists.map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                editingCardId={editingCardId}
                onRename={(name) => onRenameList(list.id, name)}
                onDelete={() => onDeleteList(list.id)}
                onCreateCard={(title) => onCreateCard(list.id, title)}
                onToggleCardDone={onToggleCardDone}
                onStartEditCard={setEditingCardId}
                onCloseEditCard={() => setEditingCardId(null)}
                onSaveCard={onSaveCard}
                onDeleteCard={onDeleteCard}
              />
            ))}
          </SortableContext>

          {/* ＋リストを追加は一番右（05 画面設計書 4.3 No.8） */}
          <div className={styles.addList}>
            {isAddingList ? (
              <InlineAddForm
                label="リスト名"
                placeholder="リスト名を入力"
                submitLabel="追加"
                maxLength={LIMIT.listName}
                validate={(value) => validateName(value, LIMIT.listName)}
                onSubmit={onCreateList}
                onCancel={() => setIsAddingList(false)}
              />
            ) : (
              <button
                type="button"
                className={styles.addListButton}
                onClick={() => setIsAddingList(true)}
              >
                ＋ リストを追加
              </button>
            )}
          </div>
        </div>

        {/* ドラッグ中のカードを指先に重ねて出す（dnd-kit の標準的な見せ方） */}
        <DragOverlay>
          {draggingCard && (
            <div className={styles.dragOverlayCard}>
              <CardContent
                card={draggingCard}
                onToggleDone={() => {}}
                onStartEdit={() => {}}
                onDelete={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

/** ボードが1つも無いときの表示エリア */
export function NoBoardView() {
  return <div className={styles.noBoard}>{EMPTY.boards}</div>
}
