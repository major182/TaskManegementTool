import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NetworkError, readCsrfToken, request } from './client.ts'

/** fetch を差し替えて、実際の通信をせずに約束事だけを確かめる */
function mockFetch(response: Response | Error) {
  const fn = vi.fn((_url: string, _init: RequestInit) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('readCsrfToken', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })

  it('XSRF-TOKEN Cookie があれば読み取る', () => {
    document.cookie = 'XSRF-TOKEN=abc123'
    expect(readCsrfToken()).toBe('abc123')
  })

  it('Cookie が無ければ null', () => {
    expect(readCsrfToken()).toBeNull()
  })
})

describe('request', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })

  it('すべての通信に credentials: include を付ける（付けないと常に 401 になるため）', async () => {
    const fetchMock = mockFetch(jsonResponse(200, { id: 1 }))
    await request('GET', '/auth/me')

    const [, init] = fetchMock.mock.calls[0]!
    expect(init.credentials).toBe('include')
  })

  it('GET には X-XSRF-TOKEN を付けない', async () => {
    document.cookie = 'XSRF-TOKEN=token-1'
    const fetchMock = mockFetch(jsonResponse(200, []))
    await request('GET', '/boards')

    const [, init] = fetchMock.mock.calls[0]!
    expect(init.headers).not.toHaveProperty('X-XSRF-TOKEN')
  })

  it('GET 以外には Cookie の値を X-XSRF-TOKEN ヘッダーに入れる（04 API設計書 2.3）', async () => {
    document.cookie = 'XSRF-TOKEN=token-1'
    const fetchMock = mockFetch(jsonResponse(201, { id: 1 }))
    await request('POST', '/boards', { name: '学習計画' })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/boards')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': 'token-1',
    })
    expect(init.body).toBe(JSON.stringify({ name: '学習計画' }))
  })

  it('204 No Content のときは undefined を返す', async () => {
    mockFetch(new Response(null, { status: 204 }))
    await expect(request('DELETE', '/boards/1')).resolves.toBeUndefined()
  })

  it('ProblemDetail を ApiError に変換する', async () => {
    mockFetch(
      jsonResponse(400, {
        status: 400,
        detail: '入力内容を確認してください',
        errors: [{ field: 'name', message: '50文字以内で入力してください' }],
      }),
    )

    const error = await request('POST', '/boards', { name: 'x' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(400)
    expect(apiError.detail).toBe('入力内容を確認してください')
    expect(apiError.fieldMessage('name')).toBe('50文字以内で入力してください')
  })

  it('本文が JSON でないエラーでも status だけは拾う', async () => {
    mockFetch(new Response('<html>500</html>', { status: 500 }))

    const error = await request('GET', '/boards').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(500)
  })

  it('サーバーに届かなかったときは NetworkError', async () => {
    mockFetch(new TypeError('Failed to fetch'))

    const error = await request('GET', '/boards').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(NetworkError)
  })
})
