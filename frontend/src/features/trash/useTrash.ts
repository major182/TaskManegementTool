/**
 * ゴミ箱の取得と操作（04 API設計書 3.5、05 画面設計書 4.6）。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { trashApi } from '../../api/endpoints.ts'
import type { TrashItem, TrashType } from '../../api/types.ts'
import { queryKeys } from '../../app/queryKeys.ts'
import { useApiErrorNotifier } from '../../app/useApiErrorNotifier.ts'
import { useToast } from '../../components/toastContext.ts'

/** 削除日時の新しい順。親がゴミ箱にある子は含まれない（サーバー側で除外済み） */
export function useTrashList() {
  return useQuery<TrashItem[]>({
    queryKey: queryKeys.trash,
    queryFn: () => trashApi.list(),
  })
}

/**
 * ゴミ箱を変えたあとに、影響する表示をまとめて取り直す。
 *
 * 復元も完全削除も、ゴミ箱の一覧・件数に加えて
 * ボード一覧と表示中のボードまで変わりうる（ボードを戻した、リストが戻ったなど）。
 * どれを取り直すかを毎回考えると漏れるので、まとめて無効にしている。
 */
function useRefreshAfterTrashChange() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trash })
    void queryClient.invalidateQueries({ queryKey: queryKeys.trashCount })
    void queryClient.invalidateQueries({ queryKey: queryKeys.boards })
    void queryClient.invalidateQueries({ queryKey: ['board'] })
  }
}

/**
 * 通信に失敗したときの共通の知らせ方。
 * 401・404・[再試行] の扱いは画面共通なので useApiErrorNotifier に任せる
 */
function useTrashErrorHandler() {
  const notifyError = useApiErrorNotifier()
  return (error: unknown, onRetry?: () => void) =>
    notifyError(error, { operation: 'save', onRetry })
}

/**
 * 元に戻す（F-42）。
 * ゴミ箱は楽観的更新にしない。戻せるかどうかの判断がサーバー側にあり
 * （元のボードが無い、戻せる場所が無いなど 409 になる）、
 * 先に画面から消すと「戻ったように見えて実は戻っていない」状態が起きるため。
 */
export function useRestoreFromTrash() {
  const refresh = useRefreshAfterTrashChange()
  const showToast = useToast()
  const handleError = useTrashErrorHandler()

  const mutation = useMutation({
    mutationFn: ({ type, id }: { type: TrashType; id: number }) => trashApi.restore(type, id),
    onSuccess: (result) => {
      refresh()
      // 「元のリストがないため、一番左のリストに戻しました」など。
      // 戻ったが場所が違う、という事実は伝える必要がある（05 画面設計書 8.1）
      if (result.message) {
        showToast({ kind: 'info', message: result.message })
      }
    },
    onError: (error, variables) => handleError(error, () => mutation.mutate(variables)),
  })
  return mutation
}

/** 完全に削除（F-43）。呼ぶ前に必ず確認ダイアログを出す（業務ルール 5.3） */
export function usePurgeFromTrash() {
  const refresh = useRefreshAfterTrashChange()
  const handleError = useTrashErrorHandler()

  const mutation = useMutation({
    mutationFn: ({ type, id }: { type: TrashType; id: number }) => trashApi.purge(type, id),
    onSuccess: refresh,
    onError: (error, variables) => handleError(error, () => mutation.mutate(variables)),
  })
  return mutation
}

/** ゴミ箱を空にする（F-44）。こちらも確認ダイアログのあとで呼ぶ */
export function useEmptyTrash() {
  const refresh = useRefreshAfterTrashChange()
  const handleError = useTrashErrorHandler()

  const mutation = useMutation({
    mutationFn: () => trashApi.empty(),
    onSuccess: refresh,
    onError: (error) => handleError(error, () => mutation.mutate()),
  })
  return mutation
}
