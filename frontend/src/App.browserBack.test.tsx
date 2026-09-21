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
