/**
 * 期限日の判定と表示（05 画面設計書 4.4／F-35）。
 *
 * サーバーは dueDate と isDone を返すだけで、期限切れかどうかは画面側で決める。
 * 利用者のパソコンの日付を基準にする。
 */

/** 今日の日付を YYYY-MM-DD で得る（利用者のパソコンの時計を基準にする） */
export function today(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 期限切れかどうか。
 * 「未完了」かつ「期限日が今日より前」のときだけ true。**当日は期限切れにしない**。
 * 完了したカードは期限が過ぎていても目立たせない（業務ルール 5.2）。
 */
export function isOverdue(
  dueDate: string | null,
  isDone: boolean,
  now: Date = new Date(),
): boolean {
  if (dueDate === null || isDone) return false
  // YYYY-MM-DD は文字列のまま比べても日付順になる
  return dueDate < today(now)
}

/** 期限日を M/D の形にする（例：2026-09-30 → 9/30） */
export function formatDueDate(dueDate: string): string {
  const [, month, day] = dueDate.split('-')
  return `${Number(month)}/${Number(day)}`
}
