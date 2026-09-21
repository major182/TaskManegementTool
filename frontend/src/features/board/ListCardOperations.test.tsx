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
  description: '01〜01-5 を仕上げる',
  dueDate: '2026-09-30',
  isDone: false,
  position: 0,
}

const BOARD_12 = {
  id: 12,
  name: '学習計画',
  lists: [
    { id: 3, name: 'TODO', position: 0, cards: [CARD_8] },
    { id: 4, name: 'DOING', position: 1, cards: [] },
  ],
}

function routes(overrides: Route[] = []): Route[] {
  return [
    ...overrides,
    { path: '/boards', body: [{ id: 12, name: '学習計画', createdAt: 'x' }] },
    { path: '/trash/count', body: { count: 0 } },
    { path: '/boards/12', body: BOARD_12 },
  ]
}

function render(overrides: Route[] = []) {
  const fetchMock = mockApi(routes(overrides))
  renderWithProviders(<MainScreen user={USER} />)
  return fetchMock
}

/** 指定した URL・メソッドの呼び出しを探す */
function callOf(fetchMock: ReturnType<typeof mockApi>, url: string, method: string) {
  return fetchMock.mock.calls.find(([u, init]) => u === url && (init.method ?? 'GET') === method)
}

async function findList(name: string) {
  return screen.findByRole('region', { name: `リスト ${name}` })
}

describe('リストの操作（F-21〜F-23）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('＋リストを追加で POST /api/boards/{id}/lists を呼ぶ', async () => {
    const fetchMock = render([
      {
        method: 'POST',
        path: '/boards/12/lists',
        status: 201,
        body: { id: 9, name: 'DONE', position: 2, cards: [] },
      },
    ])

    await userEvent.click(await screen.findByRole('button', { name: '＋ リストを追加' }))
    await userEvent.type(screen.getByLabelText('リスト名'), 'DONE')
    await userEvent.click(screen.getByRole('button', { name: '追加' }))

    await waitFor(() => {
      const call = callOf(fetchMock, '/api/boards/12/lists', 'POST')
      expect(call).toBeDefined()
      expect(call![1].body).toBe(JSON.stringify({ name: 'DONE' }))
    })
  })

  it('リスト名をその場編集すると PUT /api/lists/{id} を呼ぶ', async () => {
    const fetchMock = render([
      { method: 'PUT', path: '/lists/3', body: { id: 3, name: 'やること' } },
    ])

    const list = await findList('TODO')
    await userEvent.click(within(list).getByRole('button', { name: 'TODO' }))
    const input = screen.getByLabelText('リスト名')
    await userEvent.clear(input)
    await userEvent.type(input, 'やること{Enter}')

    await waitFor(() => {
      const call = callOf(fetchMock, '/api/lists/3', 'PUT')
      expect(call).toBeDefined()
      expect(call![1].body).toBe(JSON.stringify({ name: 'やること' }))
    })
  })

  it('リストの削除は確認を出さずゴミ箱へ移す', async () => {
    const fetchMock = render([{ method: 'DELETE', path: '/lists/3', status: 204 }])

    await userEvent.click(await screen.findByRole('button', { name: 'リスト TODO を削除' }))

    await waitFor(() => {
      expect(callOf(fetchMock, '/api/lists/3', 'DELETE')).toBeDefined()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('カードの操作（F-31〜F-33・F-38）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('＋カードで POST し、続けて追加できるよう入力欄は開いたまま', async () => {
    const fetchMock = render([
      {
        method: 'POST',
        path: '/lists/4/cards',
        status: 201,
        body: {
          id: 20,
          title: 'テストを書く',
          description: null,
          dueDate: null,
          isDone: false,
          position: 0,
        },
      },
    ])

    const list = await findList('DOING')
    await userEvent.click(within(list).getByRole('button', { name: '＋ カード' }))
    await userEvent.type(within(list).getByLabelText('カードのタイトル'), 'テストを書く')
    await userEvent.click(within(list).getByRole('button', { name: '追加' }))

    await waitFor(() => {
      const call = callOf(fetchMock, '/api/lists/4/cards', 'POST')
      expect(call).toBeDefined()
      expect(call![1].body).toBe(JSON.stringify({ title: 'テストを書く' }))
    })
    // 入力欄は開いたままで、中身は空になっている（05 画面設計書 4.3 No.7）
    const input = within(list).getByLabelText('カードのタイトル')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('チェックボックスは isDone だけ反転し、他の項目は今の値を送る', async () => {
    const fetchMock = render([
      { method: 'PUT', path: '/cards/8', body: { ...CARD_8, isDone: true } },
    ])

    await userEvent.click(await screen.findByRole('checkbox', { name: '要件定義を書く の完了' }))

    await waitFor(() => {
      const call = callOf(fetchMock, '/api/cards/8', 'PUT')
      expect(call).toBeDefined()
      expect(JSON.parse(call![1].body as string)).toEqual({
        title: '要件定義を書く',
        description: '01〜01-5 を仕上げる',
        dueDate: '2026-09-30',
        isDone: true,
      })
    })
  })

  it('チェックボックスを押してもその場編集は開かない（05 画面設計書 4.4）', async () => {
    render([{ method: 'PUT', path: '/cards/8', body: { ...CARD_8, isDone: true } }])

    await userEvent.click(await screen.findByRole('checkbox', { name: '要件定義を書く の完了' }))

    expect(screen.queryByLabelText('説明文')).toBeNull()
  })

  it('カードの削除は確認を出さずゴミ箱へ移す', async () => {
    const fetchMock = render([{ method: 'DELETE', path: '/cards/8', status: 204 }])

    await userEvent.click(await screen.findByRole('button', { name: '要件定義を書く を削除' }))

    await waitFor(() => {
      expect(callOf(fetchMock, '/api/cards/8', 'DELETE')).toBeDefined()
    })
  })
})

describe('カードのその場編集（05 画面設計書 4.5）', () => {
  afterEach(() => vi.unstubAllGlobals())

  async function openEditor() {
    await userEvent.click(await screen.findByRole('button', { name: '要件定義を書く を編集' }))
    return screen.getByLabelText('カードのタイトル')
  }

  it('カードを押すと編集状態になり、今の値が入っている', async () => {
    render()
    await openEditor()

    expect(screen.getByLabelText('カードのタイトル')).toHaveValue('要件定義を書く')
    expect(screen.getByLabelText('説明文')).toHaveValue('01〜01-5 を仕上げる')
    expect(screen.getByLabelText('期限日')).toHaveValue('2026-09-30')
  })

  it('確定すると4項目すべてを PUT で送る（04 API設計書 4.11）', async () => {
    const fetchMock = render([{ method: 'PUT', path: '/cards/8', body: CARD_8 }])

    const title = await openEditor()
    await userEvent.clear(title)
    await userEvent.type(title, '要件定義を仕上げる{Enter}')

    await waitFor(() => {
      const call = callOf(fetchMock, '/api/cards/8', 'PUT')
      expect(call).toBeDefined()
      expect(JSON.parse(call![1].body as string)).toEqual({
        title: '要件定義を仕上げる',
        description: '01〜01-5 を仕上げる',
        dueDate: '2026-09-30',
        isDone: false,
      })
    })
  })

  it('説明文の Enter は改行で、確定しない（業務ルール 5.5）', async () => {
    const fetchMock = render()
    await openEditor()

    const description = screen.getByLabelText('説明文')
    await userEvent.click(description)
    await userEvent.type(description, '{Enter}2行目')

    // 編集状態のままで、通信もしていない
    expect(screen.getByLabelText('説明文')).toHaveValue('01〜01-5 を仕上げる\n2行目')
    expect(callOf(fetchMock, '/api/cards/8', 'PUT')).toBeUndefined()
  })

  it('期限日の「×」で期限日を空にし、dueDate: null で送る（F-35）', async () => {
    const fetchMock = render([
      { method: 'PUT', path: '/cards/8', body: { ...CARD_8, dueDate: null } },
    ])

    await openEditor()
    await userEvent.click(screen.getByRole('button', { name: '期限日を消す' }))
    expect(screen.getByLabelText('期限日')).toHaveValue('')

    await userEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      const call = callOf(fetchMock, '/api/cards/8', 'PUT')
      expect(call).toBeDefined()
      expect(JSON.parse(call![1].body as string).dueDate).toBeNull()
    })
  })

  it('Esc は変更を破棄して表示に戻す', async () => {
    const fetchMock = render()
    const title = await openEditor()

    await userEvent.clear(title)
    await userEvent.type(title, '書き換えた{Escape}')

    await waitFor(() => {
      expect(screen.queryByLabelText('カードのタイトル')).toBeNull()
    })
    expect(callOf(fetchMock, '/api/cards/8', 'PUT')).toBeUndefined()
    expect(screen.getByText('要件定義を書く')).toBeInTheDocument()
  })

  it('「取消」も変更を破棄する', async () => {
    const fetchMock = render()
    const title = await openEditor()

    await userEvent.clear(title)
    await userEvent.type(title, '書き換えた')
    await userEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(callOf(fetchMock, '/api/cards/8', 'PUT')).toBeUndefined()
  })

  it('1文字も変わっていなければ通信しない（05 画面設計書 4.5）', async () => {
    const fetchMock = render()
    await openEditor()

    await userEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(screen.queryByLabelText('カードのタイトル')).toBeNull()
    })
    expect(callOf(fetchMock, '/api/cards/8', 'PUT')).toBeUndefined()
  })

  it('タイトルを空にすると知らせ、通信しない', async () => {
    const fetchMock = render()
    const title = await openEditor()

    await userEvent.clear(title)
    await userEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(screen.getByText('タイトルを入力してください')).toBeInTheDocument()
    expect(callOf(fetchMock, '/api/cards/8', 'PUT')).toBeUndefined()
  })
})

describe('通信に失敗したとき（F-04・05 画面設計書 8.1）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('画面を元に戻し、再試行つきのトーストを出す', async () => {
    render([{ method: 'DELETE', path: '/lists/3', status: 500, body: {} }])

    await userEvent.click(await screen.findByRole('button', { name: 'リスト TODO を削除' }))

    await waitFor(() => {
      expect(
        screen.getByText('保存できませんでした。通信の状態を確認して、もう一度お試しください'),
      ).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument()
    // 消えていたリストが戻っている
    expect(await findList('TODO')).toBeInTheDocument()
  })

  it('401 のときはログイン画面へ戻すため、保存失敗のトーストは出さない', async () => {
    render([{ method: 'DELETE', path: '/lists/3', status: 401, body: {} }])

    await userEvent.click(await screen.findByRole('button', { name: 'リスト TODO を削除' }))

    await waitFor(() => {
      expect(callOf(mockApiSpy(), '/api/lists/3', 'DELETE')).toBeDefined()
    })
    expect(
      screen.queryByText('保存できませんでした。通信の状態を確認して、もう一度お試しください'),
    ).toBeNull()
  })
})

/** vi.stubGlobal で差し替えた fetch を取り出す */
function mockApiSpy() {
  return globalThis.fetch as unknown as ReturnType<typeof mockApi>
}
