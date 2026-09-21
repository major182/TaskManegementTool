/**
 * その場に現れる入力欄で1件追加する部品。
 * ボード・リスト・カードの作成で共通に使う（05 画面設計書 4.2・4.3）。
 */
import { useCallback, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import styles from './InlineAddForm.module.css'
import { useClickOutside } from './useClickOutside.ts'

type Props = {
  label: string
  placeholder: string
  submitLabel: string
  maxLength: number
  /** 入力チェック。問題があればメッセージを返す */
  validate: (value: string) => string | undefined
  onSubmit: (value: string) => void
  onCancel: () => void
  /**
   * true にすると、追加したあとも入力欄を開いたままにする。
   * カードを続けて追加できるようにするため（05 画面設計書 4.3 No.7）
   */
  keepOpenAfterSubmit?: boolean
}

export function InlineAddForm({
  label,
  placeholder,
  submitLabel,
  maxLength,
  validate,
  onSubmit,
  onCancel,
  keepOpenAfterSubmit = false,
}: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const formRef = useRef<HTMLFormElement>(null)

  // 画面の関係ないところを押したら入力欄を閉じる。
  // 勝手に作ってしまわないよう、入力途中の文字は捨てる
  // （作成するのは「追加」を押したときか Enter のときだけ）
  const close = useCallback(() => onCancel(), [onCancel])
  useClickOutside(formRef, close)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const message = validate(value)
    if (message) {
      setError(message)
      return
    }
    setError(undefined)
    onSubmit(value.trim())
    setValue('')
    if (!keepOpenAfterSubmit) {
      onCancel()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 日本語入力の変換中の Enter は確定ではない
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
      <input
        className={styles.input}
        type="text"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.buttons}>
        <button type="submit" className={styles.submit}>
          {submitLabel}
        </button>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  )
}
