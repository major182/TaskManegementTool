/**
 * S-01 の表示エリア：ゴミ箱を表示しているとき（05 画面設計書 4.6）。
 */
import { useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { FullScreenLoader } from '../../components/FullScreenLoader.tsx'
import type { TrashItem } from '../../api/types.ts'
import { CONFIRM, EMPTY } from '../../messages.ts'
import styles from './TrashView.module.css'
import { formatDeletedAt, formatOriginalLocation, trashTypeLabel } from './trashFormat.ts'
import { useEmptyTrash, usePurgeFromTrash, useRestoreFromTrash, useTrashList } from './useTrash.ts'

/** 出している確認ダイアログ。完全に削除する対象か、ゴミ箱を空にするか */
type Confirming = { kind: 'purge'; item: TrashItem } | { kind: 'empty' }

/** 種類ごとに文言を変える（05 画面設計書 7章） */
function purgeMessage(item: TrashItem): string {
  switch (item.type) {
    case 'BOARD':
      return CONFIRM.purgeBoard(item.name)
    case 'LIST':
      return CONFIRM.purgeList(item.name)
    case 'CARD':
      return CONFIRM.purgeCard(item.name)
  }
}

export function TrashView() {
  const trashQuery = useTrashList()
  const restore = useRestoreFromTrash()
  const purge = usePurgeFromTrash()
  const emptyTrash = useEmptyTrash()

  const [confirming, setConfirming] = useState<Confirming | null>(null)

  if (trashQuery.isPending) {
    return (
      <div className={styles.trash}>
        <FullScreenLoader />
      </div>
    )
  }

  const items = trashQuery.data ?? []

  function handleConfirm() {
    if (!confirming) return
    if (confirming.kind === 'empty') {
      emptyTrash.mutate()
    } else {
      purge.mutate({ type: confirming.item.type, id: confirming.item.id })
    }
    setConfirming(null)
  }

  return (
    <div className={styles.trash}>
      <header className={styles.header}>
        <h2 className={styles.title}>ゴミ箱 ({items.length})</h2>
        {/* 0件のときは押せない（05 画面設計書 4.6 No.7） */}
        <button
          type="button"
          className={styles.empty}
          disabled={items.length === 0}
          onClick={() => setConfirming({ kind: 'empty' })}
        >
          ゴミ箱を空にする
        </button>
      </header>

      <div className={styles.content}>
        {items.length === 0 ? (
          <p className={styles.emptyMessage}>{EMPTY.trash}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>種類</th>
                <th>名前</th>
                <th>元の場所</th>
                <th>削除日時</th>
                <th>
                  <span className="sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.type}-${item.id}`}>
                  <td className={styles.typeCell}>{trashTypeLabel(item.type)}</td>
                  <td>{item.name}</td>
                  <td className={styles.locationCell}>
                    {formatOriginalLocation(item.originalLocation)}
                  </td>
                  <td className={styles.dateCell}>{formatDeletedAt(item.deletedAt)}</td>
                  <td className={styles.actions}>
                    <button
                      type="button"
                      className={styles.restore}
                      // 戻せないときは押せない状態にし、理由を title で出す
                      disabled={!item.restorable}
                      title={item.restorable ? undefined : '元の場所がないため戻せません'}
                      onClick={() => restore.mutate({ type: item.type, id: item.id })}
                    >
                      元に戻す
                    </button>
                    {/* 取り消せないので、必ず確認ダイアログを挟む（業務ルール 5.3） */}
                    <button
                      type="button"
                      className={styles.purge}
                      onClick={() => setConfirming({ kind: 'purge', item })}
                    >
                      完全に削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          message={
            confirming.kind === 'empty'
              ? CONFIRM.emptyTrash(items.length)
              : purgeMessage(confirming.item)
          }
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
