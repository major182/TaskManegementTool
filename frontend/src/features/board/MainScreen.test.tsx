import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MainScreen } from './MainScreen.tsx'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { mockApi, type Route } from '../../test/mockApi.ts'
import type { UserResponse } from '../../api/types.ts'

const BOARDS = [
  { id: 12, name: '学習計画', createdAt: '2026-09-20T01:00:00Z' },
  { id: 7, name: '個人タスク', createdAt: '2026-09-18T09:30:00Z' },
]

const BOARD_12 = {
  id: 12,
  name: '学習計画',
  lists: [
    {
      id: 3,
      name: 'TODO',
      position: 0,
      cards: [
        {
          id: 8,
          title: '要件定義を書く',
          description: '01〜01-5 を仕上げる',
          dueDate: '2026-09-30',
          isDone: false,
          position: 0,
        },
      ],
    },
    { id: 4, name: 'DOING', position: 1, cards: [] },
  ],
}

function baseRoutes(overrides: Route[] = []): Route[] {
  return [
    ...overrides,
    { path: '/boards', body: BOARDS },
    { path: '/trash/count', body: { count: 2 } },
    { path: '/boards/12', body: BOARD_12 },
    { path: '/boards/7', body: { id: 7, name: '個人タスク', lists: [] } },
  ]
}

function renderMainScreen(user: UserResponse, routes = baseRoutes()) {
  const fetchMock = mockApi(routes)
  renderWithProviders(<MainScreen user={user} />)
  return fetchMock
}

/** サイドバーのボードのボタン（表示エリアのボード名と紛れないよう nav の中で探す） */
async function findSidebarBoard(name: string) {
  const nav = await screen.findByRole('navigation', { name: 'ボード' })
  return within(nav).findByRole('button', { name })
}

/** 表示エリアの見出しにあるボード名（その場編集のボタン） */
async function findBoardNameButton() {
  const heading = await screen.findByRole('heading', { level: 2 })
  return within(heading).findByRole('button')
}

const USER_NO_LAST = { id: 1, username: 'taro_123', lastOpenedBoardId: null }
const USER_LAST_7 = { id: 1, username: 'taro_123', lastOpenedBoardId: 7 }

describe('S-01 サイドバー（05 画面設計書 4.2）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('ボードを一覧に出し、表示中のボードを示す', async () => {
    renderMainScreen(USER_NO_LAST)

    expect(await findSidebarBoard('学習計画')).toHaveAttribute('aria-current', 'page')
    expect(await findSidebarBoard('個人タスク')).not.toHaveAttribute('aria-current')
  })

  it('ゴミ箱の件数を出す', async () => {
    renderMainScreen(USER_NO_LAST)
    expect(await screen.findByRole('button', { name: '🗑 ゴミ箱 (2)' })).toBeInTheDocument()
  })

  it('ゴミ箱が0件でも (0) と出す（05 画面設計書 4.2 No.4）', async () => {
    renderMainScreen(USER_NO_LAST, baseRoutes([{ path: '/trash/count', body: { count: 0 } }]))
    expect(await screen.findByRole('button', { name: '🗑 ゴミ箱 (0)' })).toBeInTheDocument()
  })

  it('ボードが0件のときは案内を出す', async () => {
    renderMainScreen(USER_NO_LAST, baseRoutes([{ path: '/boards', body: [] }]))
    expect(await screen.findAllByText('ボードがありません。新しく作成しましょう')).not.toHaveLength(
      0,
    )
  })
})

describe('S-01 表示するボードの決定（F-15）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('最後に開いたボードが無ければ一覧の先頭を表示する', async () => {
    renderMainScreen(USER_NO_LAST)
    expect(await screen.findByLabelText('リスト TODO')).toBeInTheDocument()
  })

  it('最後に開いたボードがあればそれを表示する', async () => {
    renderMainScreen(USER_LAST_7)
    await waitFor(async () => {
      expect(await findSidebarBoard('個人タスク')).toHaveAttribute('aria-current', 'page')
    })
  })

  it('ボードを切り替えると、最後に開いたボードとして記録する', async () => {
    const fetchMock = renderMainScreen(USER_NO_LAST)

    await userEvent.click(await findSidebarBoard('個人タスク'))

    await waitFor(() => {
      const recorded = fetchMock.mock.calls.find(([url]) => url === '/api/me/last-opened-board')
      expect(recorded).toBeDefined()
      expect(recorded![1].body).toBe(JSON.stringify({ boardId: 7 }))
    })
  })
})

describe('S-01 表示エリア（05 画面設計書 4.3・4.4）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('リストを position 順に、カードをその中に出す', async () => {
    renderMainScreen(USER_NO_LAST)

    const lists = await screen.findAllByRole('region')
    expect(lists.map((l) => l.getAttribute('aria-label'))).toEqual(['リスト TODO', 'リスト DOING'])
    expect(screen.getByText('要件定義を書く')).toBeInTheDocument()
    expect(screen.getByText('01〜01-5 を仕上げる')).toBeInTheDocument()
    expect(screen.getByText('🕘 9/30')).toBeInTheDocument()
  })

  it('リストが0個のときは案内を出す', async () => {
    renderMainScreen(USER_LAST_7)
    expect(
      await screen.findByText('リストがありません。「＋ リストを追加」から作成しましょう'),
    ).toBeInTheDocument()
  })

  it('ボード名を押すとその場編集になり、変更すると PUT を呼ぶ', async () => {
    const fetchMock = renderMainScreen(
      USER_NO_LAST,
      baseRoutes([
        {
          method: 'PUT',
          path: '/boards/12',
          body: { id: 12, name: '学習計画（改訂）' },
        },
      ]),
    )

    await userEvent.click(await findBoardNameButton())
    const input = screen.getByLabelText('ボード名')
    await userEvent.clear(input)
    await userEvent.type(input, '学習計画（改訂）{Enter}')

    await waitFor(() => {
      const renamed = fetchMock.mock.calls.find(
        ([url, init]) => url === '/api/boards/12' && init.method === 'PUT',
      )
      expect(renamed).toBeDefined()
      expect(renamed![1].body).toBe(JSON.stringify({ name: '学習計画（改訂）' }))
    })
  })

  it('ボード名を変えずに確定したときは通信しない（業務ルール 5.5）', async () => {
    const fetchMock = renderMainScreen(USER_NO_LAST)

    await userEvent.click(await findBoardNameButton())
    await userEvent.type(screen.getByLabelText('ボード名'), '{Enter}')

    const renamed = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/boards/12' && init.method === 'PUT',
    )
    expect(renamed).toBeUndefined()
  })

  it('ボード名を空にすると知らせ、通信しない', async () => {
    const fetchMock = renderMainScreen(USER_NO_LAST)

    await userEvent.click(await findBoardNameButton())
    await userEvent.clear(screen.getByLabelText('ボード名'))
    await userEvent.type(screen.getByLabelText('ボード名'), '{Enter}')

    expect(screen.getByText('名前を入力してください')).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.find(([url, init]) => url === '/api/boards/12' && init.method === 'PUT'),
    ).toBeUndefined()
  })

  it('「ボードを削除」は確認を出さずゴミ箱へ移す（業務ルール 5.3）', async () => {
    const fetchMock = renderMainScreen(
      USER_NO_LAST,
      baseRoutes([{ method: 'DELETE', path: '/boards/12', status: 204 }]),
    )

    await userEvent.click(await screen.findByRole('button', { name: 'ボードを削除' }))

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.find(
          ([url, init]) => url === '/api/boards/12' && init.method === 'DELETE',
        ),
      ).toBeDefined()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
