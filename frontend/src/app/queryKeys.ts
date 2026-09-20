/**
 * TanStack Query のキーをここだけで定義する。
 * 文字列を各所に直書きすると、キャッシュを消す（invalidate）ときの書き間違いに気づけないため。
 */
export const queryKeys = {
  /** ログイン中の利用者（GET /api/auth/me） */
  me: ['me'] as const,
  /** サイドバーのボード一覧（GET /api/boards） */
  boards: ['boards'] as const,
  /** ボード1件＋リスト＋カード（GET /api/boards/{id}） */
  board: (boardId: number) => ['board', boardId] as const,
  /** ゴミ箱の一覧（GET /api/trash） */
  trash: ['trash'] as const,
  /** サイドバーに出すゴミ箱の件数（GET /api/trash/count） */
  trashCount: ['trashCount'] as const,
}
