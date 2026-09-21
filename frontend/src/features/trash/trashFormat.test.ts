import { describe, expect, it } from 'vitest'
import { formatDeletedAt, formatOriginalLocation, trashTypeLabel } from './trashFormat.ts'

describe('種類の表示', () => {
  it('日本語の名前にする', () => {
    expect(trashTypeLabel('BOARD')).toBe('ボード')
    expect(trashTypeLabel('LIST')).toBe('リスト')
    expect(trashTypeLabel('CARD')).toBe('カード')
  })
})

describe('削除日時の表示（05 画面設計書 4.6）', () => {
  it('UTC を日本時間に直して M/D HH:mm で出す', () => {
    // 2026-09-20T03:00:00Z は日本時間で 9/20 12:00
    expect(formatDeletedAt('2026-09-20T03:00:00Z')).toBe('9/20 12:00')
  })

  it('日をまたぐ時刻も日本時間で数える', () => {
    // 2026-09-20T15:30:00Z は日本時間で 9/21 00:30
    expect(formatDeletedAt('2026-09-20T15:30:00Z')).toBe('9/21 00:30')
  })

  it('月・日の先頭に0を付けない', () => {
    // 2026-01-04T22:05:00Z は日本時間で 1/5 07:05
    expect(formatDeletedAt('2026-01-04T22:05:00Z')).toBe('1/5 07:05')
  })

  it('読めない値のときは空にする（画面を壊さない）', () => {
    expect(formatDeletedAt('これは日時ではない')).toBe('')
  })
})

describe('元の場所の表示', () => {
  it('そのまま出す', () => {
    expect(formatOriginalLocation('学習計画 ＞ TODO')).toBe('学習計画 ＞ TODO')
  })

  it('ボード（null）のときは「―」', () => {
    expect(formatOriginalLocation(null)).toBe('―')
  })
})
