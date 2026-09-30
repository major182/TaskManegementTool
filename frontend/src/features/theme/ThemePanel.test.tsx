/**
 * テーマ変更パネルの部品テスト（06 テスト仕様書 T-K「自動テストで確かめること」）。
 * メイン画面ごと描いて、実際の利用者と同じ操作でプレビュー・適用・キャンセルを確かめる。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MainScreen } from '../board/MainScreen.tsx'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { USER, mockApi, type Route } from '../../test/mockApi.ts'
import type { Theme } from '../../api/types.ts'

const DEFAULT_THEME: Theme = { type: 'DEFAULT', presetKey: null, customColors: null, image: null }

function routes(theme: Theme, extra: Route[] = []): Route[] {
  return [
    ...extra,
    { path: '/boards', body: [] },
    { path: '/trash/count', body: { count: 0 } },
    { path: '/theme', body: theme },
  ]
}

function renderScreen(theme: Theme = DEFAULT_THEME, extra: Route[] = []) {
  const fetchMock = mockApi(routes(theme, extra))
  const view = renderWithProviders(<MainScreen user={USER} />)
  // テーマの色はメイン画面の一番外側の要素に CSS 変数として渡される
  const screenRoot = () => view.container.firstElementChild as HTMLElement
  return { fetchMock, screenRoot }
}

async function openPanel() {
  await userEvent.click(await screen.findByRole('button', { name: '🎨 テーマを変更' }))
  return screen.findByRole('dialog', { name: 'テーマを変更' })
}

function sentThemeBodies(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .filter(([url, init]) => url === '/api/theme' && init?.method === 'PUT')
    .map(([, init]) => JSON.parse(String(init.body)))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('テーマ変更パネル', () => {
  it('サイドバーのボタンで開き、今のテーマが選ばれている', async () => {
    renderScreen({ ...DEFAULT_THEME, type: 'PRESET', presetKey: 'night' })

    const panel = await openPanel()

    expect(within(panel).getByRole('button', { name: '夜' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(panel).getByRole('button', { name: '既定' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // 開いたら最初の見本にフォーカスを置く
    expect(within(panel).getByRole('button', { name: '既定' })).toHaveFocus()
  })

  it('テンプレートを押すとその場で画面に反映され、変更が無いうちは適用を押せない', async () => {
    const { screenRoot } = renderScreen()
    const panel = await openPanel()

    expect(within(panel).getByRole('button', { name: '適用' })).toBeDisabled()

    await userEvent.click(within(panel).getByRole('button', { name: '森' }))

    expect(screenRoot().style.getPropertyValue('--sidebar-bg')).toBe('#1E4428')
    expect(screenRoot().style.getPropertyValue('--board-bg')).toBe('#6BA54A')
    expect(within(panel).getByRole('button', { name: '適用' })).toBeEnabled()
  })

  it('キャンセルすると保存せずに元のテーマに戻る', async () => {
    const { fetchMock, screenRoot } = renderScreen()
    const panel = await openPanel()
    await userEvent.click(within(panel).getByRole('button', { name: '夕焼け' }))

    await userEvent.click(within(panel).getByRole('button', { name: 'キャンセル' }))

    expect(screen.queryByRole('dialog', { name: 'テーマを変更' })).not.toBeInTheDocument()
    expect(screenRoot().style.getPropertyValue('--sidebar-bg')).toBe('')
    expect(sentThemeBodies(fetchMock)).toEqual([])
    // 閉じたら開くボタンにフォーカスを戻す
    expect(screen.getByRole('button', { name: '🎨 テーマを変更' })).toHaveFocus()
  })

  it('Esc キーでもキャンセルできる', async () => {
    const { screenRoot } = renderScreen()
    const panel = await openPanel()
    await userEvent.click(within(panel).getByRole('button', { name: '空' }))

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'テーマを変更' })).not.toBeInTheDocument()
    expect(screenRoot().style.getPropertyValue('--sidebar-bg')).toBe('')
  })

  it('パネルの外を押してもキャンセルされる', async () => {
    renderScreen()
    const panel = await openPanel()
    await userEvent.click(within(panel).getByRole('button', { name: '空' }))

    await userEvent.click(screen.getByRole('heading', { name: 'タスク管理' }))

    expect(screen.queryByRole('dialog', { name: 'テーマを変更' })).not.toBeInTheDocument()
  })

  it('開いているときにボタンをもう一度押すと閉じる', async () => {
    renderScreen()
    await openPanel()

    await userEvent.click(screen.getByRole('button', { name: '🎨 テーマを変更' }))

    expect(screen.queryByRole('dialog', { name: 'テーマを変更' })).not.toBeInTheDocument()
  })

  it('適用するとテーマを保存してパネルを閉じる', async () => {
    const saved: Theme = { ...DEFAULT_THEME, type: 'PRESET', presetKey: 'stone' }
    const { fetchMock, screenRoot } = renderScreen(DEFAULT_THEME, [
      { method: 'PUT', path: '/theme', body: saved },
    ])
    const panel = await openPanel()
    await userEvent.click(within(panel).getByRole('button', { name: '石' }))

    await userEvent.click(within(panel).getByRole('button', { name: '適用' }))

    expect(screen.queryByRole('dialog', { name: 'テーマを変更' })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(sentThemeBodies(fetchMock)).toEqual([{ type: 'PRESET', presetKey: 'stone' }]),
    )
    expect(screenRoot().style.getPropertyValue('--sidebar-bg')).toBe('#2E3740')
  })

  it('カスタムカラーは R・G・B とカラーピッカーが連動し、#RRGGBB で送る', async () => {
    const { fetchMock, screenRoot } = renderScreen(DEFAULT_THEME, [
      { method: 'PUT', path: '/theme', body: DEFAULT_THEME },
    ])
    const panel = await openPanel()

    // 初期値は今表示している2色（既定）
    const r = within(panel).getByRole('textbox', { name: 'サイドバーのR' })
    expect(r).toHaveValue('29')

    await userEvent.clear(r)
    await userEvent.type(r, '255')
    const g = within(panel).getByRole('textbox', { name: 'サイドバーのG' })
    await userEvent.clear(g)
    await userEvent.type(g, '240')
    const b = within(panel).getByRole('textbox', { name: 'サイドバーのB' })
    await userEvent.clear(b)
    await userEvent.type(b, '200')

    expect(within(panel).getByLabelText('サイドバーの色')).toHaveValue('#fff0c8')
    // 明るい色なのでサイドバーの文字は黒になる（業務ルール 5.7）
    expect(screenRoot().style.getPropertyValue('--sidebar-bg')).toBe('#FFF0C8')
    expect(screenRoot().style.getPropertyValue('--sidebar-text')).toBe('#000000')
    // どのテンプレートも選ばれていない
    expect(within(panel).getByRole('button', { name: '既定' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await userEvent.click(within(panel).getByRole('button', { name: '適用' }))

    await waitFor(() =>
      expect(sentThemeBodies(fetchMock)).toEqual([
        { type: 'CUSTOM', customColors: { sidebar: '#FFF0C8', board: '#0079BF' } },
      ]),
    )
  })

  it('範囲外や数字以外を入れるとエラーを出し、適用を押せない', async () => {
    renderScreen()
    const panel = await openPanel()
    const r = within(panel).getByRole('textbox', { name: 'ボードのR' })

    await userEvent.clear(r)
    await userEvent.type(r, '256')

    expect(within(panel).getByRole('alert')).toHaveTextContent('0〜255 の数字で入力してください')
    expect(r).toHaveAttribute('aria-invalid', 'true')
    expect(within(panel).getByRole('button', { name: '適用' })).toBeDisabled()
  })

  it('保存済みのカスタムカラーがあれば、それを初期値にする', async () => {
    renderScreen({ ...DEFAULT_THEME, customColors: { sidebar: '#1E4428', board: '#6BA54A' } })
    const panel = await openPanel()

    expect(within(panel).getByRole('textbox', { name: 'サイドバーのR' })).toHaveValue('30')
    expect(within(panel).getByRole('textbox', { name: 'ボードのG' })).toHaveValue('165')
  })

  it('保存に失敗したらトーストを出して元のテーマに戻す', async () => {
    const { screenRoot } = renderScreen(DEFAULT_THEME, [
      { method: 'PUT', path: '/theme', status: 500 },
    ])
    const panel = await openPanel()
    await userEvent.click(within(panel).getByRole('button', { name: '夜' }))

    await userEvent.click(within(panel).getByRole('button', { name: '適用' }))

    expect(await screen.findByText('テーマを保存できませんでした')).toBeInTheDocument()
    await waitFor(() => expect(screenRoot().style.getPropertyValue('--sidebar-bg')).toBe(''))
  })

  it('テーマの取得に失敗しても、トーストは出さず既定のテーマで使える', async () => {
    const fetchMock = mockApi([
      { path: '/boards', body: [] },
      { path: '/trash/count', body: { count: 0 } },
      { path: '/theme', status: 500 },
    ])
    const view = renderWithProviders(<MainScreen user={USER} />)

    expect(await screen.findByRole('button', { name: '🎨 テーマを変更' })).toBeInTheDocument()
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url === '/api/theme')).toBe(true),
    )
    expect(screen.queryByText(/読み込めませんでした/)).not.toBeInTheDocument()
    expect(screen.queryByText(/保存できませんでした/)).not.toBeInTheDocument()
    expect(
      (view.container.firstElementChild as HTMLElement).style.getPropertyValue('--sidebar-bg'),
    ).toBe('')
  })
})
