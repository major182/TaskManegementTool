/**
 * S-01 メイン画面（05 画面設計書 4章）。
 * サイドバーと表示エリアを組み立て、どのボードを出すかを決める。
 */
import { useEffect, useState } from 'react'
import { useToast } from '../../components/toastContext.ts'
import { describeError } from '../../app/errorHandling.ts'
import type { CardUpdateRequest } from '../../api/endpoints.ts'
import type { Card, UserResponse } from '../../api/types.ts'
import { useLogout } from '../auth/useAuth.ts'
import { BoardView, NoBoardView } from './BoardView.tsx'
import { Sidebar } from './Sidebar.tsx'
import { TrashView } from '../trash/TrashView.tsx'
import styles from './MainScreen.module.css'
import {
  useBoardDetail,
  useBoardList,
  useCreateBoard,
  useRecordLastOpenedBoard,
  useRenameBoard,
  useTrashBoard,
  useTrashCount,
} from './useBoards.ts'
import {
  useCreateCard,
  useCreateList,
  useMoveCard,
  useMoveList,
  useRenameList,
  useTrashCard,
  useTrashList,
  useUpdateCard,
} from './useListCardMutations.ts'

export function MainScreen({ user }: { user: UserResponse }) {
  const showToast = useToast()
  const boardListQuery = useBoardList()
  const trashCountQuery = useTrashCount()

  const logout = useLogout()
  const createBoard = useCreateBoard()
  const renameBoard = useRenameBoard()
  const trashBoard = useTrashBoard()
  const recordLastOpened = useRecordLastOpenedBoard()

  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)
  const [isTrashActive, setIsTrashActive] = useState(false)

  const boards = boardListQuery.data ?? []

  // 表示するボードは描画のたびに決める（F-15）。
  // 選んだボードが消えている（削除した直後など）ときは、既定のボードに戻す
  const defaultBoardId =
    boards.find((b) => b.id === user.lastOpenedBoardId)?.id ?? boards[0]?.id ?? null
  const activeBoardId = boards.some((b) => b.id === selectedBoardId)
    ? selectedBoardId
    : defaultBoardId

  const boardQuery = useBoardDetail(isTrashActive ? null : activeBoardId)

  // リスト・カードの操作。表示しているボードが無いときは呼ばれない
  const listCard = useListCardActions(activeBoardId ?? 0)

  // 読み込みに失敗したことは、通信の結果なのでトーストで知らせる（05 画面設計書 8.1）
  const loadError = boardListQuery.error ?? boardQuery.error
  useEffect(() => {
    if (!loadError) return
    const handling = describeError(loadError, 'load')
    showToast({
      kind: handling.kind,
      message: handling.message,
      action: handling.actionLabel
        ? { label: handling.actionLabel, onClick: () => location.reload() }
        : undefined,
    })
  }, [loadError, showToast])

  function selectBoard(boardId: number) {
    setIsTrashActive(false)
    setSelectedBoardId(boardId)
    recordLastOpened.mutate(boardId)
  }

  function handleCreateBoard(name: string) {
    createBoard.mutate(name, {
      // 作ったボードをそのまま表示する（05 画面設計書 4.2 No.3）
      onSuccess: (board) => selectBoard(board.id),
    })
  }

  function handleDeleteBoard() {
    if (activeBoardId === null) return
    // 削除したあとはサイドバーの次のボードを表示する（05 画面設計書 4.3 No.2）
    const index = boards.findIndex((b) => b.id === activeBoardId)
    const next = boards[index + 1] ?? boards[index - 1] ?? null

    trashBoard.mutate(activeBoardId, {
      onSuccess: () => {
        if (next) {
          selectBoard(next.id)
        } else {
          setSelectedBoardId(null)
        }
      },
    })
  }

  return (
    <div className={styles.screen}>
      <Sidebar
        boards={boards}
        activeBoardId={activeBoardId}
        isTrashActive={isTrashActive}
        trashCount={trashCountQuery.data ?? 0}
        onSelectBoard={selectBoard}
        onSelectTrash={() => setIsTrashActive(true)}
        onCreateBoard={handleCreateBoard}
        onLogout={() => logout.mutate()}
        isLoggingOut={logout.isPending}
      />

      {isTrashActive ? (
        <TrashView />
      ) : activeBoardId === null ? (
        <NoBoardView />
      ) : (
        <BoardView
          board={boardQuery.data}
          isLoading={boardQuery.isPending}
          onRename={(name) => renameBoard.mutate({ boardId: activeBoardId, name })}
          onDelete={handleDeleteBoard}
          isDeleting={trashBoard.isPending}
          {...listCard}
        />
      )}
    </div>
  )
}

/**
 * リストとカードの操作を、BoardView に渡す形にまとめる。
 * フックは条件付きで呼べないため、表示するボードが無いときも 0 を渡して必ず呼ぶ。
 */
function useListCardActions(boardId: number) {
  const createList = useCreateList(boardId)
  const renameList = useRenameList(boardId)
  const trashList = useTrashList(boardId)
  const moveList = useMoveList(boardId)
  const createCard = useCreateCard(boardId)
  const updateCard = useUpdateCard(boardId)
  const trashCard = useTrashCard(boardId)
  const moveCard = useMoveCard(boardId)

  return {
    onCreateList: (name: string) => createList.mutate(name),
    onRenameList: (listId: number, name: string) => renameList.mutate({ listId, name }),
    onDeleteList: (listId: number) => trashList.mutate(listId),
    onMoveList: (listId: number, position: number) => moveList.mutate({ listId, position }),

    onCreateCard: (listId: number, title: string) => createCard.mutate({ listId, title }),
    // チェックボックスは isDone だけ反転し、他の項目は今の値をそのまま送る（04 API設計書 5章）
    onToggleCardDone: (card: Card) =>
      updateCard.mutate({
        cardId: card.id,
        values: {
          title: card.title,
          description: card.description,
          dueDate: card.dueDate,
          isDone: !card.isDone,
        },
      }),
    onSaveCard: (cardId: number, values: CardUpdateRequest) =>
      updateCard.mutate({ cardId, values }),
    onDeleteCard: (cardId: number) => trashCard.mutate(cardId),
    onMoveCard: (cardId: number, listId: number, position: number) =>
      moveCard.mutate({ cardId, listId, position }),
  }
}
