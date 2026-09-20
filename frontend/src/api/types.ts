/**
 * サーバーとやり取りする JSON の型。
 * 出典は 04 API設計書 4章。ここを設計書と一致させておけば、
 * 画面側は型エラーで「設計書と違う使い方」に気づける。
 */

// ---------- 認証・利用者（04 4.1〜4.3） ----------

/** ログイン中の利用者。パスワードは一切含まれない */
export type UserResponse = {
  id: number
  username: string
  /** 最後に開いていたボード。まだ無ければ null（F-15） */
  lastOpenedBoardId: number | null
}

export type CredentialsRequest = {
  username: string
  password: string
}

// ---------- ボード（04 4.4〜4.7） ----------

/** サイドバー用のボード一覧の1件。リスト・カードは含まない */
export type BoardSummary = {
  id: number
  name: string
  /** ISO 8601・UTC の文字列。日本時間への変換は画面側で行う */
  createdAt: string
}

/** 画面表示用のボード1件。リストとカードが入れ子で入っている */
export type BoardDetail = {
  id: number
  name: string
  /** position の昇順（左から右） */
  lists: TaskList[]
}

export type TaskList = {
  id: number
  name: string
  position: number
  /** position の昇順（上から下） */
  cards: Card[]
}

export type Card = {
  id: number
  title: string
  /** 説明なしは null。空文字はサーバー側で null に寄せられる（04 4.11） */
  description: string | null
  /** YYYY-MM-DD。期限日なしは null */
  dueDate: string | null
  isDone: boolean
  position: number
}

/** ボード作成の応答だけは createdAt と空の lists を持つ（04 4.6） */
export type BoardCreatedResponse = BoardDetail & { createdAt: string }

/** ボード名・リスト名の変更の応答（04 4.7・4.9） */
export type NameChangedResponse = {
  id: number
  name: string
}

// ---------- 並び替え・移動（04 4.9・4.12） ----------

/** リスト並び替え後の、ボード内のリストの順番 */
export type ListPosition = {
  id: number
  position: number
}

/** カード移動後の、影響したリストのカードの並び */
export type CardMoveResult = {
  lists: { listId: number; cardIds: number[] }[]
}

// ---------- ゴミ箱（04 4.14・4.15） ----------

export type TrashType = 'BOARD' | 'LIST' | 'CARD'

/** URL に入れるほうの表記。TrashType と 1 対 1 で対応する */
export type TrashTypePath = 'boards' | 'lists' | 'cards'

export type TrashItem = {
  type: TrashType
  id: number
  name: string
  /** 「学習計画 ＞ TODO」のような表示用の文字列。ボードは null */
  originalLocation: string | null
  /** ISO 8601・UTC。画面では日本時間の M/D HH:mm に直して出す */
  deletedAt: string
  /** false のときは「元に戻す」を押せない状態にする */
  restorable: boolean
}

export type TrashCountResponse = {
  count: number
}

/** 元に戻した結果。種類によって使わない項目は null になる（04 4.15） */
export type RestoreResult = {
  type: TrashType
  id: number
  boardId: number | null
  listId: number | null
  position: number | null
  /** 「元のリストがないため、一番左のリストに戻しました」などのお知らせ */
  message: string | null
}

// ---------- エラー（04 2.6） ----------

/** 入力チェック（400）のときだけ付く、項目ごとのメッセージ */
export type FieldError = {
  field: string
  message: string
}

/** RFC 9457 ProblemDetail */
export type ProblemDetail = {
  type?: string
  title?: string
  status: number
  /** そのまま画面に出せる日本語の文言 */
  detail?: string
  instance?: string
  errors?: FieldError[]
}
