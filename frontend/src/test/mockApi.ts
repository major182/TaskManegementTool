/**
 * テスト用に fetch を差し替える道具。
 * URL とメソッドの組み合わせごとに返す内容を決められるようにしている。
 */
import { vi } from 'vitest'

export type Route = {
  method?: string
  /** パス（/api は含めない。例：'/boards'） */
  path: string | RegExp
  status?: number
  body?: unknown
}

export function mockApi(routes: Route[]) {
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    const method = init?.method ?? 'GET'
    const path = url.replace(/^\/api/, '')
    const route = routes.find((r) => {
      if ((r.method ?? 'GET') !== method) return false
      return typeof r.path === 'string' ? r.path === path : r.path.test(path)
    })

    if (!route) {
      return Promise.resolve(new Response(null, { status: 404 }))
    }
    const status = route.status ?? 200
    if (route.body === undefined) {
      return Promise.resolve(new Response(null, { status }))
    }
    return Promise.resolve(
      new Response(JSON.stringify(route.body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export const USER = { id: 1, username: 'taro_123', lastOpenedBoardId: null }
