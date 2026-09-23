/**
 * カードのその場編集の中身（05 画面設計書 4.5）。
 * 通信を含まない判断だけを切り出して、テストしやすくしている。
 */
import type { CardUpdateRequest } from '../../api/endpoints.ts'
import type { Card } from '../../api/types.ts'
import { FIELD_ERROR, LIMIT } from '../../messages.ts'

/** 編集中の入力内容 */
export type CardDraft = {
  title: string
  description: string
  /** 日付入力（type="date"）は空のとき空文字になる */
  dueDate: string
}

export function toDraft(card: Card): CardDraft {
  return {
    title: card.title,
    description: card.description ?? '',
    dueDate: card.dueDate ?? '',
  }
}

/**
 * 保存するときに送る形にする。
 * PUT は4項目すべて送る決まりなので、変えていない項目も今の値を入れる（04 API設計書 4.11）。
 */
export function toRequest(draft: CardDraft, card: Card): CardUpdateRequest {
  return {
    title: draft.title.trim(),
    // 空欄はサーバー側で null として保存されるので、あらかじめ null に寄せる
    description: draft.description.trim() === '' ? null : draft.description,
    // 「×」で空にしたときは null を送って期限日を消す（F-35）
    dueDate: draft.dueDate === '' ? null : draft.dueDate,
    isDone: card.isDone,
  }
}

/**
 * カードのタイトルの入力チェック（業務ルール 5.1、05 画面設計書 8.2）。
 * 追加のときも編集のときも同じ規則にするため、ここに置いて両方から使う
 *
 * @returns エラーメッセージ。問題なければ undefined
 */
export function validateCardTitle(title: string): string | undefined {
  if (title.trim() === '') return FIELD_ERROR.cardTitleRequired
  if (title.length > LIMIT.cardTitle) return FIELD_ERROR.cardTitleTooLong
  return undefined
}

/** @returns エラーメッセージ。問題なければ undefined */
export function validateDraft(draft: CardDraft): string | undefined {
  const titleError = validateCardTitle(draft.title)
  if (titleError) return titleError

  if (draft.description.length > LIMIT.cardDescription) {
    return FIELD_ERROR.descriptionTooLong
  }
  return undefined
}

/**
 * 1文字も変わっていないかを調べる。
 * 変わっていなければ通信しない（05 画面設計書 4.5）。
 */
export function isUnchanged(draft: CardDraft, card: Card): boolean {
  const next = toRequest(draft, card)
  return (
    next.title === card.title &&
    next.description === card.description &&
    next.dueDate === card.dueDate
  )
}
