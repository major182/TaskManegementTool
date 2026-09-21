/**
 * リストの列1本（05 画面設計書 4.3）。
 * ヘッダーをドラッグして並び替え、名前はその場編集、カードは縦に並ぶ。
 */
import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { InlineAddForm } from '../../components/InlineAddForm.tsx'
import { InlineEdit } from '../../components/InlineEdit.tsx'
import type { Card, TaskList } from '../../api/types.ts'
import { FIELD_ERROR, LIMIT } from '../../messages.ts'
import { CardEditor } from './CardEditor.tsx'
import { CardItem } from './CardItem.tsx'
import type { CardUpdateRequest } from '../../api/endpoints.ts'
import styles from './ListColumn.module.css'

type Props = {
  list: TaskList
  /** 編集中のカード。このリストのカードでなければ null */
  editingCardId: number | null
  onRename: (name: string) => void
  onDelete: () => void
  onCreateCard: (title: string) => void
  onToggleCardDone: (card: Card) => void
  onStartEditCard: (cardId: number) => void
  onCloseEditCard: () => void
  onSaveCard: (cardId: number, values: CardUpdateRequest) => void
  onDeleteCard: (cardId: number) => void
}

export function ListColumn({
  list,
  editingCardId,
  onRename,
  onDelete,
  onCreateCard,
  onToggleCardDone,
  onStartEditCard,
  onCloseEditCard,
  onSaveCard,
  onDeleteCard,
}: Props) {
  const [isAddingCard, setIsAddingCard] = useState(false)

  // attributes（role="button" や tabIndex）は付けない。
  // section の region ロールを奪ってしまううえ、キーボードでのドラッグは
  // バージョン1では対象外と決めているため（05 画面設計書 11章 No.4）
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `list-${list.id}`,
    data: { type: 'list', list },
  })

  return (
    <section
      ref={setNodeRef}
      className={`${styles.list} ${isDragging ? styles.dragging : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={`リスト ${list.name}`}
    >
      {/* 並び替えはヘッダーをつかんで行う（05 画面設計書 4.3 No.3）。
          カードの操作を邪魔しないよう、つかめる場所をヘッダーだけに限っている */}
      <header className={styles.header} {...listeners}>
        <div className={styles.name}>
          <InlineEdit
            value={list.name}
            maxLength={LIMIT.listName}
            label="リスト名"
            onCommit={onRename}
          />
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`リスト ${list.name} を削除`}
          onClick={onDelete}
        >
          ×
        </button>
      </header>

      <div className={styles.cards}>
        <SortableContext
          items={list.cards.map((c) => `card-${c.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {list.cards.map((card) =>
            card.id === editingCardId ? (
              <CardEditor
                key={card.id}
                card={card}
                onSave={(values) => onSaveCard(card.id, values)}
                onClose={onCloseEditCard}
              />
            ) : (
              <CardItem
                key={card.id}
                card={card}
                onToggleDone={() => onToggleCardDone(card)}
                onStartEdit={() => onStartEditCard(card.id)}
                onDelete={() => onDeleteCard(card.id)}
              />
            ),
          )}
        </SortableContext>
      </div>

      <div className={styles.footer}>
        {isAddingCard ? (
          <InlineAddForm
            label="カードのタイトル"
            placeholder="カードのタイトルを入力"
            submitLabel="追加"
            maxLength={LIMIT.cardTitle}
            validate={(value) => (value.trim() === '' ? FIELD_ERROR.cardTitleRequired : undefined)}
            onSubmit={onCreateCard}
            onCancel={() => setIsAddingCard(false)}
            // 続けて追加できるよう入力欄は開いたままにする（05 画面設計書 4.3 No.7）
            keepOpenAfterSubmit
          />
        ) : (
          <button type="button" className={styles.addCard} onClick={() => setIsAddingCard(true)}>
            ＋ カード
          </button>
        )}
      </div>
    </section>
  )
}
