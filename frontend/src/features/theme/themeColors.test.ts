import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COLORS,
  PRESETS,
  colorsOf,
  contrastRatio,
  hexToRgb,
  isSameSelection,
  parseChannel,
  prefersLightText,
  rgbToHex,
  themeStyle,
  toSelection,
  toUpdateRequest,
} from './themeColors.ts'

describe('テンプレートの色（業務ルール 5.7）', () => {
  it('5種類が表のとおりの色で定義されている', () => {
    expect(PRESETS.map((p) => [p.key, p.colors.sidebar, p.colors.board])).toEqual([
      ['sky', '#0B3C5D', '#3DA5D9'],
      ['sunset', '#6B2D1F', '#E8804A'],
      ['forest', '#1E4428', '#6BA54A'],
      ['night', '#1B1446', '#6A4FB8'],
      ['stone', '#2E3740', '#7A8A99'],
    ])
  })

  it('背景画像のときのサイドバーは既定の濃紺', () => {
    expect(colorsOf({ type: 'IMAGE' })).toEqual(DEFAULT_COLORS)
  })
})

describe('色の変換', () => {
  it('#RRGGBB と R・G・B を行き来できる。16進数は大文字にそろえる', () => {
    expect(hexToRgb('#1D2B4F')).toEqual({ r: 29, g: 43, b: 79 })
    expect(rgbToHex({ r: 29, g: 43, b: 79 })).toBe('#1D2B4F')
    expect(rgbToHex({ r: 0, g: 10, b: 255 })).toBe('#000AFF')
  })

  it('R・G・B は 0〜255 の整数だけを受け付ける', () => {
    expect(parseChannel('0')).toBe(0)
    expect(parseChannel(' 255 ')).toBe(255)
    expect(parseChannel('256')).toBeNull()
    expect(parseChannel('-1')).toBeNull()
    expect(parseChannel('1.5')).toBeNull()
    expect(parseChannel('あ')).toBeNull()
    expect(parseChannel('')).toBeNull()
    expect(parseChannel('１２')).toBeNull()
  })
})

describe('文字色の自動切り替え（05 画面設計書 4.7）', () => {
  it('コントラスト比は白と黒で最大の 21 になる', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1)
  })

  it('濃い色の背景では白、明るい色の背景では黒を選ぶ', () => {
    expect(prefersLightText(DEFAULT_COLORS.sidebar)).toBe(true)
    expect(prefersLightText(DEFAULT_COLORS.board)).toBe(true)
    expect(prefersLightText('#FFF0C8')).toBe(false)
    expect(prefersLightText('#FFFFFF')).toBe(false)
  })

  it('既定のテーマでは変数を上書きしない（今の見た目を変えないため）', () => {
    expect(themeStyle({ type: 'DEFAULT' }, null)).toEqual({})
  })

  it('明るいカスタムカラーではサイドバーの文字を黒にする', () => {
    const style = themeStyle(
      { type: 'CUSTOM', colors: { sidebar: '#FFF0C8', board: '#1B1446' } },
      null,
    ) as Record<string, string>
    expect(style['--sidebar-bg']).toBe('#FFF0C8')
    expect(style['--sidebar-text']).toBe('#000000')
    expect(style['--board-text']).toBe('#FFFFFF')
  })

  it('背景画像のときは版番号付きの URL を敷き、サイドバーは既定のまま', () => {
    const style = themeStyle({ type: 'IMAGE' }, 1759200000000) as Record<string, string>
    expect(style['--board-image']).toBe('url("/api/theme/image?v=1759200000000")')
    expect(style['--board-text']).toBe('#FFFFFF')
    expect(style['--board-header-bg']).toBe('rgba(0, 0, 0, 0.35)')
    expect(style['--sidebar-bg']).toBeUndefined()
  })

  it('画像が無いのに画像のテーマになっていたら既定の見た目にする', () => {
    expect(themeStyle({ type: 'IMAGE' }, null)).toEqual({})
  })
})

describe('サーバーとの変換', () => {
  it('応答から選択を取り出し、選択から送る本文を作る', () => {
    const selection = toSelection({
      type: 'PRESET',
      presetKey: 'forest',
      customColors: { sidebar: '#000000', board: '#FFFFFF' },
      image: null,
    })
    expect(selection).toEqual({ type: 'PRESET', presetKey: 'forest' })
    expect(toUpdateRequest(selection)).toEqual({ type: 'PRESET', presetKey: 'forest' })
    expect(
      toUpdateRequest({ type: 'CUSTOM', colors: { sidebar: '#111111', board: '#222222' } }),
    ).toEqual({ type: 'CUSTOM', customColors: { sidebar: '#111111', board: '#222222' } })
    expect(toUpdateRequest({ type: 'DEFAULT' })).toEqual({ type: 'DEFAULT' })
  })

  it('カスタムカラーは大文字・小文字の違いを同じ色とみなす', () => {
    expect(
      isSameSelection(
        { type: 'CUSTOM', colors: { sidebar: '#abcdef', board: '#123456' } },
        { type: 'CUSTOM', colors: { sidebar: '#ABCDEF', board: '#123456' } },
      ),
    ).toBe(true)
    expect(isSameSelection({ type: 'DEFAULT' }, { type: 'PRESET', presetKey: 'sky' })).toBe(false)
  })
})
