/**
 * ボードへの操作を「先に画面を更新してから通信する」形にまとめたもの（F-01・05 画面設計書 9章）。
 *
 * 作成・編集・削除・移動はすべて同じ流れになる。
 *   1. 表示中のボードのキャッシュを、操作後の姿に書き換える
 *   2. 通信する
 *   3. 失敗したら 1 の前の状態へ戻し、トーストを出す（05 画面設計書 8.1）
 *   4. 最後にサーバーの状態を取り直して、ずれがあれば直す
 *
 * 各操作でこれを書くと必ずどこかで書き漏らすため、1つのフックに寄せている。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { describeError } from '../../app/errorHandling.ts'
import { queryKeys } from '../../app/queryKeys.ts'
import { useToast } from '../../components/toastContext.ts'
import type { BoardDetail } from '../../api/types.ts'
import { useSessionExpiredHandler } from '../auth/useAuth.ts'

type Options<TVariables, TData> = {
  boardId: number
  /** 実際に呼ぶ API */
  mutationFn: (variables: TVariables) => Promise<TData>
  /** 通信の前に、表示中のボードをどう書き換えるか */
  optimisticUpdate: (board: BoardDetail, variables: TVariables) => BoardDetail
  /** 成功したあとに他のキャッシュも古くしたいときに指定する（ゴミ箱の件数など） */
  invalidateKeys?: readonly (readonly unknown[])[]
}

export function useOptimisticBoardMutation<TVariables, TData>({
  boardId,
  mutationFn,
  optimisticUpdate,
  invalidateKeys = [],
}: Options<TVariables, TData>) {
  const queryClient = useQueryClient()
  const showToast = useToast()
  const onSessionExpired = useSessionExpiredHandler()
  const boardKey = queryKeys.board(boardId)

  return useMutation<TData, unknown, TVariables, { previous?: BoardDetail }>({
    mutationFn,

    onMutate: async (variables) => {
      // 取得中の通信が後から古いデータを書き戻すのを防ぐ
      await queryClient.cancelQueries({ queryKey: boardKey })
      const previous = queryClient.getQueryData<BoardDetail>(boardKey)
      if (previous) {
        queryClient.setQueryData(boardKey, optimisticUpdate(previous, variables))
      }
      return { previous }
    },

    onError: (error, _variables, context) => {
      // 先に更新していた画面を元の状態へ戻す（05 画面設計書 8.1）
      if (context?.previous) {
        queryClient.setQueryData(boardKey, context.previous)
      }

      const handling = describeError(error, 'save')
      if (handling.sessionExpired) {
        onSessionExpired()
        return
      }
      showToast({
        kind: handling.kind,
        message: handling.message,
        action: handling.actionLabel
          ? { label: handling.actionLabel, onClick: () => location.reload() }
          : undefined,
      })
    },

    onSettled: () => {
      // 成否によらずサーバーの状態に合わせ直す。
      // 並び替えの再採番はサーバーが行うため、ここで取り直す必要がある（04 API設計書 4.9・4.12）
      void queryClient.invalidateQueries({ queryKey: boardKey })
      for (const key of invalidateKeys) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}
