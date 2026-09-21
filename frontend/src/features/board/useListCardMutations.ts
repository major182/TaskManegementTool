/**
 * リストとカードの操作。すべて楽観的更新（先に画面を更新してから通信）で行う。
 * 出典：04 API設計書 3.3・3.4、05 画面設計書 4.3〜4.5。
 */
import { cardApi, listApi } from '../../api/endpoints.ts'
import type { CardUpdateRequest } from '../../api/endpoints.ts'
import { queryKeys } from '../../app/queryKeys.ts'
import {
  addCard,
  addList,
  moveCard,
  moveList,
  removeCard,
  removeList,
  renameList,
  temporaryId,
  updateCard,
} from './boardUpdates.ts'
import { useOptimisticBoardMutation } from './useOptimisticBoard.ts'

/** ゴミ箱へ移した件数がサイドバーのバッジに出るので、あわせて取り直す */
const TRASH_KEYS = [queryKeys.trash, queryKeys.trashCount] as const

// ---------- リスト ----------

export function useCreateList(boardId: number) {
  return useOptimisticBoardMutation({
    boardId,
    mutationFn: (name: string) => listApi.create(boardId, name),
    optimisticUpdate: (board, name) =>
      addList(board, {
        // 本物の id はサーバーが決める。通信が終われば取り直したデータで置き換わる
        id: temporaryId(),
        name,
        position: board.lists.length,
        cards: [],
      }),
  })
}

export function useRenameList(boardId: number) {
  return useOptimisticBoardMutation({
    boardId,
    mutationFn: ({ listId, name }: { listId: number; name: string }) =>
      listApi.rename(listId, name),
    optimisticUpdate: (board, { listId, name }) => renameList(board, listId, name),
  })
}

export function useTrashList(boardId: number) {
  return useOptimisticBoardMutation({
    boardId,
    mutationFn: (listId: number) => listApi.trash(listId),
    optimisticUpdate: (board, listId) => removeList(board, listId),
    invalidateKeys: TRASH_KEYS,
  })
}

export function useMoveList(boardId: number) {
  return useOptimisticBoardMutation({
    boardId,
    mutationFn: ({ listId, position }: { listId: number; position: number }) =>
      listApi.move(listId, position),
    optimisticUpdate: (board, { listId, position }) => moveList(board, listId, position),
  })
}

// ---------- カード ----------

export function useCreateCard(boardId: number) {
  return useOptimisticBoardMutation({
    boardId,
    mutationFn: ({ listId, title }: { listId: number; title: string }) =>
      cardApi.create(listId, title),
    optimisticUpdate: (board, { listId, title }) => {
      const list = board.lists.find((l) => l.id === listId)
      return addCard(board, listId, {
        id: temporaryId(),
        title,
        // 期限日は空、未完了で作られる（04 API設計書 4.10）
        description: null,
        dueDate: null,
        isDone: false,
        position: list?.cards.length ?? 0,
      })
    },
  })
}

export function useUpdateCard(boardId: number) {
  return useOptimisticBoardMutation({
    boardId,
    // PUT は4項目すべて送る（04 API設計書 4.11）
    mutationFn: ({ cardId, values }: { cardId: number; values: CardUpdateRequest }) =>
      cardApi.update(cardId, values),
    optimisticUpdate: (board, { cardId, values }) => updateCard(board, cardId, values),
  })
}

export function useTrashCard(boardId: number) {
  return useOptimisticBoardMutation({
    boardId,
    mutationFn: (cardId: number) => cardApi.trash(cardId),
    optimisticUpdate: (board, cardId) => removeCard(board, cardId),
    invalidateKeys: TRASH_KEYS,
  })
}

export function useMoveCard(boardId: number) {
  return useOptimisticBoardMutation({
    boardId,
    mutationFn: ({
      cardId,
      listId,
      position,
    }: {
      cardId: number
      listId: number
      position: number
    }) => cardApi.move(cardId, listId, position),
    optimisticUpdate: (board, { cardId, listId, position }) =>
      moveCard(board, cardId, listId, position),
  })
}
