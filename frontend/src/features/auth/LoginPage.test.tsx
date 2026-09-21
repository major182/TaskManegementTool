import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from './LoginPage.tsx'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'

function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  const fn = vi.fn((url: string, init: RequestInit) => Promise.resolve(handler(url, init)))
  vi.stubGlobal('fetch', fn)
  return fn
}

function renderLoginPage(sessionExpired = false) {
  return renderWithProviders(
    <LoginPage onSwitchToSignup={() => {}} sessionExpired={sessionExpired} />,
  )
}

describe('S-02 ログイン画面', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('未入力のまま送信しても通信せず、入力を促す（05 画面設計書 5章）', async () => {
    const fetchMock = mockFetch(() => new Response(null, { status: 200 }))
    renderLoginPage()

    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(screen.getByText('ユーザーID を入力してください')).toBeInTheDocument()
    expect(screen.getByText('パスワードを入力してください')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('認証失敗（401）はどちらが違うか書かずにフォーム上部へ出す（業務ルール 5.6）', async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            status: 401,
            detail: 'ユーザーID またはパスワードが違います',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    renderLoginPage()

    await userEvent.type(screen.getByLabelText('ユーザーID'), 'taro_123')
    await userEvent.type(screen.getByLabelText('パスワード'), 'wrongpass1')
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('ユーザーID またはパスワードが違います')
    })
    // 入力欄ごとのエラーは出さず、まとめた1件だけを出す
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('入力して送信すると POST /api/auth/login を呼ぶ', async () => {
    const fetchMock = mockFetch(
      () =>
        new Response(
          JSON.stringify({
            id: 1,
            username: 'taro_123',
            lastOpenedBoardId: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    renderLoginPage()

    await userEvent.type(screen.getByLabelText('ユーザーID'), 'taro_123')
    await userEvent.type(screen.getByLabelText('パスワード'), 'pass1234')
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/auth/login')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.body).toBe(JSON.stringify({ username: 'taro_123', password: 'pass1234' }))
  })

  it('パスワードは伏せ字で表示する（業務ルール 5.1）', () => {
    renderLoginPage()
    expect(screen.getByLabelText('パスワード')).toHaveAttribute('type', 'password')
  })

  it('セッション切れで戻ってきたときは期限切れのお知らせを出す', () => {
    renderLoginPage(true)
    expect(
      screen.getByText('ログインの有効期限が切れました。もう一度ログインしてください'),
    ).toBeInTheDocument()
  })
})
