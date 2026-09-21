/**
 * ゴミ箱の表示に使う整形（05 画面設計書 4.6）。
 * 通信を含まないので、日本時間への変換のような間違えやすい部分をテストできる。
 */
import type { TrashType } from '../../api/types.ts'

/** 画面に出す種類の名前 */
export function trashTypeLabel(type: TrashType): string {
  switch (type) {
    case 'BOARD':
      return 'ボード'
    case 'LIST':
      return 'リスト'
    case 'CARD':
      return 'カード'
  }
}

/**
 * 削除日時を `M/D HH:mm` にする。
 *
 * サーバーは ISO 8601・UTC で返すので（04 API設計書 2.1）、日本時間に直して表示する。
 * 利用者のパソコンの時計に合わせず日本時間で固定するのは、
 * 設計書が「日本時間に変換して表示する」と定めているため。
 */
export function formatDeletedAt(isoUtc: string): string {
  const date = new Date(isoUtc)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''

  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`
}

/** 「元の場所」。ボードは元の場所を持たないので「―」を出す */
export function formatOriginalLocation(location: string | null): string {
  return location ?? '―'
}
