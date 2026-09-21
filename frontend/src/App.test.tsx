import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.tsx'
import { renderWithProviders } from './test/renderWithProviders.tsx'
import { mockApi } from './test/mockApi.ts'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const LOGGED_IN_USER = { id: 1, username: 'taro_123', lastOpenedBoardId: null }

describe('アプリ起動時の画面の出し分け（05 画面設計書 3章）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('GET /api/auth/me が 401 ならログイン画面（S-02）を出す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(401, {}))),
    )
    renderWithProviders(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログイン' })).toBeVisible()
    })
  })

  it('GET /api/auth/me が 200 ならメイン画面（S-01）を出す', async () => {
    mockApi([
      { path: '/auth/me', body: LOGGED_IN_USER },
      { path: '/boards', body: [] },
      { path: '/trash/count', body: { count: 0 } },
    ])
    renderWithProviders(<App />)

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'ボード' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'ログイン' })).toBeNull()
  })

  it('/api/auth/me の返事を待つ間は読み込み中を出し、ログイン画面を見せない（05 画面設計書 9章）', async () => {
    // 返事が返らない状態を作り、待っている間の画面を確かめる
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    )
    renderWithProviders(<App />)

    expect(screen.getByText('読み込み中')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ログイン' })).toBeNull()
  })

  it('「新規登録はこちら」で S-03 に切り替わる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(401, {}))),
    )
    renderWithProviders(<App />)

    await userEvent.click(await screen.findByRole('button', { name: '新規登録はこちら' }))

    expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
  })
})
