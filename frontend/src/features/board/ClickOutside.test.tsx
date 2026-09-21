import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MainScreen } from './MainScreen.tsx'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { mockApi, type Route } from '../../test/mockApi.ts'

const USER = { id: 1, username: 'taro_123', lastOpenedBoardId: 12 }

const CARD_8 = {
  id: 8,
  title: '要件定義を書く',
  description: null,
  dueDate: null,
  isDone: false,
  position: 0,
}

const BOARD_12 = {
  id: 12,
  name: '学習計画',
  lists: [{ id: 3, name: 'TODO', position: 0, cards: [CARD_8] }],
}

function render(overrides: Route[] = []) {
  const fetchMock = mockApi([
    ...overrides,
    { path: '/boards', body: [{ id: 12, name: '学習計画', createdAt: 'x' }] },
    { path: '/trash/count', body: { count: 0 } },
    { path: '/boards/12', body: BOARD_12 },
  ])
  renderWithProviders(<MainScreen user={USER} />)
  return fetchMock
}

/**
 * 画面の関係のない場所を「押す」。
 *
 * userEvent.click ではなく pointerdown だけを起こすのは、
 * 焦点が動かない状況（実ブラウザで編集が閉じなかったときの条件）でも
 * 閉じることを確かめたいため。blur 頼みの実装だとこのテストは通らない。
 */
function pressOutside() {
  fireEvent.pointerDown(screen.getByRole('heading', { level: 1 }))
}

describe('編集中に画面の関係ないところを押したとき（業務ルール 5.5）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('ボード名のその場編集が閉じる', async () => {
    render([{ method: 'PUT', path: '/boards/12', body: { id: 12, name: '学習計画' } }])

    const heading = await screen.findByRole('heading', { level: 2 })
    await userEvent.click(within(heading).getByRole('button'))
    expect(screen.getByLabelText('ボード名')).toBeInTheDocument()

    pressOutside()

    await waitFor(() => {
      expect(screen.queryByLabelText('ボード名')).toBeNull()
    })
  })

  it('リスト名のその場編集が閉じる', async () => {
    render([{ method: 'PUT', path: '/lists/3', body: { id: 3, name: 'TODO' } }])

    const list = await screen.findByRole('region', { name: 'リスト TODO' })
    await userEvent.click(within(list).getByRole('button', { name: 'TODO' }))
    expect(screen.getByLabelText('リスト名')).toBeInTheDocument()

    pressOutside()

    await waitFor(() => {
      expect(screen.queryByLabelText('リスト名')).toBeNull()
    })
  })

  it('カードのその場編集が閉じる', async () => {
    render([{ method: 'PUT', path: '/cards/8', body: CARD_8 }])

    await userEvent.click(await screen.findByRole('button', { name: '要件定義を書く を編集' }))
    expect(screen.getByLabelText('カードのタイトル')).toBeInTheDocument()

    pressOutside()

    await waitFor(() => {
      expect(screen.queryByLabelText('カードのタイトル')).toBeNull()
    })
  })

  it('「＋ カード」の入力欄が閉じる（プロトタイプには無かった動き）', async () => {
    render()

    const list = await screen.findByRole('region', { name: 'リスト TODO' })
    await userEvent.click(within(list).getByRole('button', { name: '＋ カード' }))
    expect(screen.getByLabelText('カードのタイトル')).toBeInTheDocument()

    pressOutside()

    await waitFor(() => {
      expect(screen.queryByLabelText('カードのタイトル')).toBeNull()
    })
  })

  it('「＋ リストを追加」の入力欄が閉じる', async () => {
    render()

    await userEvent.click(await screen.findByRole('button', { name: '＋ リストを追加' }))
    expect(screen.getByLabelText('リスト名')).toBeInTheDocument()

    pressOutside()

    await waitFor(() => {
      expect(screen.queryByLabelText('リスト名')).toBeNull()
    })
  })

  it('「＋ ボードを作成」の入力欄が閉じる', async () => {
    render()

    await userEvent.click(await screen.findByRole('button', { name: '＋ ボードを作成' }))
    expect(screen.getByLabelText('ボード名')).toBeInTheDocument()

    pressOutside()

    await waitFor(() => {
      expect(screen.queryByLabelText('ボード名')).toBeNull()
    })
  })

  it('入力欄の中を押したときは閉じない', async () => {
    render()

    await userEvent.click(await screen.findByRole('button', { name: '要件定義を書く を編集' }))
    fireEvent.pointerDown(screen.getByLabelText('説明文'))

    expect(screen.getByLabelText('カードのタイトル')).toBeInTheDocument()
  })

  it('外を押して閉じるとき、保存は1回しか呼ばない', async () => {
    const fetchMock = render([
      { method: 'PUT', path: '/cards/8', body: { ...CARD_8, title: '書き換えた' } },
    ])

    await userEvent.click(await screen.findByRole('button', { name: '要件定義を書く を編集' }))
    const title = screen.getByLabelText('カードのタイトル')
    await userEvent.clear(title)
    await userEvent.type(title, '書き換えた')

    pressOutside()

    await waitFor(() => {
      const saves = fetchMock.mock.calls.filter(
        ([url, init]) => url === '/api/cards/8' && init.method === 'PUT',
      )
      expect(saves).toHaveLength(1)
    })
  })
})
