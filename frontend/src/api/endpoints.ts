/**
 * 04 API設計書 3章のエンドポイント21本を、1本ずつ関数にしたもの。
 * 画面側はここだけを呼び、URL の組み立てを各所に散らさない。
 */
import { api } from './client.ts'
import type {
  BoardCreatedResponse,
  BoardDetail,
  BoardSummary,
  Card,
  CardMoveResult,
  CredentialsRequest,
  BoardPosition,
  ListPosition,
  NameChangedResponse,
  RestoreResult,
  TaskList,
  TrashCountResponse,
  TrashItem,
  TrashType,
  TrashTypePath,
  UserResponse,
} from './types.ts'

/** ゴミ箱の種類を URL の表記に直す（BOARD → boards） */
export function toTrashTypePath(type: TrashType): TrashTypePath {
  switch (type) {
    case 'BOARD':
      return 'boards'
    case 'LIST':
      return 'lists'
    case 'CARD':
      return 'cards'
  }
}

// ---------- 認証・利用者（04 3.1） ----------

export const authApi = {
  /** 新規登録。成功するとそのままログイン状態になる（F-05） */
  signup: (body: CredentialsRequest) => api.post<UserResponse>('/auth/signup', body),
  login: (body: CredentialsRequest) => api.post<UserResponse>('/auth/login', body),
  logout: () => api.post<void>('/auth/logout'),
  /** 未ログインなら 401（ApiError）になる */
  me: () => api.get<UserResponse>('/auth/me'),
  /** 最後に開いていたボードを記録する（F-15）。応答は 204 */
  setLastOpenedBoard: (boardId: number) => api.put<void>('/me/last-opened-board', { boardId }),
}

// ---------- ボード（04 3.2） ----------

export const boardApi = {
  /** サイドバー用。利用者が並べた順（上から下） */
  list: () => api.get<BoardSummary[]>('/boards'),
  create: (name: string) => api.post<BoardCreatedResponse>('/boards', { name }),
  /** 画面表示用。リスト・カードが入れ子で返る */
  get: (boardId: number) => api.get<BoardDetail>(`/boards/${boardId}`),
  rename: (boardId: number, name: string) =>
    api.put<NameChangedResponse>(`/boards/${boardId}`, { name }),
  /** ゴミ箱へ移動（確認ダイアログは出さない） */
  trash: (boardId: number) => api.delete<void>(`/boards/${boardId}`),
  /** 並び替え。応答は再採番後のボードの順番 */
  move: (boardId: number, position: number) =>
    api.patch<BoardPosition[]>(`/boards/${boardId}/move`, { position }),
}

// ---------- リスト（04 3.3） ----------

export const listApi = {
  /** 一番右に追加される。position はサーバーが決める */
  create: (boardId: number, name: string) =>
    api.post<TaskList>(`/boards/${boardId}/lists`, { name }),
  rename: (listId: number, name: string) =>
    api.put<NameChangedResponse>(`/lists/${listId}`, { name }),
  /** ゴミ箱へ移動（中のカードごと） */
  trash: (listId: number) => api.delete<void>(`/lists/${listId}`),
  /** 並び替え。応答は再採番後のボード内リストの順番 */
  move: (listId: number, position: number) =>
    api.patch<ListPosition[]>(`/lists/${listId}/move`, { position }),
}

// ---------- カード（04 3.4） ----------

/** PUT は4項目すべて送る（04 4.11）。型で強制する */
export type CardUpdateRequest = {
  title: string
  description: string | null
  dueDate: string | null
  isDone: boolean
}

export const cardApi = {
  /** 一番下に追加される。期限日なし・未完了で作られる */
  create: (listId: number, title: string) => api.post<Card>(`/lists/${listId}/cards`, { title }),
  update: (cardId: number, body: CardUpdateRequest) => api.put<Card>(`/cards/${cardId}`, body),
  trash: (cardId: number) => api.delete<void>(`/cards/${cardId}`),
  /** 同じリスト内の並び替えも、listId に今のリストを指定して呼ぶ */
  move: (cardId: number, listId: number, position: number) =>
    api.patch<CardMoveResult>(`/cards/${cardId}/move`, { listId, position }),
}

// ---------- ゴミ箱（04 3.5） ----------

export const trashApi = {
  list: () => api.get<TrashItem[]>('/trash'),
  count: () => api.get<TrashCountResponse>('/trash/count'),
  restore: (type: TrashType, id: number) =>
    api.post<RestoreResult>(`/trash/${toTrashTypePath(type)}/${id}/restore`),
  /** 完全に削除。呼ぶ前に必ず確認ダイアログを出す（業務ルール 5.3） */
  purge: (type: TrashType, id: number) => api.delete<void>(`/trash/${toTrashTypePath(type)}/${id}`),
  /** ゴミ箱を空にする。こちらも確認ダイアログのあとで呼ぶ */
  empty: () => api.delete<void>('/trash'),
}
