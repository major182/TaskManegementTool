import { describe, expect, it } from 'vitest'
import { formatDueDate, isOverdue, today } from './dueDate.ts'

const NOW = new Date(2026, 8, 21) // 2026-09-21（月は0始まり）

describe('期限日の扱い（05 画面設計書 4.4）', () => {
  it('今日の日付を YYYY-MM-DD で返す', () => {
    expect(today(NOW)).toBe('2026-09-21')
  })

  it('未完了で期限日が今日より前なら期限切れ', () => {
    expect(isOverdue('2026-09-20', false, NOW)).toBe(true)
  })

  it('当日は期限切れにしない', () => {
    expect(isOverdue('2026-09-21', false, NOW)).toBe(false)
  })

  it('未来の期限日は期限切れにしない', () => {
    expect(isOverdue('2026-09-22', false, NOW)).toBe(false)
  })

  it('完了していれば期限が過ぎていても目立たせない（業務ルール 5.2）', () => {
    expect(isOverdue('2026-09-01', true, NOW)).toBe(false)
  })

  it('期限日が無ければ期限切れにしない', () => {
    expect(isOverdue(null, false, NOW)).toBe(false)
  })

  it('M/D の形にする（先頭の0を付けない）', () => {
    expect(formatDueDate('2026-09-30')).toBe('9/30')
    expect(formatDueDate('2026-01-05')).toBe('1/5')
  })
})
