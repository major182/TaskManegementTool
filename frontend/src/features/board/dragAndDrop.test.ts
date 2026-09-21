import { describe, expect, it } from 'vitest'
import type { BoardDetail } from '../../api/types.ts'
import { parseDragId, resolveCardDrop, resolveListDrop } from './dragAndDrop.ts'

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

const BOARD: BoardDetail = {
  id: 1,
  name: '学習計画',
  lists: [
    {
      id: 10,
      name: 'TODO',
      position: 0,
      cards: [card(1, 0), card(2, 1), card(3, 2)],
    },
    { id: 20, name: 'DOING', position: 1, cards: [card(4, 0)] },
    { id: 30, name: 'DONE', position: 2, cards: [] },
  ],
}

describe('parseDragId', () => {
  it('カードとリストを見分ける', () => {
    expect(parseDragId('card-8')).toEqual({ type: 'card', id: 8 })
    expect(parseDragId('list-3')).toEqual({ type: 'list', id: 3 })
  })

  it('作成直後の仮の id（負の数）も読める', () => {
    expect(parseDragId('card--1700000000000')).toEqual({
      type: 'card',
      id: -1700000000000,
    })
  })

  it('形式が違えば null', () => {
    expect(parseDragId('board-1')).toBeNull()
  })
})

describe('カードを離したときの移動先（04 API設計書 4.12）', () => {
  it('別のリストのカードの上で離すと、その位置に入る', () => {
    expect(resolveCardDrop(BOARD, 1, 'card-4')).toEqual({
      cardId: 1,
      listId: 20,
      position: 0,
    })
  })

  it('空のリストの上で離すと、そのリストの一番下に入る', () => {
    expect(resolveCardDrop(BOARD, 1, 'list-30')).toEqual({
      cardId: 1,
      listId: 30,
      position: 0,
    })
  })

  it('同じリスト内で下へ動かすときは、自分を抜いた分だけ1つ前になる', () => {
    // カード1（0番目）をカード3（2番目）の位置へ → 抜いたあとの並びでは1番目
    expect(resolveCardDrop(BOARD, 1, 'card-3')).toEqual({
      cardId: 1,
      listId: 10,
      position: 1,
    })
  })

  it('同じリスト内で上へ動かすときはそのままの位置', () => {
    expect(resolveCardDrop(BOARD, 3, 'card-1')).toEqual({
      cardId: 3,
      listId: 10,
      position: 0,
    })
  })

  it('自分の上で離したときは動かさない', () => {
    expect(resolveCardDrop(BOARD, 1, 'card-1')).toBeNull()
  })

  it('隣のカードの上で離しても位置が変わらないときは動かさない', () => {
    // カード1（0番目）をカード2（1番目）の位置へ → 抜いたあとも0番目なので変化なし
    expect(resolveCardDrop(BOARD, 1, 'card-2')).toBeNull()
  })

  it('今いるリストそのものの上で離したときは動かさない', () => {
    expect(resolveCardDrop(BOARD, 1, 'list-10')).toBeNull()
  })
})

describe('リストを離したときの移動先（04 API設計書 4.9）', () => {
  it('一番右のリストを一番左へ', () => {
    expect(resolveListDrop(BOARD, 30, 'list-10')).toEqual({
      listId: 30,
      position: 0,
    })
  })

  it('一番左のリストを真ん中へ', () => {
    expect(resolveListDrop(BOARD, 10, 'list-20')).toEqual({
      listId: 10,
      position: 1,
    })
  })

  it('自分の上で離したときは動かさない', () => {
    expect(resolveListDrop(BOARD, 10, 'list-10')).toBeNull()
  })

  it('カードの上で離したときは何もしない', () => {
    expect(resolveListDrop(BOARD, 10, 'card-1')).toBeNull()
  })
})
