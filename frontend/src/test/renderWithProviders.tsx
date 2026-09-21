/** テストで画面を描くときの共通の入れ物。本番と同じ Provider を通す */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { ToastProvider } from '../components/ToastProvider.tsx'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // テストではリトライで待たされないようにする
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  queryClient: QueryClient = createTestQueryClient(),
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    )
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper }) }
}
