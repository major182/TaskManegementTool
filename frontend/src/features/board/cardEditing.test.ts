/**
 * カードの入力チェック（業務ルール 5.1、05 画面設計書 8.2）。
 * 追加のときと編集のときで規則が違っていた（追加では文字数を見ていなかった）ため、
 * 共通の関数にしたうえで、その関数をここで確かめる（Issue #41 A-8）。
 */
import { describe, expect, it } from 'vitest'
import { validateCardTitle } from './cardEditing.ts'

describe('validateCardTitle', () => {
  it('空白だけのときは入力を促す', () => {
    expect(validateCardTitle('   ')).toBe('タイトルを入力してください')
  })

  it('100文字ちょうどは通す', () => {
    expect(validateCardTitle('あ'.repeat(100))).toBeUndefined()
  })

  it('100文字を超えたら文字数のメッセージを返す', () => {
    expect(validateCardTitle('あ'.repeat(101))).toBe('100文字以内で入力してください')
  })
})
