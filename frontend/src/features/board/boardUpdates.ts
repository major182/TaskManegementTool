/**
 * 表示中のボードのデータを、操作後の姿に書き換える関数たち。
 *
 * 通信を含まない純粋な計算に切り出しているのは、
 * 楽観的更新（先に画面を更新する）の中身をテストしやすくするため。
 * どの関数も元のデータを壊さず、新しいデータを返す。
 */
import type { BoardDetail, Card, TaskList } from '../../api/types.ts'

/**
 * サーバーが採番する前の、仮の id。
 * 負の数にしているのは、本物の id（1以上）と決して衝突しないため。
 * 通信が終われば取り直したデータで置き換わる。
 */
export function temporaryId(): number {
  return -Date.now()
}

/** position を 0 から振り直す。並び替えのあと番号が飛ばないようにする */
function renumber<T extends { position: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, position: index }))
}

// ---------- リスト ----------

/** 一番右に追加する（04 API設計書 4.8） */
export function addList(board: BoardDetail, list: TaskList): BoardDetail {
  return { ...board, lists: [...board.lists, list] }
}

export function renameList(board: BoardDetail, listId: number, name: string): BoardDetail {
  return {
    ...board,
    lists: board.lists.map((l) => (l.id === listId ? { ...l, name } : l)),
  }
}

/** ゴミ箱へ移動。中のカードごと消え、残ったリストの position を詰める */
export function removeList(board: BoardDetail, listId: number): BoardDetail {
  return {
    ...board,
    lists: renumber(board.lists.filter((l) => l.id !== listId)),
  }
}

/** 左から position 番目へ動かす（0 が一番左） */
export function moveList(board: BoardDetail, listId: number, position: number): BoardDetail {
  const moving = board.lists.find((l) => l.id === listId)
  if (!moving) return board

  const rest = board.lists.filter((l) => l.id !== listId)
  rest.splice(position, 0, moving)
  return { ...board, lists: renumber(rest) }
}

// ---------- カード ----------

/** リストの一番下に追加する（04 API設計書 4.10） */
export function addCard(board: BoardDetail, listId: number, card: Card): BoardDetail {
  return {
    ...board,
    lists: board.lists.map((l) => (l.id === listId ? { ...l, cards: [...l.cards, card] } : l)),
  }
}

/** タイトル・説明文・期限日・完了の更新（04 API設計書 4.11） */
export function updateCard(
  board: BoardDetail,
  cardId: number,
  changes: Partial<Omit<Card, 'id' | 'position'>>,
): BoardDetail {
  return {
    ...board,
    lists: board.lists.map((l) => ({
      ...l,
      cards: l.cards.map((c) => (c.id === cardId ? { ...c, ...changes } : c)),
    })),
  }
}

export function removeCard(board: BoardDetail, cardId: number): BoardDetail {
  return {
    ...board,
    lists: board.lists.map((l) => ({
      ...l,
      cards: renumber(l.cards.filter((c) => c.id !== cardId)),
    })),
  }
}

/**
 * カードを移動する。同じリスト内の並び替えも、別のリストへの移動も同じ扱い。
 * position は「自分を抜いたあとの並び」に対する位置（04 API設計書 4.12）。
 */
export function moveCard(
  board: BoardDetail,
  cardId: number,
  toListId: number,
  toPosition: number,
): BoardDetail {
  const moving = board.lists.flatMap((l) => l.cards).find((c) => c.id === cardId)
  if (!moving) return board

  return {
    ...board,
    lists: board.lists.map((list) => {
      // まず移動元から抜く
      const without = list.cards.filter((c) => c.id !== cardId)
      if (list.id !== toListId) {
        return { ...list, cards: renumber(without) }
      }
      // 移動先に差し込む
      const next = [...without]
      next.splice(toPosition, 0, moving)
      return { ...list, cards: renumber(next) }
    }),
  }
}

/** カードが今どのリストにいるかを調べる */
export function findCardLocation(
  board: BoardDetail,
  cardId: number,
): { list: TaskList; card: Card; index: number } | null {
  for (const list of board.lists) {
    const index = list.cards.findIndex((c) => c.id === cardId)
    if (index !== -1) {
      return { list, card: list.cards[index]!, index }
    }
  }
  return null
}
