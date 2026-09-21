/**
 * カードのその場編集（05 画面設計書 4.5）。
 *
 *   タイトルで Enter        → 確定
 *   説明文で Enter          → 改行（確定しない）
 *   「保存」／カードの外    → 確定
 *   Esc ／「取消」          → 変更を破棄
 *   期限日の「×」           → 期限日を空にする（dueDate: null で送る）
 */
import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { useClickOutside } from '../../components/useClickOutside.ts'
import type { CardUpdateRequest } from '../../api/endpoints.ts'
import type { Card } from '../../api/types.ts'
import { LIMIT } from '../../messages.ts'
import styles from './CardEditor.module.css'
import { isUnchanged, toDraft, toRequest, validateDraft, type CardDraft } from './cardEditing.ts'

type Props = {
  card: Card
  /** 確定したとき。内容が変わっていない場合は呼ばれない */
  onSave: (values: CardUpdateRequest) => void
  onClose: () => void
}

export function CardEditor({ card, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<CardDraft>(() => toDraft(card))
  const [error, setError] = useState<string | undefined>(undefined)
  // Esc や「取消」で閉じたあと、blur で再び確定が走るのを防ぐ
  const closing = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const commit = useCallback(() => {
    if (closing.current) return

    const message = validateDraft(draft)
    if (message) {
      setError(message)
      return
    }
    closing.current = true
    // 1文字も変わっていなければ通信しない（05 画面設計書 4.5）
    if (!isUnchanged(draft, card)) {
      onSave(toRequest(draft, card))
    }
    onClose()
  }, [card, draft, onClose, onSave])

  // 画面の関係ないところを押したときも確定して閉じる
  useClickOutside(containerRef, commit)

  function cancel() {
    closing.current = true
    onClose()
  }

  /** カードの外を押したら確定する。中で焦点が移っただけのときは何もしない */
  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    commit()
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 日本語入力の変換確定の Enter は確定ではない
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      commit()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  return (
    // 入れ子の入力欄からの blur と Esc をまとめて受けるための div。
    // キー操作は中の入力欄が受け取るので、この div 自体は焦点を持たない
    <div ref={containerRef} className={styles.editor} onBlur={handleBlur} onKeyDown={handleKeyDown}>
      <input type="checkbox" checked={card.isDone} aria-label={`${card.title} の完了`} readOnly />
      <div className={styles.body}>
        <input
          className={styles.title}
          type="text"
          aria-label="カードのタイトル"
          value={draft.title}
          maxLength={LIMIT.cardTitle}
          autoFocus
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          onKeyDown={handleTitleKeyDown}
        />
        {/* 説明文の Enter は改行。確定させない（業務ルール 5.5） */}
        <textarea
          className={styles.description}
          aria-label="説明文"
          value={draft.description}
          maxLength={LIMIT.cardDescription}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <div className={styles.dueRow}>
          <label htmlFor={`due-${card.id}`}>期限日</label>
          <input
            id={`due-${card.id}`}
            className={styles.dueInput}
            type="date"
            value={draft.dueDate}
            onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
          />
          <button
            type="button"
            className={styles.clearDue}
            aria-label="期限日を消す"
            onClick={() => setDraft({ ...draft, dueDate: '' })}
          >
            ×
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.buttons}>
          <button type="button" className={styles.save} onClick={commit}>
            保存
          </button>
          <button type="button" className={styles.cancel} onClick={cancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
