import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.tsx'
import { renderWithProviders } from './test/renderWithProviders.tsx'

const NEW_USER = { id: 1, username: 'taro_123', lastOpenedBoardId: null }

/**
 * 新規登録したあとの流れを、実際の順番どおりに確かめる。
 * 登録するまでは /api/auth/me が 401、登録後は 200 を返すようにする。
 */
function mockSignupFlow() {
  let loggedIn = false
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    const method = init?.method ?? 'GET'
    const json = (status: number, body: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    if (url === '/api/auth/signup' && method === 'POST') {
      loggedIn = true
      return json(201, NEW_USER)
    }
    if (url === '/api/auth/me') {
      return loggedIn ? json(200, NEW_USER) : json(401, {})
    }
    if (url === '/api/boards') return json(200, [])
    if (url === '/api/trash/count') return json(200, { count: 0 })
    return json(404, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('新規登録のあとの画面遷移（業務ルール 5.6）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('登録に成功したら、そのままメイン画面（S-01）へ進む', async () => {
    mockSignupFlow()
    renderWithProviders(<App />)

    await userEvent.click(await screen.findByRole('button', { name: '新規登録はこちら' }))
    await userEvent.type(screen.getByLabelText('ユーザーID'), 'taro_123')
    await userEvent.type(screen.getByLabelText('パスワード'), 'pass1234')
    await userEvent.type(screen.getByLabelText('パスワード（確認用）'), 'pass1234')
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    // 確認画面を挟まず、そのままメイン画面が出る
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'ボード' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: '登録する' })).toBeNull()
  })
})
