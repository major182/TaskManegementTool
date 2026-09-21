import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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

/** 画面の、編集とは関係のない場所 */
async function clickOutside() {
  await userEvent.click(await screen.findByRole('heading', { level: 1 }))
}

describe('編集中に画面の関係ないところを押したとき（業務ルール 5.5）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('カードのその場編集が閉じる', async () => {
    render([{ method: 'PUT', path: '/cards/8', body: CARD_8 }])

    await userEvent.click(
      await screen.findByRole('button', { name: '要件定義を書く を編集' }),
    )
    expect(screen.getByLabelText('カードのタイトル')).toBeInTheDocument()

    await clickOutside()

    await waitFor(() => {
      expect(screen.queryByLabelText('カードのタイトル')).toBeNull()
    })
  })

  it('リスト名のその場編集が閉じる', async () => {
    render([{ method: 'PUT', path: '/lists/3', body: { id: 3, name: 'TODO' } }])

    const list = await screen.findByRole('region', { name: 'リスト TODO' })
    await userEvent.click(
      await within(list).findByRole('button', { name: 'TODO' }),
    )
    expect(screen.getByLabelText('リスト名')).toBeInTheDocument()

    await clickOutside()

    await waitFor(() => {
      expect(screen.queryByLabelText('リスト名')).toBeNull()
    })
  })

  it('ボード名のその場編集が閉じる', async () => {
    render([{ method: 'PUT', path: '/boards/12', body: { id: 12, name: '学習計画' } }])

    const heading = await screen.findByRole('heading', { level: 2 })
    await userEvent.click(within(heading).getByRole('button'))
    expect(screen.getByLabelText('ボード名')).toBeInTheDocument()

    await clickOutside()

    await waitFor(() => {
      expect(screen.queryByLabelText('ボード名')).toBeNull()
    })
  })
})
