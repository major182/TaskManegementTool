/**
 * その場編集の入力チェック（05 画面設計書 8.2）。
 * ボード名・リスト名で共通なので切り出している。
 */
import { FIELD_ERROR } from '../messages.ts'

export function validateName(value: string, maxLength: number): string | undefined {
  // 空白だけは「未入力」と同じ扱い（業務ルール 5.1）
  if (value.trim() === '') return FIELD_ERROR.nameRequired
  if (value.length > maxLength) return FIELD_ERROR.nameTooLong
  return undefined
}
