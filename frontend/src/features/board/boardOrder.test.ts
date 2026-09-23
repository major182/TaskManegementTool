import { describe, expect, it } from 'vitest'
import { reorderBoards } from './boardOrder.ts'
import type { BoardSummary } from '../../api/types.ts'

const BOARDS: BoardSummary[] = [
  { id: 1, name: 'A', position: 0, createdAt: '2026-09-20T00:00:00Z' },
  { id: 2, name: 'B', position: 1, createdAt: '2026-09-21T00:00:00Z' },
  { id: 3, name: 'C', position: 2, createdAt: '2026-09-22T00:00:00Z' },
]

describe('reorderBoards（F-16）', () => {
  it('一番下のボードを一番上へ動かせる', () => {
    const moved = reorderBoards(BOARDS, 3, 0)

    expect(moved.map((b) => b.id)).toEqual([3, 1, 2])
    // 表示順と position を合わせておく（サーバーの応答で最終的に上書きされる）
    expect(moved.map((b) => b.position)).toEqual([0, 1, 2])
  })

  it('途中の位置へ動かせる', () => {
    expect(reorderBoards(BOARDS, 1, 1).map((b) => b.id)).toEqual([2, 1, 3])
  })

  it('同じ位置へ動かしても並びは変わらない', () => {
    expect(reorderBoards(BOARDS, 2, 1).map((b) => b.id)).toEqual([1, 2, 3])
  })

  it('元のリストを書き換えない', () => {
    reorderBoards(BOARDS, 3, 0)
    expect(BOARDS.map((b) => b.id)).toEqual([1, 2, 3])
  })

  it('知らないボードを指定されたら何もしない', () => {
    expect(reorderBoards(BOARDS, 999, 0)).toBe(BOARDS)
  })
})
