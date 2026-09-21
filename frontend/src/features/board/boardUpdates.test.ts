import { describe, expect, it } from 'vitest'
import type { BoardDetail } from '../../api/types.ts'
import {
  addCard,
  addList,
  findCardLocation,
  moveCard,
  moveList,
  removeCard,
  removeList,
  renameList,
  updateCard,
} from './boardUpdates.ts'

function card(id: number, position: number) {
  return {
    id,
    title: `カード${id}`,
    description: null,
    dueDate: null,
    isDone: false,
    position,
  }
}

function board(): BoardDetail {
  return {
    id: 1,
    name: '学習計画',
    lists: [
      { id: 10, name: 'TODO', position: 0, cards: [card(1, 0), card(2, 1)] },
      { id: 20, name: 'DOING', position: 1, cards: [card(3, 0)] },
      { id: 30, name: 'DONE', position: 2, cards: [] },
    ],
  }
}

/** 見やすくするための取り出し */
const listIds = (b: BoardDetail) => b.lists.map((l) => l.id)
const positions = (b: BoardDetail) => b.lists.map((l) => l.position)
const cardIds = (b: BoardDetail, listId: number) =>
  b.lists.find((l) => l.id === listId)!.cards.map((c) => c.id)

describe('リストの書き換え', () => {
  it('追加は一番右に入る', () => {
    const next = addList(board(), {
      id: 40,
      name: 'ICEBOX',
      position: 3,
      cards: [],
    })
    expect(listIds(next)).toEqual([10, 20, 30, 40])
  })

  it('名前を変えても並びは変わらない', () => {
    const next = renameList(board(), 20, '作業中')
    expect(next.lists[1]!.name).toBe('作業中')
    expect(listIds(next)).toEqual([10, 20, 30])
  })

  it('削除すると残ったリストの position が詰まる', () => {
    const next = removeList(board(), 10)
    expect(listIds(next)).toEqual([20, 30])
    expect(positions(next)).toEqual([0, 1])
  })

  it('一番右のリストを一番左へ動かす', () => {
    const next = moveList(board(), 30, 0)
    expect(listIds(next)).toEqual([30, 10, 20])
    expect(positions(next)).toEqual([0, 1, 2])
  })

  it('真ん中へ動かす', () => {
    const next = moveList(board(), 10, 1)
    expect(listIds(next)).toEqual([20, 10, 30])
  })

  it('元のデータは書き換えない', () => {
    const original = board()
    moveList(original, 30, 0)
    expect(listIds(original)).toEqual([10, 20, 30])
  })
})

describe('カードの書き換え', () => {
  it('追加はリストの一番下に入る', () => {
    const next = addCard(board(), 10, card(9, 2))
    expect(cardIds(next, 10)).toEqual([1, 2, 9])
  })

  it('4項目の更新ができる', () => {
    const next = updateCard(board(), 1, {
      title: '要件定義を書く',
      description: '01〜01-5',
      dueDate: '2026-09-30',
      isDone: true,
    })
    const updated = next.lists[0]!.cards[0]!
    expect(updated).toMatchObject({
      title: '要件定義を書く',
      description: '01〜01-5',
      dueDate: '2026-09-30',
      isDone: true,
    })
  })

  it('期限日を null にして消せる', () => {
    const withDue = updateCard(board(), 1, { dueDate: '2026-09-30' })
    const cleared = updateCard(withDue, 1, { dueDate: null })
    expect(cleared.lists[0]!.cards[0]!.dueDate).toBeNull()
  })

  it('削除すると同じリストのカードの position が詰まる', () => {
    const next = removeCard(board(), 1)
    expect(cardIds(next, 10)).toEqual([2])
    expect(next.lists[0]!.cards[0]!.position).toBe(0)
  })
})

describe('カードの移動（04 API設計書 4.12）', () => {
  it('別のリストの指定した位置へ移す', () => {
    const next = moveCard(board(), 1, 20, 0)
    expect(cardIds(next, 10)).toEqual([2])
    expect(cardIds(next, 20)).toEqual([1, 3])
  })

  it('別のリストの一番下へ移す', () => {
    const next = moveCard(board(), 1, 20, 1)
    expect(cardIds(next, 20)).toEqual([3, 1])
  })

  it('同じリスト内で並び替える', () => {
    const next = moveCard(board(), 2, 10, 0)
    expect(cardIds(next, 10)).toEqual([2, 1])
  })

  it('移動先の position を振り直す', () => {
    const next = moveCard(board(), 1, 20, 0)
    expect(next.lists[1]!.cards.map((c) => c.position)).toEqual([0, 1])
  })

  it('空のリストへ移せる', () => {
    const next = moveCard(board(), 3, 30, 0)
    expect(cardIds(next, 20)).toEqual([])
    expect(cardIds(next, 30)).toEqual([3])
  })
})

describe('findCardLocation', () => {
  it('カードが今どのリストの何番目にいるかを返す', () => {
    const found = findCardLocation(board(), 2)
    expect(found?.list.id).toBe(10)
    expect(found?.index).toBe(1)
  })

  it('見つからなければ null', () => {
    expect(findCardLocation(board(), 999)).toBeNull()
  })
})
