import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignupPage } from './SignupPage.tsx'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'

function mockFetch(response: Response) {
  const fn = vi.fn((_url: string, _init: RequestInit) => Promise.resolve(response))
  vi.stubGlobal('fetch', fn)
  return fn
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderSignupPage() {
  return renderWithProviders(<SignupPage onSwitchToLogin={() => {}} />)
}

describe('S-03 新規登録画面', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('入力欄を離れたときにユーザーID の形式を確かめる（業務ルール 5.1）', async () => {
    renderSignupPage()

    await userEvent.type(screen.getByLabelText('ユーザーID'), 'ab')
    await userEvent.tab()

    expect(
      screen.getByText('ユーザーID は半角英数字とアンダースコアで4〜20文字で入力してください'),
    ).toBeInTheDocument()
  })

  it('パスワードが一致しないときは登録せずに知らせる', async () => {
    const fetchMock = mockFetch(jsonResponse(201, {}))
    renderSignupPage()

    await userEvent.type(screen.getByLabelText('ユーザーID'), 'taro_123')
    await userEvent.type(screen.getByLabelText('パスワード'), 'pass1234')
    await userEvent.type(screen.getByLabelText('パスワード（確認用）'), 'pass9999')
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    expect(screen.getByText('パスワードが一致しません')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('確認用パスワードは API に送らない（05 画面設計書 6章）', async () => {
    const fetchMock = mockFetch(
      jsonResponse(201, {
        id: 1,
        username: 'taro_123',
        lastOpenedBoardId: null,
      }),
    )
    renderSignupPage()

    await userEvent.type(screen.getByLabelText('ユーザーID'), 'taro_123')
    await userEvent.type(screen.getByLabelText('パスワード'), 'pass1234')
    await userEvent.type(screen.getByLabelText('パスワード（確認用）'), 'pass1234')
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/auth/signup')
    expect(init.body).toBe(JSON.stringify({ username: 'taro_123', password: 'pass1234' }))
  })

  it('ユーザーID の重複（409）はユーザーID の欄に出す', async () => {
    mockFetch(
      jsonResponse(409, {
        status: 409,
        detail: 'このユーザーID は使われています',
      }),
    )
    renderSignupPage()

    await userEvent.type(screen.getByLabelText('ユーザーID'), 'taro_123')
    await userEvent.type(screen.getByLabelText('パスワード'), 'pass1234')
    await userEvent.type(screen.getByLabelText('パスワード（確認用）'), 'pass1234')
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('このユーザーID は使われています')).toBeInTheDocument()
    })
  })

  it('パスワードを再設定できない注意書きを常に出す（業務ルール 5.6）', () => {
    renderSignupPage()
    expect(screen.getByText(/パスワードを忘れるとデータを開けなくなります/)).toBeInTheDocument()
  })

  it('サーバーの入力チェック（400）は、該当の入力欄の下に出す（05 画面設計書 6章）', async () => {
    mockFetch(
      jsonResponse(400, {
        detail: '入力内容を確認してください',
        errors: [{ field: 'password', message: 'パスワードは8〜72文字で入力してください' }],
      }),
    )
    renderSignupPage()

    await userEvent.type(screen.getByLabelText('ユーザーID'), 'taro_123')
    await userEvent.type(screen.getByLabelText('パスワード'), 'pass1234')
    await userEvent.type(screen.getByLabelText('パスワード（確認用）'), 'pass1234')
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    // 項目ごとのメッセージが出て、まとめた「保存できませんでした」は出ない
    expect(await screen.findByText('パスワードは8〜72文字で入力してください')).toBeInTheDocument()
    expect(
      screen.queryByText('保存できませんでした。通信の状態を確認して、もう一度お試しください'),
    ).not.toBeInTheDocument()
  })
})
