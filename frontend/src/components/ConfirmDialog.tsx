/**
 * 確認ダイアログ（05 画面設計書 7章）。
 * 「完全に削除」「ゴミ箱を空にする」のように**取り消せない操作のときだけ**出す。
 * ゴミ箱へ移すだけの削除には出さない（業務ルール 5.3）。
 */
import { useEffect, useRef } from 'react'
import { CONFIRM } from '../messages.ts'
import styles from './ConfirmDialog.module.css'

type Props = {
  /** 表示する文言。7章の表のとおり、操作の種類ごとに呼び出し側で作る */
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    // showModal() を使うと、背景の操作が止まり Esc も効くようになる
    if (!dialog.open) dialog.showModal()
    // 誤って Enter を押しても削除されないよう、最初はキャンセルに焦点を置く
    cancelRef.current?.focus()
  }, [])

  /**
   * ダイアログの外側（背景）を押したときもキャンセルする。
   * <dialog> では背景を押しても dialog 自身が押されたことになるため、
   * 中身の外かどうかで判断する。
   */
  function handleClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onCancel()
  }

  return (
    // 背景を押したらキャンセル。キーボードでは Esc（onCancel）で同じことができる
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      // Esc キーは <dialog> が cancel として知らせてくる
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClick={handleClick}
    >
      <div className={styles.body}>
        <p className={styles.message}>{message}</p>
        <div className={styles.buttons}>
          <button ref={cancelRef} type="button" className={styles.cancel} onClick={onCancel}>
            {CONFIRM.cancelLabel}
          </button>
          <button type="button" className={styles.execute} onClick={onConfirm}>
            {CONFIRM.executeLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
