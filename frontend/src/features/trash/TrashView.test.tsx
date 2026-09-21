import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrashView } from './TrashView.tsx'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { mockApi, type Route } from '../../test/mockApi.ts'

const CARD_ITEM = {
  type: 'CARD' as const,
  id: 8,
  name: '要件定義を書く',
  originalLocation: '学習計画 ＞ TODO',
  deletedAt: '2026-09-20T03:00:00Z',
  restorable: true,
}

const LIST_ITEM = {
  type: 'LIST' as const,
  id: 4,
  name: 'DOING',
  originalLocation: '学習計画',
  deletedAt: '2026-09-19T10:00:00Z',
  restorable: true,
}

const BOARD_ITEM = {
  type: 'BOARD' as const,
  id: 7,
  name: '個人タスク',
  originalLocation: null,
  deletedAt: '2026-09-18T08:00:00Z',
  restorable: true,
}

const ITEMS = [CARD_ITEM, LIST_ITEM, BOARD_ITEM]

function render(overrides: Route[] = []) {
  const fetchMock = mockApi([...overrides, { path: '/trash', body: ITEMS }])
  renderWithProviders(<TrashView />)
  return fetchMock
}

function callOf(fetchMock: ReturnType<typeof mockApi>, url: string, method: string) {
  return fetchMock.mock.calls.find(([u, init]) => u === url && (init.method ?? 'GET') === method)
}

/** 名前でその行を探す */
async function findRow(name: string) {
  const cell = await screen.findByRole('cell', { name })
  // その行の中だけを探したいので、セルから行をたどる
  return cell.closest('tr') as HTMLElement
}

describe('ゴミ箱の表示（F-41・05 画面設計書 4.6）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('種類・名前・元の場所・削除日時を出す', async () => {
    render()

    const row = await findRow('要件定義を書く')
    const cells = within(row).getAllByRole('cell')
    expect(cells[0]).toHaveTextContent('カード')
    expect(cells[1]).toHaveTextContent('要件定義を書く')
    expect(cells[2]).toHaveTextContent('学習計画 ＞ TODO')
    // 2026-09-20T03:00:00Z は日本時間で 9/20 12:00
    expect(cells[3]).toHaveTextContent('9/20 12:00')
  })

  it('ボードの元の場所は「―」', async () => {
    render()

    const row = await findRow('個人タスク')
    expect(within(row).getAllByRole('cell')[2]).toHaveTextContent('―')
  })

  it('件数を見出しに出す', async () => {
    render()
    expect(await screen.findByRole('heading', { name: 'ゴミ箱 (3)' })).toBeInTheDocument()
  })

  it('0件のときは案内を出し、「ゴミ箱を空にする」を押せなくする', async () => {
    render([{ path: '/trash', body: [] }])

    expect(await screen.findByText('ゴミ箱は空です')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ゴミ箱を空にする' })).toBeDisabled()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('元に戻す（F-42）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('押すと POST /api/trash/{type}/{id}/restore を呼ぶ', async () => {
    const fetchMock = render([
      {
        method: 'POST',
        path: '/trash/cards/8/restore',
        body: { type: 'CARD', id: 8, listId: 3, position: 0, message: null },
      },
    ])

    const row = await findRow('要件定義を書く')
    await userEvent.click(within(row).getByRole('button', { name: '元に戻す' }))

    await waitFor(() => {
      expect(callOf(fetchMock, '/api/trash/cards/8/restore', 'POST')).toBeDefined()
    })
  })

  it('種類ごとに正しい URL を使う（リストは lists）', async () => {
    const fetchMock = render([
      {
        method: 'POST',
        path: '/trash/lists/4/restore',
        body: { type: 'LIST', id: 4, boardId: 12, position: 1, message: null },
      },
    ])

    const row = await findRow('DOING')
    await userEvent.click(within(row).getByRole('button', { name: '元に戻す' }))

    await waitFor(() => {
      expect(callOf(fetchMock, '/api/trash/lists/4/restore', 'POST')).toBeDefined()
    })
  })

  it('message があればお知らせを出す（元のリストが無かったとき）', async () => {
    render([
      {
        method: 'POST',
        path: '/trash/cards/8/restore',
        body: {
          type: 'CARD',
          id: 8,
          listId: 3,
          position: 0,
          message: '元のリストがないため、一番左のリストに戻しました',
        },
      },
    ])

    const row = await findRow('要件定義を書く')
    await userEvent.click(within(row).getByRole('button', { name: '元に戻す' }))

    expect(
      await screen.findByText('元のリストがないため、一番左のリストに戻しました'),
    ).toBeInTheDocument()
  })

  it('409 のときはサーバーの文言をそのまま出す', async () => {
    render([
      {
        method: 'POST',
        path: '/trash/lists/4/restore',
        status: 409,
        body: { status: 409, detail: '元のボードがないため戻せません' },
      },
    ])

    const row = await findRow('DOING')
    await userEvent.click(within(row).getByRole('button', { name: '元に戻す' }))

    expect(await screen.findByText('元のボードがないため戻せません')).toBeInTheDocument()
  })

  it('restorable が false のときは押せない状態にし、理由を title で出す', async () => {
    render([{ path: '/trash', body: [{ ...CARD_ITEM, restorable: false }] }])

    const row = await findRow('要件定義を書く')
    const button = within(row).getByRole('button', { name: '元に戻す' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', '元の場所がないため戻せません')
  })
})

describe('完全に削除（F-43・05 画面設計書 7章）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('確認するまで削除しない', async () => {
    const fetchMock = render([{ method: 'DELETE', path: '/trash/cards/8', status: 204 }])

    const row = await findRow('要件定義を書く')
    await userEvent.click(within(row).getByRole('button', { name: '完全に削除' }))

    expect(callOf(fetchMock, '/api/trash/cards/8', 'DELETE')).toBeUndefined()
  })

  it('種類ごとに文言を変える（カード）', async () => {
    render()

    const row = await findRow('要件定義を書く')
    await userEvent.click(within(row).getByRole('button', { name: '完全に削除' }))

    expect(
      screen.getByText('『要件定義を書く』を完全に削除します。元に戻せません。削除しますか？'),
    ).toBeInTheDocument()
  })

  it('種類ごとに文言を変える（リストは中のカードにも触れる）', async () => {
    render()

    const row = await findRow('DOING')
    await userEvent.click(within(row).getByRole('button', { name: '完全に削除' }))

    expect(
      screen.getByText('『DOING』と中のカードを完全に削除します。元に戻せません。削除しますか？'),
    ).toBeInTheDocument()
  })

  it('種類ごとに文言を変える（ボードはリスト・カードにも触れる）', async () => {
    render()

    const row = await findRow('個人タスク')
    await userEvent.click(within(row).getByRole('button', { name: '完全に削除' }))

    expect(
      screen.getByText(
        '『個人タスク』と中のリスト・カードを完全に削除します。元に戻せません。削除しますか？',
      ),
    ).toBeInTheDocument()
  })

  it('「完全に削除する」を押すと DELETE を呼ぶ', async () => {
    const fetchMock = render([{ method: 'DELETE', path: '/trash/cards/8', status: 204 }])

    const row = await findRow('要件定義を書く')
    await userEvent.click(within(row).getByRole('button', { name: '完全に削除' }))
    await userEvent.click(screen.getByRole('button', { name: '完全に削除する' }))

    await waitFor(() => {
      expect(callOf(fetchMock, '/api/trash/cards/8', 'DELETE')).toBeDefined()
    })
  })

  it('「キャンセル」を押すと削除しない', async () => {
    const fetchMock = render([{ method: 'DELETE', path: '/trash/cards/8', status: 204 }])

    const row = await findRow('要件定義を書く')
    await userEvent.click(within(row).getByRole('button', { name: '完全に削除' }))
    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(callOf(fetchMock, '/api/trash/cards/8', 'DELETE')).toBeUndefined()
  })

  it('誤って Enter を押しても削除しないよう、最初はキャンセルに焦点を置く', async () => {
    render()

    const row = await findRow('要件定義を書く')
    await userEvent.click(within(row).getByRole('button', { name: '完全に削除' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'キャンセル' })).toHaveFocus()
    })
  })
})

describe('ゴミ箱を空にする（F-44）', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('件数を入れた文言で確認する', async () => {
    render()

    await userEvent.click(await screen.findByRole('button', { name: 'ゴミ箱を空にする' }))

    expect(
      screen.getByText('ゴミ箱の3件をすべて完全に削除します。元に戻せません。削除しますか？'),
    ).toBeInTheDocument()
  })

  it('確認すると DELETE /api/trash を呼ぶ', async () => {
    const fetchMock = render([{ method: 'DELETE', path: '/trash', status: 204 }])

    await userEvent.click(await screen.findByRole('button', { name: 'ゴミ箱を空にする' }))
    await userEvent.click(screen.getByRole('button', { name: '完全に削除する' }))

    await waitFor(() => {
      expect(callOf(fetchMock, '/api/trash', 'DELETE')).toBeDefined()
    })
  })
})
