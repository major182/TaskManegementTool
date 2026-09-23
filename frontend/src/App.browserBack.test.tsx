import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.tsx'
import { renderWithProviders } from './test/renderWithProviders.tsx'
import { mockApi } from './test/mockApi.ts'

/**
 * jsdom には本物の履歴の積み下ろしが無いので、pushState / back を自分で持つ。
 * 「戻る」を押したときに popstate が起きる、という点だけを再現する。
 */
function installFakeHistory() {
  const stack: unknown[] = [{}]
  const history = {
    get state() {
      return stack[stack.length - 1]
    },
    pushState(state: unknown) {
      stack.push(state)
    },
    replaceState(state: unknown) {
      stack[stack.length - 1] = state
    },
    back() {
      if (stack.length > 1) stack.pop()
      window.dispatchEvent(new PopStateEvent('popstate'))
    },
    /** 履歴が空になっても back できてしまうと、アプリの外へ出たことになる */
    get depth() {
      return stack.length
    },
  }
  Object.defineProperty(window, 'history', {
    value: history,
    configurable: true,
    writable: true,
  })
  return history
}

describe('ブラウザの戻る（05 画面設計書 3章）', () => {
  let history: ReturnType<typeof installFakeHistory>

  beforeEach(() => {
    history = installFakeHistory()
    mockApi([
      { path: '/auth/me', status: 401, body: {} },
      { path: '/boards', body: [] },
      { path: '/trash/count', body: { count: 0 } },
    ])
  })

  afterEach(() => vi.unstubAllGlobals())

  it('新規登録画面へ移ると履歴を1つ積む', async () => {
    renderWithProviders(<App />)

    await userEvent.click(await screen.findByRole('button', { name: '新規登録はこちら' }))

    expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
    expect(history.depth).toBe(2)
  })

  it('戻るを押すとログイン画面へ戻り、アプリの外へ出ない', async () => {
    renderWithProviders(<App />)

    await userEvent.click(await screen.findByRole('button', { name: '新規登録はこちら' }))
    act(() => history.back())

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログイン' })).toBeVisible()
    })
    // アプリを開いたときの履歴が残っている＝外へ出ていない
    expect(history.depth).toBe(1)
  })

  it('「ログインはこちら」も戻ると同じ動きにし、履歴を積み増さない', async () => {
    renderWithProviders(<App />)

    await userEvent.click(await screen.findByRole('button', { name: '新規登録はこちら' }))
    await userEvent.click(screen.getByRole('button', { name: 'ログインはこちら' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログイン' })).toBeVisible()
    })
    expect(history.depth).toBe(1)
  })
})

describe('ログイン中のブラウザの戻る（Issue #31）', () => {
  let history: ReturnType<typeof installFakeHistory>

  const USER = { id: 1, username: 'taro_123', lastOpenedBoardId: null }

  beforeEach(() => {
    history = installFakeHistory()
    mockApi([
      { path: '/auth/me', body: USER },
      { path: '/boards', body: [] },
      { path: '/trash/count', body: { count: 0 } },
    ])
  })

  afterEach(() => vi.unstubAllGlobals())

  it('メイン画面を開くと履歴に目印を積む', async () => {
    renderWithProviders(<App />)

    // サイドバーのログアウトが出ていれば、メイン画面（S-01）が出ている
    expect(await screen.findByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    await waitFor(() => expect(history.depth).toBe(2))
  })

  it('戻るを押してもメイン画面のまま、アプリの外へ出ない', async () => {
    renderWithProviders(<App />)
    expect(await screen.findByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    await waitFor(() => expect(history.depth).toBe(2))

    act(() => history.back())

    // 画面が消えない（ログイン画面にも真っ白にもならない）
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'ログイン' })).not.toBeInTheDocument()
    // 目印を積み直しているので、続けて押しても外へ出ない
    expect(history.depth).toBe(2)
  })

  it('何度戻るを押してもアプリの中に留まる', async () => {
    renderWithProviders(<App />)
    expect(await screen.findByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    await waitFor(() => expect(history.depth).toBe(2))

    act(() => history.back())
    act(() => history.back())
    act(() => history.back())

    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    expect(history.depth).toBe(2)
  })
})
