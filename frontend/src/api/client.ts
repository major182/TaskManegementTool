/**
 * サーバーとの通信の入り口。すべての API 呼び出しはここを通す。
 *
 * ここに集約する理由は、04 API設計書 2.2・2.3 の「付け忘れると必ず失敗する約束」を
 * 1か所で守るため。
 *   - credentials: 'include'（付けないと Cookie が送られず、常に 401）
 *   - GET 以外は X-XSRF-TOKEN ヘッダー（付け忘れると 403）
 */
import type { ProblemDetail, FieldError } from './types.ts'

/** 開発中は vite.config.ts の proxy が localhost:8080 へ転送するので、相対パスでよい */
const BASE_URL = '/api'

/**
 * サーバーがエラーを返したことを表す例外。
 * 画面側は status と detail を見て 05 画面設計書 8章の文言を出す。
 */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string | undefined
  /** 400 のときだけ入る、入力欄ごとのメッセージ */
  readonly errors: FieldError[]

  constructor(status: number, detail?: string, errors: FieldError[] = []) {
    super(detail ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.errors = errors
  }

  /** 指定した入力欄のエラーメッセージを取り出す（無ければ undefined） */
  fieldMessage(field: string): string | undefined {
    return this.errors.find((e) => e.field === field)?.message
  }
}

/** サーバーに届かなかった（ネットワーク断・サーバー停止）ことを表す例外 */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('サーバーに接続できませんでした')
    this.name = 'NetworkError'
    this.cause = cause
  }
}

/**
 * Spring Security が置く XSRF-TOKEN Cookie を読む。
 * HttpOnly ではないので JavaScript から読める（CookieCsrfTokenRepository.withHttpOnlyFalse）。
 */
export function readCsrfToken(): string | null {
  const found = document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='))
  if (!found) return null
  return decodeURIComponent(found.slice('XSRF-TOKEN='.length))
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

async function toApiError(response: Response): Promise<ApiError> {
  // エラー本文は ProblemDetail（04 2.6）。ただし 500 などで JSON が返らないこともある
  try {
    const problem = (await response.json()) as ProblemDetail
    return new ApiError(response.status, problem.detail, problem.errors ?? [])
  } catch {
    return new ApiError(response.status)
  }
}

/**
 * API を1回呼ぶ。
 * @returns 本文がある場合はその JSON、204 No Content の場合は undefined
 */
export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (method !== 'GET') {
    // 04 2.3：更新系には必ず CSRF トークンを付ける
    const token = readCsrfToken()
    if (token !== null) {
      headers['X-XSRF-TOKEN'] = token
    }
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      // 04 2.2：Cookie でセッションを持つため必須
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (cause) {
    throw new NetworkError(cause)
  }

  if (!response.ok) {
    throw await toApiError(response)
  }

  // 削除・ログアウトなどは 204 で本文がない
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
