/**
 * サイドバーのボードの並び替え（F-16）の計算。
 *
 * 通信の前に画面を動かす（楽観的更新）ために、
 * 「この位置へ動かしたら、どの並びになるか」をここで決める。
 * 通信の組み立てから切り離しておくと、並びの決まりだけを単体で確かめられる。
 */
import type { BoardSummary } from '../../api/types.ts'

/**
 * 1つのボードを、指定した位置（0 が一番上）へ動かした並びを返す。
 * position はサーバーが振り直すが、画面では表示順と合わせておく。
 */
export function reorderBoards(
  boards: BoardSummary[],
  boardId: number,
  position: number,
): BoardSummary[] {
  const moving = boards.find((board) => board.id === boardId)
  if (!moving) return boards

  const rest = boards.filter((board) => board.id !== boardId)
  rest.splice(position, 0, moving)

  return rest.map((board, index) => ({ ...board, position: index }))
}
