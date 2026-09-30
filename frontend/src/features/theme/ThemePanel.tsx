/**
 * テーマ変更パネル（05 画面設計書 4.7）。
 *
 * 背景のプレビューを見ながら選べるよう、画面を覆わないパネルにしている。
 * 選んでいる間は onPreview で画面にだけ反映し、「適用」で初めて保存する（業務ルール 5.7）。
 */
import { useEffect, useRef, useState } from 'react'
import { backgroundImageUrl } from '../../api/endpoints.ts'
import type { BackgroundImageInfo, CustomColors } from '../../api/types.ts'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { CONFIRM, FIELD_ERROR, THEME } from '../../messages.ts'
import { ACCEPTED_IMAGE_TYPES, imageUploadMessage, validateImageFile } from './useTheme.ts'
import {
  DEFAULT_COLORS,
  PRESETS,
  colorsOf,
  hexToRgb,
  isSameSelection,
  parseChannel,
  rgbToHex,
  type Rgb,
  type ThemeColors,
  type ThemeSelection,
} from './themeColors.ts'
import styles from './ThemePanel.module.css'

type Props = {
  /** 開いたときのテーマ（保存済みのもの） */
  initial: ThemeSelection
  /** 保存済みのカスタムカラー。無ければ今表示している2色を初期値にする */
  savedCustomColors: CustomColors | null
  /** アップロード済みの背景画像。無ければ null */
  image: BackgroundImageInfo | null
  /** 画像を送る。形式・大きさの誤り（400・413）は例外として返す */
  onUploadImage: (file: File) => Promise<unknown>
  /** 画像を消す。確認ダイアログのあとで呼ばれる */
  onDeleteImage: () => Promise<unknown>
  onPreview: (selection: ThemeSelection) => void
  onApply: (selection: ThemeSelection) => void
  onCancel: () => void
}

type Area = keyof ThemeColors
type Channel = keyof Rgb
const CHANNELS: Channel[] = ['r', 'g', 'b']
const AREAS: { key: Area; label: string }[] = [
  { key: 'sidebar', label: THEME.sidebar },
  { key: 'board', label: THEME.board },
]

/** R・G・B の入力欄の文字。数字以外も入れられるようにし、エラーを入力欄の近くに出す */
type ChannelTexts = Record<Area, Record<Channel, string>>

/**
 * パネルを開くボタンに付ける目印。
 * ボタンを押したときに「パネルの外が押された」と扱わないようにするため。
 */
export const THEME_TOGGLE_ATTRIBUTE = 'data-theme-toggle'

export function ThemePanel({
  initial,
  savedCustomColors,
  image,
  onUploadImage,
  onDeleteImage,
  onPreview,
  onApply,
  onCancel,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const firstSwatchRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  // 確認ダイアログが開いている間は、Esc をダイアログのキャンセルだけに使う（パネルは閉じない）
  const isConfirmingRef = useRef(false)
  useEffect(() => {
    isConfirmingRef.current = isConfirmingDelete
  })
  const [selection, setSelection] = useState<ThemeSelection>(initial)
  const [texts, setTexts] = useState<ChannelTexts>(() =>
    toTexts(savedCustomColors ?? colorsOf(initial)),
  )

  // 最新の onCancel を effect から呼べるよう、毎回覚え直す（依存に入れると登録し直しになる）
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCancelRef.current = onCancel
  })

  // 開いたら最初の見本にフォーカスを置く
  useEffect(() => {
    firstSwatchRef.current?.focus()
  }, [])

  // Esc・パネルの外を押したらキャンセル（05 画面設計書 4.7「動き」）
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isConfirmingRef.current) onCancelRef.current()
    }
    function handlePointerDown(event: Event) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (panelRef.current?.contains(target)) return
      // 開くボタンは自分で閉じる（押した直後に外側扱いで閉じ、また開くのを防ぐ）
      if (target.closest(`[${THEME_TOGGLE_ATTRIBUTE}]`)) return
      onCancelRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [])

  const channelErrors = collectErrors(texts)
  const hasError = Object.values(channelErrors).some(Boolean)
  const canApply = !hasError && !isSameSelection(selection, initial)

  function choose(next: ThemeSelection) {
    setSelection(next)
    onPreview(next)
  }

  /** カラーピッカーで色を選んだ。数値の欄も同じ色に合わせる */
  function handlePicker(area: Area, hex: string) {
    const nextTexts = { ...texts, [area]: toChannelTexts(hexToRgb(hex)) }
    setTexts(nextTexts)
    chooseCustom(nextTexts)
  }

  /** R・G・B の数値を入れた。正しい値のときだけプレビューに反映する */
  function handleChannel(area: Area, channel: Channel, value: string) {
    const nextTexts = { ...texts, [area]: { ...texts[area], [channel]: value } }
    setTexts(nextTexts)
    chooseCustom(nextTexts)
  }

  function chooseCustom(nextTexts: ChannelTexts) {
    const colors = toColors(nextTexts)
    // 範囲外の数値があるときは、その色をプレビューに反映しない（05 画面設計書 4.7）
    if (colors) choose({ type: 'CUSTOM', colors })
  }

  /** 画像を選んだ。送る前に形式と大きさを確かめ、成功したらその画像をプレビューする */
  async function handleFile(file: File | undefined) {
    // 同じファイルを続けて選んでも change が起きるよう、選んだものを空に戻しておく
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    const invalid = validateImageFile(file)
    if (invalid) {
      setImageError(invalid)
      return
    }

    setImageError(null)
    setIsUploading(true)
    try {
      await onUploadImage(file)
      choose({ type: 'IMAGE' })
    } catch (error) {
      // 形式・大きさの誤りはパネルの中に出す。通信エラーなどはトーストで知らせ済み
      setImageError(imageUploadMessage(error))
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDeleteImage() {
    setIsConfirmingDelete(false)
    try {
      await onDeleteImage()
      // 画像を選んでいたら既定に戻す（サーバーも画像のテーマを既定に戻している）
      if (selection.type === 'IMAGE') choose({ type: 'DEFAULT' })
    } catch {
      // 失敗はトーストで知らせ済み。パネルはそのままにする
    }
  }

  const current = colorsOf(selection)

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby="theme-panel-title"
    >
      <div className={styles.header}>
        <h2 id="theme-panel-title" className={styles.title}>
          {THEME.panelTitle}
        </h2>
        <button type="button" className={styles.close} aria-label={THEME.close} onClick={onCancel}>
          ×
        </button>
      </div>

      <section className={styles.section} aria-label={THEME.templates}>
        <h3 className={styles.sectionTitle}>{THEME.templates}</h3>
        <div className={styles.swatches}>
          <Swatch
            ref={firstSwatchRef}
            label={THEME.defaultLabel}
            colors={DEFAULT_COLORS}
            selected={selection.type === 'DEFAULT'}
            onClick={() => choose({ type: 'DEFAULT' })}
          />
          {PRESETS.map((preset) => (
            <Swatch
              key={preset.key}
              label={preset.label}
              colors={preset.colors}
              selected={selection.type === 'PRESET' && selection.presetKey === preset.key}
              onClick={() => choose({ type: 'PRESET', presetKey: preset.key })}
            />
          ))}
        </div>
      </section>

      <section className={styles.section} aria-label={THEME.custom}>
        <h3 className={styles.sectionTitle}>{THEME.custom}</h3>
        {AREAS.map(({ key, label }) => {
          const pickerValue = toColors(texts)?.[key] ?? current[key]
          return (
            <div key={key} className={styles.customRow}>
              <span className={styles.customLabel}>{label}</span>
              <input
                type="color"
                className={styles.picker}
                aria-label={`${label}の色`}
                // <input type="color"> は小文字の #rrggbb しか受け付けない
                value={pickerValue.toLowerCase()}
                onChange={(e) => handlePicker(key, e.target.value)}
              />
              {CHANNELS.map((channel) => (
                <label key={channel} className={styles.channel}>
                  {channel.toUpperCase()}
                  <input
                    type="text"
                    inputMode="numeric"
                    className={styles.channelInput}
                    aria-label={`${label}の${channel.toUpperCase()}`}
                    aria-invalid={channelErrors[`${key}.${channel}`] ? true : undefined}
                    value={texts[key][channel]}
                    maxLength={3}
                    onChange={(e) => handleChannel(key, channel, e.target.value)}
                  />
                </label>
              ))}
            </div>
          )
        })}
        {hasError && (
          <p className={styles.error} role="alert">
            {FIELD_ERROR.colorChannel}
          </p>
        )}
      </section>

      <section className={styles.section} aria-label={THEME.image}>
        <h3 className={styles.sectionTitle}>{THEME.image}</h3>
        <div className={styles.imageRow}>
          {image && (
            <button
              type="button"
              className={`${styles.thumbnail} ${selection.type === 'IMAGE' ? styles.selected : ''}`}
              aria-label={THEME.image}
              aria-pressed={selection.type === 'IMAGE'}
              onClick={() => choose({ type: 'IMAGE' })}
            >
              <img
                src={backgroundImageUrl(image.version)}
                alt=""
                className={styles.thumbnailImage}
              />
            </button>
          )}
          <div className={styles.imageButtons}>
            <button
              type="button"
              className={styles.imageButton}
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? THEME.uploading : image ? THEME.change : THEME.upload}
            </button>
            {image && (
              <button
                type="button"
                className={styles.imageButton}
                disabled={isUploading}
                onClick={() => setIsConfirmingDelete(true)}
              >
                {THEME.deleteImage}
              </button>
            )}
          </div>
          {/* 画面には出さず、「画像をアップロード」から開く。accept は選ぶ画面の絞り込みで、最終判定はサーバー */}
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-label={THEME.upload}
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>
        <p className={styles.note}>{THEME.imageNote}</p>
        {imageError && (
          <p className={styles.error} role="alert">
            {imageError}
          </p>
        )}
      </section>

      {isConfirmingDelete && (
        <ConfirmDialog
          message={CONFIRM.deleteImage}
          executeLabel={CONFIRM.deleteLabel}
          onConfirm={() => void handleDeleteImage()}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}

      <div className={styles.footer}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          {THEME.cancel}
        </button>
        <button
          type="button"
          className={styles.apply}
          disabled={!canApply}
          onClick={() => onApply(selection)}
        >
          {THEME.apply}
        </button>
      </div>
    </div>
  )
}

/** テンプレートの見本。左半分をサイドバーの色、右半分を表示エリアの色で塗る */
function Swatch({
  ref,
  label,
  colors,
  selected,
  onClick,
}: {
  ref?: React.Ref<HTMLButtonElement>
  label: string
  colors: ThemeColors
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.swatch} ${selected ? styles.selected : ''}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span
        className={styles.swatchColors}
        style={{
          background: `linear-gradient(to right, ${colors.sidebar} 50%, ${colors.board} 50%)`,
        }}
        aria-hidden="true"
      />
      <span className={styles.swatchLabel}>{label}</span>
    </button>
  )
}

function toChannelTexts({ r, g, b }: Rgb): Record<Channel, string> {
  return { r: String(r), g: String(g), b: String(b) }
}

function toTexts(colors: ThemeColors): ChannelTexts {
  return {
    sidebar: toChannelTexts(hexToRgb(colors.sidebar)),
    board: toChannelTexts(hexToRgb(colors.board)),
  }
}

/** 入力欄の文字を2色にする。1つでも範囲外なら null */
function toColors(texts: ChannelTexts): ThemeColors | null {
  const sidebar = toRgb(texts.sidebar)
  const board = toRgb(texts.board)
  if (!sidebar || !board) return null
  return { sidebar: rgbToHex(sidebar), board: rgbToHex(board) }
}

function toRgb(channels: Record<Channel, string>): Rgb | null {
  const r = parseChannel(channels.r)
  const g = parseChannel(channels.g)
  const b = parseChannel(channels.b)
  if (r === null || g === null || b === null) return null
  return { r, g, b }
}

function collectErrors(texts: ChannelTexts): Record<string, boolean> {
  const errors: Record<string, boolean> = {}
  for (const { key } of AREAS) {
    for (const channel of CHANNELS) {
      errors[`${key}.${channel}`] = parseChannel(texts[key][channel]) === null
    }
  }
  return errors
}
