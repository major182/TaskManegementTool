/**
 * 画面に出す文言。出典は 05 画面設計書 8章。
 * CLAUDE.md 3.3 のとおり、文言は設計書と一致させる。直書きせず必ずここを参照する。
 */

/** 8.1 エラー・通知（トースト） */
export const TOAST = {
  saveFailed: '保存できませんでした。通信の状態を確認して、もう一度お試しください',
  loadFailed: 'データを読み込めませんでした',
  sessionExpired: 'ログインの有効期限が切れました。もう一度ログインしてください',
  csrfFailed: '操作を完了できませんでした。ページを再読み込みしてください',
  notFound: 'データが見つかりません。画面を再読み込みします',
  restoredToLeftmostList: '元のリストがないため、一番左のリストに戻しました',
  listNotRestorable: '元のボードがないため戻せません',
  themeSaveFailed: 'テーマを保存できませんでした',
  imageUploadFailed: '画像をアップロードできませんでした',
  imageDeleteFailed: '画像を削除できませんでした',
} as const

/** トーストのボタン文言 */
export const TOAST_ACTION = {
  retry: '再試行',
  reload: '再読み込み',
} as const

/** 8.2 入力エラー（入力欄の近くに出す） */
export const FIELD_ERROR = {
  usernameRequired: 'ユーザーID を入力してください',
  usernameFormat: 'ユーザーID は半角英数字とアンダースコアで4〜20文字で入力してください',
  usernameTaken: 'このユーザーID は使われています',
  passwordRequired: 'パスワードを入力してください',
  passwordFormat: 'パスワードは英字と数字を含む8文字以上で入力してください',
  passwordMismatch: 'パスワードが一致しません',
  nameRequired: '名前を入力してください',
  nameTooLong: '50文字以内で入力してください',
  cardTitleRequired: 'タイトルを入力してください',
  cardTitleTooLong: '100文字以内で入力してください',
  descriptionTooLong: '2,000文字以内で入力してください',
  /** カスタムカラーの R・G・B（業務ルール 5.7） */
  colorChannel: '0〜255 の数字で入力してください',
  /** 背景画像（業務ルール 5.7）。画面側で先に確かめ、サーバーの 400・413 も同じ文言にする */
  imageType: 'JPEG・PNG・WebP の画像を選んでください',
  imageSize: '5MB 以下の画像を選んでください',
  /** 05 5章：ログイン失敗はどちらが違うか書かない（業務ルール 5.6） */
  loginFailed: 'ユーザーID またはパスワードが違います',
} as const

/** 8.3 データが無いときの案内 */
export const EMPTY = {
  boards: 'ボードがありません。新しく作成しましょう',
  lists: 'リストがありません。「＋ リストを追加」から作成しましょう',
  trash: 'ゴミ箱は空です',
} as const

/** 9章 読み込み中の表示 */
export const LOADING = {
  /** 読み込みが10秒を超えたときに追加で出す（Render のスリープ明け対策） */
  serverWakingUp: 'サーバーの起動を待っています。しばらくお待ちください',
  loggingIn: 'ログイン中…',
  signingUp: '登録中…',
} as const

/** 7章 確認ダイアログ */
export const CONFIRM = {
  purgeCard: (name: string) => `『${name}』を完全に削除します。元に戻せません。削除しますか？`,
  purgeList: (name: string) =>
    `『${name}』と中のカードを完全に削除します。元に戻せません。削除しますか？`,
  purgeBoard: (name: string) =>
    `『${name}』と中のリスト・カードを完全に削除します。元に戻せません。削除しますか？`,
  emptyTrash: (count: number) =>
    `ゴミ箱の${count}件をすべて完全に削除します。元に戻せません。削除しますか？`,
  deleteImage: '背景画像を削除します。元に戻せません。削除しますか？',
  deleteLabel: '削除する',
  cancelLabel: 'キャンセル',
  executeLabel: '完全に削除する',
} as const

/** 入力の上限（業務ルール 5.1）。入力欄の maxLength と画面側チェックで使う */
export const LIMIT = {
  boardName: 50,
  listName: 50,
  cardTitle: 100,
  cardDescription: 2000,
} as const

/** 4.7 テーマ変更パネル */
export const THEME = {
  openButton: '🎨 テーマを変更',
  panelTitle: 'テーマを変更',
  templates: 'テンプレート',
  defaultLabel: '既定',
  custom: 'カスタムカラー',
  sidebar: 'サイドバー',
  board: 'ボード',
  cancel: 'キャンセル',
  apply: '適用',
  close: '閉じる',
  image: '背景画像',
  upload: '画像をアップロード',
  change: '画像を変更',
  uploading: 'アップロード中…',
  deleteImage: '画像を削除',
  imageNote: 'JPEG・PNG・WebP、5MB まで',
} as const
