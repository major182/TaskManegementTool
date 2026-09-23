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
import { useEffect, useRef } from 'react'
import { queryKeys } from '../../app/queryKeys.ts'
import { useApiErrorNotifier } from '../../app/useApiErrorNotifier.ts'
import type { BoardDetail } from '../../api/types.ts'

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
  const notifyError = useApiErrorNotifier()
  const boardKey = queryKeys.board(boardId)

  // [再試行] で同じ操作をやり直せるよう、自分自身の mutate を覚えておく。
  // onError を作る時点では mutation がまだ無いので、箱（ref）を経由する
  const retry = useRef<(variables: TVariables) => void>(() => {})

  const mutation = useMutation<TData, unknown, TVariables, { previous?: BoardDetail }>({
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

    onError: (error, variables, context) => {
      // 先に更新していた画面を元の状態へ戻す（05 画面設計書 8.1）
      if (context?.previous) {
        queryClient.setQueryData(boardKey, context.previous)
      }

      notifyError(error, { operation: 'save', onRetry: () => retry.current(variables) })
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

  useEffect(() => {
    retry.current = mutation.mutate
  }, [mutation.mutate])

  return mutation
}
