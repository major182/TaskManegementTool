import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client.ts'

/**
 * TanStack Query の共通設定。
 *
 * - 401・404 は何度やり直しても結果が変わらないので、リトライしない
 * - 更新系（mutation）は楽観的更新と組み合わせるため、リトライしない
 *   （04 API設計書 8章 No.4 の「画面の実装時に決める」をここで決定）
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status < 500) return false
          return failureCount < 2
        },
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
