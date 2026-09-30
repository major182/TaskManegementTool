/**
 * テーマの色の定義と計算（docs/01-3_business-rules.md 5.7、05 画面設計書 4.7）。
 * 画面の部品から切り離し、計算だけを単体テストできるようにしている。
 */
import type { CSSProperties } from 'react'
import type { PresetKey, Theme, ThemeUpdateRequest } from '../../api/types.ts'

/** サイドバーとボード表示エリアの2色の組（ツートンカラー） */
export type ThemeColors = { sidebar: string; board: string }

/** 既定のテーマ（今の画面の濃紺と青）。tokens.css の --sidebar-bg・--board-bg と同じ値 */
export const DEFAULT_COLORS: ThemeColors = { sidebar: '#1D2B4F', board: '#0079BF' }

/**
 * テンプレート5種（業務ルール 5.7 の表）。
 * DB には名前だけを保存し、色はここで持つ（03 DB設計書 3.5）。
 */
export const PRESETS: readonly { key: PresetKey; label: string; colors: ThemeColors }[] = [
  { key: 'sky', label: '空', colors: { sidebar: '#0B3C5D', board: '#3DA5D9' } },
  { key: 'sunset', label: '夕焼け', colors: { sidebar: '#6B2D1F', board: '#E8804A' } },
  { key: 'forest', label: '森', colors: { sidebar: '#1E4428', board: '#6BA54A' } },
  { key: 'night', label: '夜', colors: { sidebar: '#1B1446', board: '#6A4FB8' } },
  { key: 'stone', label: '石', colors: { sidebar: '#2E3740', board: '#7A8A99' } },
]

/**
 * パネルで選んでいるテーマ。サーバーの応答（Theme）よりも単純な形にして、
 * 「今どれを選んでいるか」だけを表す。
 */
export type ThemeSelection =
  | { type: 'DEFAULT' }
  | { type: 'PRESET'; presetKey: PresetKey }
  | { type: 'CUSTOM'; colors: ThemeColors }
  | { type: 'IMAGE' }

/** サーバーの応答から、選んでいるテーマを取り出す */
export function toSelection(theme: Theme): ThemeSelection {
  switch (theme.type) {
    case 'PRESET':
      return theme.presetKey ? { type: 'PRESET', presetKey: theme.presetKey } : { type: 'DEFAULT' }
    case 'CUSTOM':
      return theme.customColors
        ? { type: 'CUSTOM', colors: theme.customColors }
        : { type: 'DEFAULT' }
    case 'IMAGE':
      return { type: 'IMAGE' }
    default:
      return { type: 'DEFAULT' }
  }
}

/** 選んでいるテーマを、PUT /api/theme の本文にする（04 API設計書 4.18） */
export function toUpdateRequest(selection: ThemeSelection): ThemeUpdateRequest {
  switch (selection.type) {
    case 'PRESET':
      return { type: 'PRESET', presetKey: selection.presetKey }
    case 'CUSTOM':
      return { type: 'CUSTOM', customColors: selection.colors }
    default:
      return { type: selection.type }
  }
}

/** 2つの選択が同じか（「適用」を押せるかどうかの判定に使う） */
export function isSameSelection(a: ThemeSelection, b: ThemeSelection): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
}

function normalize(selection: ThemeSelection): ThemeSelection {
  if (selection.type !== 'CUSTOM') return selection
  return {
    type: 'CUSTOM',
    colors: {
      sidebar: selection.colors.sidebar.toUpperCase(),
      board: selection.colors.board.toUpperCase(),
    },
  }
}

/**
 * 選んでいるテーマの2色。
 * 背景画像のときのサイドバーは既定の濃紺（業務ルール 5.7）。表示エリアの色は画像の下地になる。
 */
export function colorsOf(selection: ThemeSelection): ThemeColors {
  switch (selection.type) {
    case 'PRESET':
      return PRESETS.find((p) => p.key === selection.presetKey)?.colors ?? DEFAULT_COLORS
    case 'CUSTOM':
      return selection.colors
    default:
      return DEFAULT_COLORS
  }
}

// ---------- 色の変換 ----------

export type Rgb = { r: number; g: number; b: number }

/** '#1D2B4F' → { r: 29, g: 43, b: 79 } */
export function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

/** { r: 29, g: 43, b: 79 } → '#1D2B4F'（大文字にそろえる。サーバーの保存形式と同じ） */
export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/**
 * R・G・B の入力欄の文字を数値にする。0〜255 の整数でなければ null（業務ルール 5.7）。
 * 前後の空白は許すが、小数・符号・全角数字は受け付けない。
 */
export function parseChannel(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d{1,3}$/.test(trimmed)) return null
  const value = Number(trimmed)
  return value <= 255 ? value : null
}

// ---------- 文字色の自動切り替え ----------

/**
 * WCAG の相対輝度（0＝真っ黒、1＝真っ白）。
 * 人の目は緑を明るく、青を暗く感じるため、3色に違う重みを掛ける。
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255
    // 画面の色は明るさをそのまま数値にしていない（ガンマ補正）ため、光の量に戻してから計算する
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

/** 2色のコントラスト比（1〜21）。大きいほど見分けやすい */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** 白い文字を使うか。背景色と白・黒それぞれのコントラスト比を比べ、大きいほうを選ぶ（05 画面設計書 4.7） */
export function prefersLightText(background: string): boolean {
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#000000')
}

/**
 * テーマを画面に反映するための CSS 変数。メイン画面の一番外側の要素に渡す。
 *
 * 既定のテーマのときは何も上書きしない。tokens.css の値（文字色 #dfe4f0 など、
 * 計算では出てこない微妙な色）をそのまま使い、今の見た目を変えないため。
 */
export function themeStyle(selection: ThemeSelection): CSSProperties {
  if (selection.type === 'DEFAULT') return {}

  const { sidebar, board } = colorsOf(selection)
  const sidebarLight = prefersLightText(sidebar)
  const boardLight = prefersLightText(board)

  return {
    '--sidebar-bg': sidebar,
    '--sidebar-text': sidebarLight ? '#FFFFFF' : '#000000',
    // 選択中のボードの強調は、文字と同じ系統の半透明を重ねる。どんな背景色でも強調が見えるように
    '--sidebar-active': sidebarLight ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.14)',
    '--sidebar-hover': sidebarLight ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)',
    '--sidebar-divider': sidebarLight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
    '--board-bg': board,
    '--board-text': boardLight ? '#FFFFFF' : '#000000',
    '--board-overlay': boardLight ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.08)',
    '--board-overlay-hover': boardLight ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.14)',
  } as CSSProperties
}
