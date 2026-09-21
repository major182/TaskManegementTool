/**
 * サイドバー用のボード一覧と、ボード1件の取得・更新。
 * 出典：04 API設計書 3.2、05 画面設計書 4.2・4.3。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi, boardApi, trashApi } from '../../api/endpoints.ts'
import type { BoardDetail, BoardSummary } from '../../api/types.ts'
import { queryKeys } from '../../app/queryKeys.ts'

/** 作成日の新しい順。ゴミ箱のボードは含まれない（サーバー側で除外済み） */
export function useBoardList() {
  return useQuery<BoardSummary[]>({
    queryKey: queryKeys.boards,
    queryFn: () => boardApi.list(),
  })
}

/**
 * 表示中のボード1件（リスト・カードが入れ子）。
 * boardId が null のとき（ボードが1つも無いとき）は通信しない。
 */
export function useBoardDetail(boardId: number | null) {
  return useQuery<BoardDetail>({
    queryKey: queryKeys.board(boardId ?? 0),
    queryFn: () => boardApi.get(boardId as number),
    enabled: boardId !== null,
  })
}

/** サイドバーに出すゴミ箱の件数（F-41） */
export function useTrashCount() {
  return useQuery<number>({
    queryKey: queryKeys.trashCount,
    queryFn: async () => (await trashApi.count()).count,
  })
}

export function useCreateBoard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => boardApi.create(name),
    onSuccess: (board) => {
      // 作ったボードをすぐ表示できるよう、一覧とボード本体の両方を最新にする
      void queryClient.invalidateQueries({ queryKey: queryKeys.boards })
      queryClient.setQueryData(queryKeys.board(board.id), {
        id: board.id,
        name: board.name,
        lists: [],
      } satisfies BoardDetail)
    },
  })
}

export function useRenameBoard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ boardId, name }: { boardId: number; name: string }) =>
      boardApi.rename(boardId, name),
    // 先に画面を書き換えてから通信する（楽観的更新／F-01）
    onMutate: async ({ boardId, name }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.board(boardId) })
      const previousBoard = queryClient.getQueryData<BoardDetail>(queryKeys.board(boardId))
      const previousList = queryClient.getQueryData<BoardSummary[]>(queryKeys.boards)
      if (previousBoard) {
        queryClient.setQueryData(queryKeys.board(boardId), {
          ...previousBoard,
          name,
        })
      }
      if (previousList) {
        queryClient.setQueryData(
          queryKeys.boards,
          previousList.map((b) => (b.id === boardId ? { ...b, name } : b)),
        )
      }
      return { previousBoard, previousList }
    },
    // 失敗したら、先に更新した画面を元の状態へ戻す（05 画面設計書 8.1）
    onError: (_error, { boardId }, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(queryKeys.board(boardId), context.previousBoard)
      }
      if (context?.previousList) {
        queryClient.setQueryData(queryKeys.boards, context.previousList)
      }
    },
  })
}

export function useTrashBoard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (boardId: number) => boardApi.trash(boardId),
    onSuccess: (_data, boardId) => {
      queryClient.removeQueries({ queryKey: queryKeys.board(boardId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.boards })
      void queryClient.invalidateQueries({ queryKey: queryKeys.trashCount })
    },
  })
}

/**
 * 最後に開いたボードを記録する（F-15）。
 * 記録できなくても利用者の操作は妨げないため、失敗しても何も出さない。
 */
export function useRecordLastOpenedBoard() {
  return useMutation({
    mutationFn: (boardId: number) => authApi.setLastOpenedBoard(boardId),
  })
}
