/**
 * ログイン状態の取得と、ログイン・新規登録・ログアウトの実行。
 * 出典：05 画面設計書 3章（画面遷移）、04 API設計書 4.1〜4.3。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/client.ts'
import { authApi } from '../../api/endpoints.ts'
import type { CredentialsRequest, UserResponse } from '../../api/types.ts'
import { queryKeys } from '../../app/queryKeys.ts'

/**
 * ログイン中の利用者を取得する。
 * 未ログインなら 401（ApiError）が返るので、その場合は null 扱いにする。
 * 401 は「エラー」ではなく「未ログインという正常な状態」なので、
 * ここで null に変換して画面側が try/catch をしなくて済むようにしている。
 */
export function useCurrentUser() {
  return useQuery<UserResponse | null>({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        return await authApi.me()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null
        }
        throw error
      }
    },
    // ログイン状態は常に最新を見たいのでキャッシュを古いものとして扱わない
    staleTime: 0,
    retry: false,
  })
}

/**
 * ログイン状態そのものを表すキャッシュ。
 * 利用者が入れ替わっても消してはいけない（消すと画面が誰も見ていない状態に戻る）。
 */
const KEPT_ON_USER_CHANGE = new Set<unknown>([
  queryKeys.me[0],
  queryKeys.sessionExpired[0],
])

/**
 * 前の利用者のデータを捨てる。
 *
 * queryClient.clear() は使わない。あれは実行中の mutation の記録まで消してしまい、
 * 新規登録の成功後に画面が切り替わらなくなるため（1回目の登録で画面が動かない不具合）。
 * ログイン状態のキャッシュだけは残し、それ以外を消す。
 */
function useAuthSuccess() {
  const queryClient = useQueryClient()
  return (user: UserResponse) => {
    queryClient.setQueryData(queryKeys.me, user)
    queryClient.setQueryData(queryKeys.sessionExpired, false)
    queryClient.removeQueries({
      predicate: (query) => !KEPT_ON_USER_CHANGE.has(query.queryKey[0]),
    })
  }
}

export function useLogin() {
  const onAuthenticated = useAuthSuccess()
  return useMutation({
    mutationFn: (credentials: CredentialsRequest) => authApi.login(credentials),
    onSuccess: onAuthenticated,
  })
}

export function useSignup() {
  const onAuthenticated = useAuthSuccess()
  return useMutation({
    mutationFn: (credentials: CredentialsRequest) => authApi.signup(credentials),
    onSuccess: onAuthenticated,
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => authApi.logout(),
    // 通信が失敗しても画面上はログアウトさせる。
    // セッションが切れていて 401 になる場合もあり、そこで留まると画面が使えないため
    onSettled: () => {
      queryClient.setQueryData(queryKeys.me, null)
      // 自分でログアウトしたので「期限が切れました」は出さない
      queryClient.setQueryData(queryKeys.sessionExpired, false)
      queryClient.removeQueries({
        predicate: (query) => !KEPT_ON_USER_CHANGE.has(query.queryKey[0]),
      })
    },
  })
}

/**
 * どの操作中でも 401 が返ったときに呼ぶ。
 * ログイン状態を「未ログイン」に落とすと、App がログイン画面（S-02）を出す（業務ルール 5.6）。
 */
export function useSessionExpiredHandler() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.setQueryData(queryKeys.me, null)
    queryClient.setQueryData(queryKeys.sessionExpired, true)
  }
}

/** ログイン画面に「有効期限が切れました」を出すかどうか */
export function useSessionExpired(): boolean {
  const { data } = useQuery<boolean>({
    queryKey: queryKeys.sessionExpired,
    // 通信はしない。他の場所が setQueryData で書き込んだ値を読むだけ
    queryFn: () => false,
    initialData: false,
    staleTime: Infinity,
  })
  return data
}
