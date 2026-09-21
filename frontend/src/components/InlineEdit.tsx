/**
 * その場編集（05 画面設計書 1章 方針2）。
 * 押すと入力欄に変わり、Enter か欄の外を押すと確定、Esc で取り消す（業務ルール 5.5）。
 *
 * ボード名・リスト名で共通に使う。カードは項目が複数あるため専用の編集部品を別に作る。
 */
import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import styles from './InlineEdit.module.css'
import { validateName } from './InlineEdit.ts'
import { useClickOutside } from './useClickOutside.ts'

type Props = {
  value: string
  maxLength: number
  /** 確定したときに呼ぶ。値が変わっていない場合は呼ばれない */
  onCommit: (next: string) => void
  /** 読み上げ・テストのための名前（例：「ボード名」） */
  label: string
  className?: string
}

export function InlineEdit({ value, maxLength, onCommit, label, className }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | undefined>(undefined)
  // Esc で閉じたあとに blur が走って再確定するのを防ぐための目印
  const cancelled = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const commit = useCallback(() => {
    if (cancelled.current) return

    const trimmed = draft.trim()
    const message = validateName(draft, maxLength)
    if (message) {
      setError(message)
      return
    }
    setIsEditing(false)
    // 1文字も変わっていなければ通信しない（業務ルール 5.5）
    if (trimmed !== value) {
      onCommit(trimmed)
    }
  }, [draft, maxLength, onCommit, value])

  // 画面の関係ないところを押したときも確定して閉じる
  useClickOutside(containerRef, commit, isEditing)

  function startEditing() {
    setDraft(value)
    setError(undefined)
    cancelled.current = false
    setIsEditing(true)
  }

  function cancel() {
    cancelled.current = true
    setError(undefined)
    setIsEditing(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 日本語入力の変換中の Enter は確定ではない（プロトタイプと同じ扱い）
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      commit()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        className={`${styles.display} ${className ?? ''}`}
        // 幅で省略されたときに全文を読めるようにする（05 画面設計書 4.2）
        title={value}
        onClick={startEditing}
      >
        {value}
      </button>
    )
  }

  return (
    <div ref={containerRef}>
      <input
        className={`${styles.input} ${className ?? ''}`}
        type="text"
        aria-label={label}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
