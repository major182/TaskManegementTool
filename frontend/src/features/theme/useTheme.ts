/**
 * 背景テーマの取得と保存（04 API設計書 4.17〜4.21、05 画面設計書 4.7）。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/client.ts'
import { themeApi } from '../../api/endpoints.ts'
import type { Theme } from '../../api/types.ts'
import { queryKeys } from '../../app/queryKeys.ts'
import { useApiErrorNotifier } from '../../app/useApiErrorNotifier.ts'
import { useToast } from '../../components/toastContext.ts'
import { FIELD_ERROR, TOAST } from '../../messages.ts'
import { toUpdateRequest, type ThemeSelection } from './themeColors.ts'

/** 背景画像の上限（5MB。業務ルール 5.7）。送る前に画面側でも確かめる */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** 受け付ける画像の形式。最終的な判定はサーバーが中身で行う（04 API設計書 4.19） */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

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
  const notifyFailure = useThemeFailureNotifier()

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
      notifyFailure(error, TOAST.themeSaveFailed)
    },
    onSuccess: (theme) => {
      queryClient.setQueryData(queryKeys.theme, theme)
    },
  })
}

/**
 * 背景画像のアップロード（F-64）。テーマは切り替えない。
 *
 * 形式・大きさの誤り（400・413）はトーストではなくパネルの中に出すため、
 * ここでは知らせず、呼び出し側に例外として返す（imageUploadMessage で文言にする）。
 */
export function useUploadImage() {
  const queryClient = useQueryClient()
  const notifyFailure = useThemeFailureNotifier()

  return useMutation({
    mutationFn: (file: File) => themeApi.uploadImage(file),
    onSuccess: (image) => {
      // 新しい版番号をすぐ使えるよう、取り直しを待たずに書き換える
      queryClient.setQueryData<Theme>(queryKeys.theme, (previous) =>
        previous ? { ...previous, image } : previous,
      )
    },
    onError: (error) => {
      if (imageUploadMessage(error) !== null) return
      notifyFailure(error, TOAST.imageUploadFailed)
    },
  })
}

/**
 * 背景画像の削除（F-64）。
 * 画像をテーマに使っていたらサーバーが既定に戻すため、終わったらテーマを取り直す。
 */
export function useDeleteImage() {
  const queryClient = useQueryClient()
  const notifyFailure = useThemeFailureNotifier()

  return useMutation({
    mutationFn: () => themeApi.deleteImage(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.theme }),
    onError: (error) => notifyFailure(error, TOAST.imageDeleteFailed),
  })
}

/**
 * アップロードの失敗のうち、パネルの中に出すべきもの（形式・大きさの誤り）の文言。
 * それ以外（通信エラー・500 など）は null。
 */
export function imageUploadMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  if (error.status === 413) return FIELD_ERROR.imageSize
  if (error.status === 400) return FIELD_ERROR.imageType
  return null
}

/**
 * 送る前の確認（05 画面設計書 4.7）。問題が無ければ null。
 * ブラウザが付ける形式は偽れるが、うっかり違うファイルを選んだときに通信せず知らせるためのもの。
 */
export function validateImageFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return FIELD_ERROR.imageType
  if (file.size > MAX_IMAGE_BYTES) return FIELD_ERROR.imageSize
  return null
}

/**
 * テーマの操作に失敗したときの知らせ方。
 * 401 はログイン画面へ戻す共通の処理に任せ、それ以外は操作ごとの文言を出す（05 画面設計書 8.1）。
 */
function useThemeFailureNotifier() {
  const notifyError = useApiErrorNotifier()
  const showToast = useToast()

  return (error: unknown, message: string) => {
    if (error instanceof ApiError && error.status === 401) {
      notifyError(error, { operation: 'save' })
      return
    }
    showToast({ kind: 'error', message })
  }
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
