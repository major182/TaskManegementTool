/**
 * ドラッグ＆ドロップで「何を、どこへ動かすか」を決める計算（05 画面設計書 4.3）。
 *
 * dnd-kit は「どの要素の上で離したか」しか教えてくれないので、
 * そこから API に送る listId と position を求める。通信を含まないのでテストできる。
 */
import type { BoardDetail } from '../../api/types.ts'
import { findCardLocation } from './boardUpdates.ts'

/** dnd-kit に渡す id は文字列なので、種類と数値の id に戻す */
export function parseDragId(id: string): { type: 'card' | 'list'; id: number } | null {
  const match = /^(card|list)-(-?\d+)$/.exec(id)
  if (!match) return null
  return { type: match[1] as 'card' | 'list', id: Number(match[2]) }
}

export type CardDrop = {
  cardId: number
  listId: number
  position: number
}

/**
 * カードを離したときの移動先を求める。
 *
 * @param overId 離した場所の id。カードの上（`card-8`）か、リストの上（`list-3`）
 * @returns 動かす必要がなければ null
 */
export function resolveCardDrop(
  board: BoardDetail,
  activeCardId: number,
  overId: string,
): CardDrop | null {
  const from = findCardLocation(board, activeCardId)
  if (!from) return null

  const over = parseDragId(overId)
  if (!over) return null

  if (over.type === 'list') {
    // 空のリストなど、リストそのものの上で離した場合は一番下に入れる
    const target = board.lists.find((l) => l.id === over.id)
    if (!target) return null
    if (target.id === from.list.id) return null

    return { cardId: activeCardId, listId: target.id, position: target.cards.length }
  }

  // カードの上で離した場合は、そのカードの位置に入れる
  const to = findCardLocation(board, over.id)
  if (!to) return null
  if (to.card.id === activeCardId) return null

  // position は「自分を抜いたあとの並び」に対する位置（04 API設計書 4.12）。
  // 同じリスト内で下へ動かすときは、自分を抜いた分だけ1つ前になる
  const sameList = to.list.id === from.list.id
  const position = sameList && from.index < to.index ? to.index - 1 : to.index

  if (sameList && position === from.index) return null

  return { cardId: activeCardId, listId: to.list.id, position }
}

/**
 * リストを離したときの移動先（左から何番目か）を求める。
 * @returns 動かす必要がなければ null
 */
export function resolveListDrop(
  board: BoardDetail,
  activeListId: number,
  overId: string,
): { listId: number; position: number } | null {
  const over = parseDragId(overId)
  if (!over || over.type !== 'list') return null

  const fromIndex = board.lists.findIndex((l) => l.id === activeListId)
  const toIndex = board.lists.findIndex((l) => l.id === over.id)
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return null

  return { listId: activeListId, position: toIndex }
}
