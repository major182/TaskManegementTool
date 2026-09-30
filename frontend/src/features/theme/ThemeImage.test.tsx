/**
 * 背景画像の画面の部品テスト（06 テスト仕様書 T-K「自動テストで確かめること」、05 画面設計書 4.7）。
 * アップロード・プレビュー・適用・削除と、形式・大きさの誤りの見せ方を確かめる。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MainScreen } from '../board/MainScreen.tsx'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { USER, mockApi, type Route } from '../../test/mockApi.ts'
import type { Theme } from '../../api/types.ts'

const NO_IMAGE: Theme = { type: 'DEFAULT', presetKey: null, customColors: null, image: null }
const IMAGE = { version: 1759200000000, contentType: 'image/png', sizeBytes: 1234 }
const WITH_IMAGE: Theme = { ...NO_IMAGE, image: IMAGE }

// accept 属性による絞り込みを外す。実際のブラウザでも「すべてのファイル」を選べば
// 対象外の形式を選べるため、その場合に画面側で断れることを確かめたい
const user = userEvent.setup({ applyAccept: false })

function renderScreen(theme: Theme, extra: Route[] = []) {
  const fetchMock = mockApi([
    ...extra,
    { path: '/boards', body: [] },
    { path: '/trash/count', body: { count: 0 } },
    { path: '/theme', body: theme },
  ])
  const view = renderWithProviders(<MainScreen user={USER} />)
  const screenRoot = () => view.container.firstElementChild as HTMLElement
  return { fetchMock, screenRoot }
}

async function openPanel() {
  await user.click(await screen.findByRole('button', { name: '🎨 テーマを変更' }))
  return screen.findByRole('dialog', { name: 'テーマを変更' })
}

function fileInput(panel: HTMLElement) {
  return panel.querySelector<HTMLInputElement>('input[type="file"]')!
}

function imageFile(name: string, type: string, size = 100) {
  return new File([new Uint8Array(size)], name, { type })
}

function calls(fetchMock: ReturnType<typeof mockApi>, method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([url, init]) => url === `/api${path}` && init?.method === method,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('背景画像', () => {
  it('画像を選ぶとアップロードして背景をプレビューし、適用で画像のテーマにする', async () => {
    const { fetchMock, screenRoot } = renderScreen(NO_IMAGE, [
      { method: 'PUT', path: '/theme/image', body: IMAGE },
      { method: 'PUT', path: '/theme', body: { ...WITH_IMAGE, type: 'IMAGE' } },
    ])
    const panel = await openPanel()
    expect(within(panel).getByRole('button', { name: '画像をアップロード' })).toBeInTheDocument()

    await user.upload(fileInput(panel), imageFile('photo.png', 'image/png'))

    // ファイルは FormData の file という項目で送る（04 API設計書 4.19）
    const [upload] = calls(fetchMock, 'PUT', '/theme/image')
    expect((upload[1].body as FormData).get('file')).toBeInstanceOf(File)
    // CSRF のために Content-Type を自分で付けず、ブラウザに任せる
    expect((upload[1].headers as Record<string, string>)['Content-Type']).toBeUndefined()

    // 表示エリアの背景が画像になり、サイドバーは既定のまま
    await waitFor(() =>
      expect(screenRoot().style.getPropertyValue('--board-image')).toBe(
        `url("/api/theme/image?v=${IMAGE.version}")`,
      ),
    )
    expect(screenRoot().style.getPropertyValue('--sidebar-bg')).toBe('')
    expect(within(panel).getByRole('button', { name: '背景画像' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(panel).getByRole('button', { name: '画像を変更' })).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: '適用' }))

    await waitFor(() => expect(calls(fetchMock, 'PUT', '/theme')).toHaveLength(1))
    expect(JSON.parse(String(calls(fetchMock, 'PUT', '/theme')[0][1].body))).toEqual({
      type: 'IMAGE',
    })
  })

  it('対象外の形式は送らずにパネルの中で知らせる', async () => {
    const { fetchMock } = renderScreen(NO_IMAGE)
    const panel = await openPanel()

    await user.upload(fileInput(panel), imageFile('anim.gif', 'image/gif'))

    expect(within(panel).getByRole('alert')).toHaveTextContent(
      'JPEG・PNG・WebP の画像を選んでください',
    )
    expect(calls(fetchMock, 'PUT', '/theme/image')).toHaveLength(0)
  })

  it('5MB を超える画像は送らずにパネルの中で知らせる', async () => {
    const { fetchMock } = renderScreen(NO_IMAGE)
    const panel = await openPanel()

    await user.upload(fileInput(panel), imageFile('big.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1))

    expect(within(panel).getByRole('alert')).toHaveTextContent('5MB 以下の画像を選んでください')
    expect(calls(fetchMock, 'PUT', '/theme/image')).toHaveLength(0)
  })

  it('サーバーが中身を見て断ったとき（400）も、同じ文言をパネルの中に出す', async () => {
    renderScreen(NO_IMAGE, [
      {
        method: 'PUT',
        path: '/theme/image',
        status: 400,
        body: { status: 400, detail: 'JPEG・PNG・WebP の画像を選んでください' },
      },
    ])
    const panel = await openPanel()

    // 拡張子と形式を偽ったファイル。画面側のチェックは通り、サーバーが断る
    await user.upload(fileInput(panel), imageFile('fake.jpg', 'image/jpeg'))

    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'JPEG・PNG・WebP の画像を選んでください',
    )
    expect(screen.queryByText('画像をアップロードできませんでした')).not.toBeInTheDocument()
  })

  it('通信エラーのときはトーストで知らせる', async () => {
    renderScreen(NO_IMAGE, [{ method: 'PUT', path: '/theme/image', status: 500 }])
    const panel = await openPanel()

    await user.upload(fileInput(panel), imageFile('photo.png', 'image/png'))

    expect(await screen.findByText('画像をアップロードできませんでした')).toBeInTheDocument()
  })

  it('画像があれば縮小表示し、押すとその画像をプレビューする', async () => {
    const { screenRoot } = renderScreen({ ...WITH_IMAGE, type: 'PRESET', presetKey: 'stone' })
    const panel = await openPanel()

    const thumbnail = within(panel).getByRole('button', { name: '背景画像' })
    expect(thumbnail.querySelector('img')).toHaveAttribute(
      'src',
      `/api/theme/image?v=${IMAGE.version}`,
    )

    await user.click(thumbnail)

    expect(screenRoot().style.getPropertyValue('--board-image')).toContain('/api/theme/image')
    expect(within(panel).getByRole('button', { name: '適用' })).toBeEnabled()
  })

  it('画像を削除するときは確認ダイアログを出し、キャンセルなら消さない', async () => {
    const { fetchMock } = renderScreen(WITH_IMAGE, [
      { method: 'DELETE', path: '/theme/image', status: 204 },
    ])
    const panel = await openPanel()

    await user.click(within(panel).getByRole('button', { name: '画像を削除' }))
    const dialog = await screen.findByRole('dialog', {
      name: '',
      hidden: true,
    })
    expect(
      within(dialog).getByText('背景画像を削除します。元に戻せません。削除しますか？'),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }))

    expect(calls(fetchMock, 'DELETE', '/theme/image')).toHaveLength(0)
    expect(screen.getByRole('dialog', { name: 'テーマを変更' })).toBeInTheDocument()
  })

  it('確認ダイアログを Esc で閉じても、パネルは閉じない', async () => {
    renderScreen(WITH_IMAGE)
    const panel = await openPanel()
    await user.click(within(panel).getByRole('button', { name: '画像を削除' }))
    expect(
      await screen.findByText('背景画像を削除します。元に戻せません。削除しますか？'),
    ).toBeInTheDocument()

    // ダイアログ自身が Esc で閉じる動きは、テスト用のブラウザ環境（jsdom）では再現されない。
    // ここでは、同じ Esc でパネルまで閉じてしまわないことだけを確かめる
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: 'テーマを変更' })).toBeInTheDocument()
  })

  it('背景に使っている画像を削除すると、既定に戻ってパネルは開いたまま', async () => {
    const { fetchMock, screenRoot } = renderScreen({ ...WITH_IMAGE, type: 'IMAGE' }, [
      { method: 'DELETE', path: '/theme/image', status: 204 },
    ])
    const panel = await openPanel()
    expect(screenRoot().style.getPropertyValue('--board-image')).toContain('/api/theme/image')

    await user.click(within(panel).getByRole('button', { name: '画像を削除' }))
    await user.click(await screen.findByRole('button', { name: '削除する' }))

    await waitFor(() => expect(calls(fetchMock, 'DELETE', '/theme/image')).toHaveLength(1))
    await waitFor(() => expect(screenRoot().style.getPropertyValue('--board-image')).toBe(''))
    expect(within(panel).getByRole('button', { name: '既定' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('dialog', { name: 'テーマを変更' })).toBeInTheDocument()
  })

  it('画像のテーマで開いたときは、ボード名の帯を濃くして文字を白にする', async () => {
    const { screenRoot } = renderScreen({ ...WITH_IMAGE, type: 'IMAGE' })

    await waitFor(() =>
      expect(screenRoot().style.getPropertyValue('--board-header-bg')).toBe('rgba(0, 0, 0, 0.35)'),
    )
    expect(screenRoot().style.getPropertyValue('--board-text')).toBe('#FFFFFF')
  })
})
