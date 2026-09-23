/**
 * ログイン・新規登録の入力チェック。
 * ルールは 01-3 業務ルール 5.1、メッセージは 05 画面設計書 8.2 に合わせる。
 *
 * サーバー側でも同じチェックをしているが、画面側でも行うのは
 * 「未入力のまま押したときは通信せずに知らせる」（05 画面設計書 5章）ため。
 */
import { FIELD_ERROR } from '../../messages.ts'

/** 半角英数字とアンダースコアで4〜20文字（サーバーの @Pattern と同じ） */
const USERNAME_PATTERN = /^[A-Za-z0-9_]{4,20}$/
/**
 * 8〜72文字で、英字と数字をそれぞれ1文字以上。
 * 使える文字は半角英数字と記号（空白を含まない印字可能な ASCII）だけ（業務ルール 5.1）。
 */
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[\x21-\x7E]{8,72}$/

/** @returns エラーメッセージ。問題なければ undefined */
export function validateUsername(value: string): string | undefined {
  if (value === '') return FIELD_ERROR.usernameRequired
  if (!USERNAME_PATTERN.test(value)) return FIELD_ERROR.usernameFormat
  return undefined
}

/**
 * @param strict 新規登録では形式まで見る。ログインでは未入力だけを見る
 *   （ログイン時に形式で弾くと、ルール変更前に登録した人が入れなくなるため）
 */
export function validatePassword(value: string, strict: boolean): string | undefined {
  if (value === '') return FIELD_ERROR.passwordRequired
  if (strict && !PASSWORD_PATTERN.test(value)) return FIELD_ERROR.passwordFormat
  return undefined
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | undefined {
  if (confirmation === '') return FIELD_ERROR.passwordRequired
  if (password !== confirmation) return FIELD_ERROR.passwordMismatch
  return undefined
}
