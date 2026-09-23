/**
 * ボード操作・読み込みが失敗したときの知らせ方（05 画面設計書 8.1、業務ルール 5.6）。
 * 以前は失敗しても何も出ず、セッション切れでもログイン画面へ戻らなかったため、
 * 直したうえでここで押さえておく（Issue #41 A-3〜A-5）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MainScreen } from './MainScreen.tsx'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { mockApi, type Route } from '../../test/mockApi.ts'
import { queryKeys } from '../../app/queryKeys.ts'

const BOARDS = [{ id: 12, name: '学習計画', createdAt: '2026-09-20T01:00:00Z' }]
const BOARD_12 = { id: 12, name: '学習計画', lists: [] }
const USER = { id: 1, username: 'taro_123', lastOpenedBoardId: null }

function baseRoutes(overrides: Route[] = []): Route[] {
  return [
    ...overrides,
    { path: '/boards', body: BOARDS },
    { path: '/trash/count', body: { count: 0 } },
    { path: '/boards/12', body: BOARD_12 },
  ]
}

function renderMainScreen(routes = baseRoutes()) {
  const fetchMock = mockApi(routes)
  const { queryClient } = renderWithProviders(<MainScreen user={USER} />)
  return { fetchMock, queryClient }
}

describe('ボード操作の失敗（05 画面設計書 8.1）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('ゴミ箱への移動に失敗したらトーストを出す', async () => {
    renderMainScreen(baseRoutes([{ method: 'DELETE', path: '/boards/12', status: 500 }]))

    await userEvent.click(await screen.findByRole('button', { name: 'ボードを削除' }))

    expect(
      await screen.findByText('保存できませんでした。通信の状態を確認して、もう一度お試しください'),
    ).toBeInTheDocument()
  })

  it('[再試行] を押すと、ページを読み込み直さずに同じ操作をやり直す', async () => {
    const { fetchMock } = renderMainScreen(
      baseRoutes([{ method: 'DELETE', path: '/boards/12', status: 500 }]),
    )

    await userEvent.click(await screen.findByRole('button', { name: 'ボードを削除' }))
    await userEvent.click(await screen.findByRole('button', { name: '再試行' }))

    // DELETE が2回（最初と再試行）呼ばれていれば、やり直せている
    await waitFor(() => {
      const deletes = fetchMock.mock.calls.filter(
        ([url, init]) => url === '/api/boards/12' && init?.method === 'DELETE',
      )
      expect(deletes).toHaveLength(2)
    })
  })

  it('セッションが切れていたら、トーストではなくログイン画面へ戻す', async () => {
    const { queryClient } = renderMainScreen(
      baseRoutes([{ method: 'DELETE', path: '/boards/12', status: 401 }]),
    )

    await userEvent.click(await screen.findByRole('button', { name: 'ボードを削除' }))

    // App がログイン画面（S-02）を出すための状態になっていること
    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.me)).toBeNull()
      expect(queryClient.getQueryData(queryKeys.sessionExpired)).toBe(true)
    })
  })

  it('読み込みに失敗したら、読み込みのエラーとして知らせる', async () => {
    renderMainScreen([
      { path: '/boards', status: 500, body: { detail: 'エラー' } },
      { path: '/trash/count', body: { count: 0 } },
    ])

    const toast = await screen.findByText('データを読み込めませんでした')
    expect(toast).toBeInTheDocument()
    // 読み込みの失敗は [再読み込み]（05 8.1）
    expect(await screen.findByRole('button', { name: '再読み込み' })).toBeInTheDocument()
  })

  it('読み込み中にセッションが切れていたら、ログイン画面へ戻す', async () => {
    const { queryClient } = renderMainScreen([
      { path: '/boards', status: 401, body: { detail: '期限切れ' } },
      { path: '/trash/count', body: { count: 0 } },
    ])

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.sessionExpired)).toBe(true)
    })
  })

  it('ボード名の変更に失敗したら、元の名前に戻してトーストを出す', async () => {
    renderMainScreen(baseRoutes([{ method: 'PUT', path: '/boards/12', status: 500 }]))

    const heading = await screen.findByRole('heading', { level: 2 })
    await userEvent.click(await within(heading).findByRole('button'))
    const input = await screen.findByLabelText('ボード名')
    await userEvent.clear(input)
    await userEvent.type(input, '新しい名前{Enter}')

    expect(
      await screen.findByText('保存できませんでした。通信の状態を確認して、もう一度お試しください'),
    ).toBeInTheDocument()
    await waitFor(async () => {
      const current = await screen.findByRole('heading', { level: 2 })
      expect(within(current).getByRole('button')).toHaveTextContent('学習計画')
    })
  })
})
