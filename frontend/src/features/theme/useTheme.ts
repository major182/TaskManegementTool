/**
 * 背景テーマの取得と保存（04 API設計書 4.17・4.18、05 画面設計書 4.7）。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/client.ts'
import { themeApi } from '../../api/endpoints.ts'
import type { Theme } from '../../api/types.ts'
import { queryKeys } from '../../app/queryKeys.ts'
import { useApiErrorNotifier } from '../../app/useApiErrorNotifier.ts'
import { useToast } from '../../components/toastContext.ts'
import { TOAST } from '../../messages.ts'
import { toUpdateRequest, type ThemeSelection } from './themeColors.ts'

/**
 * 今のテーマ。
 * 取得に失敗してもトーストは出さず、呼び出し側は既定のテーマで表示を続ける。
 * テーマが無くても作業はできるため（05 画面設計書 4.7「読み込みのタイミング」）。
 */
export function useTheme() {
  return useQuery<Theme>({
    queryKey: queryKeys.theme,
    queryFn: () => themeApi.get(),
    // 失敗しても作業に影響しないので、何度も取り直して待たせない
    retry: false,
  })
}

/**
 * テーマの保存（パネルの「適用」）。
 * 先に画面を切り替えてから通信し（楽観的更新）、失敗したら元のテーマに戻す。
 */
export function useUpdateTheme() {
  const queryClient = useQueryClient()
  const notifyError = useApiErrorNotifier()
  const showToast = useToast()

  return useMutation({
    mutationFn: (selection: ThemeSelection) => themeApi.update(toUpdateRequest(selection)),
    onMutate: async (selection) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.theme })
      const previous = queryClient.getQueryData<Theme>(queryKeys.theme)
      queryClient.setQueryData<Theme>(queryKeys.theme, applySelection(previous, selection))
      return { previous }
    },
    onError: (error, _selection, context) => {
      queryClient.setQueryData(queryKeys.theme, context?.previous)
      // 401 はログイン画面へ戻す共通の処理に任せる。それ以外はテーマ専用の文言（05 画面設計書 8.1）
      if (error instanceof ApiError && error.status === 401) {
        notifyError(error, { operation: 'save' })
        return
      }
      showToast({ kind: 'error', message: TOAST.themeSaveFailed })
    },
    onSuccess: (theme) => {
      queryClient.setQueryData(queryKeys.theme, theme)
    },
  })
}

/**
 * 保存前に画面を切り替えるため、選んだテーマを応答の形に当てはめる。
 * カスタムカラーと画像の情報は、種類を変えても残す（サーバーと同じ決まり）。
 */
function applySelection(previous: Theme | undefined, selection: ThemeSelection): Theme {
  return {
    type: selection.type,
    presetKey: selection.type === 'PRESET' ? selection.presetKey : null,
    customColors: selection.type === 'CUSTOM' ? selection.colors : (previous?.customColors ?? null),
    image: previous?.image ?? null,
  }
}
