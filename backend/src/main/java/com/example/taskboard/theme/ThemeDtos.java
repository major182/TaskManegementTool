package com.example.taskboard.theme;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * テーマ API のリクエスト・レスポンス（docs/04_api-design.md 4.17・4.18）。
 * 入力のルールは docs/01-3_business-rules.md 5.7 に合わせる。
 */
public final class ThemeDtos {

    /** #RRGGBB（16進数6桁）。大文字・小文字どちらでも受け付け、保存するときに大文字へそろえる。 */
    private static final String COLOR_PATTERN = "^#[0-9A-Fa-f]{6}$";
    private static final String COLOR_MESSAGE = "色は #RRGGBB の形式で指定してください";

    private ThemeDtos() {
    }

    /**
     * テーマの変更（4.18）。
     * type と presetKey は文字列で受け取り、Service で確かめる。
     * enum で受け取ると、不正な値のときに JSON の読み取りの段階で失敗し、
     * 画面に出せる文言（「テーマの指定が正しくありません」）を返せないため。
     */
    public record ThemeUpdateRequest(
            String type,
            String presetKey,
            @Valid CustomColors customColors) {
    }

    /** カスタムカラーの2色。画面の R・G・B の数値は、送る前に #RRGGBB に変換される。 */
    public record CustomColors(
            @NotNull(message = COLOR_MESSAGE)
            @Pattern(regexp = COLOR_PATTERN, message = COLOR_MESSAGE)
            String sidebar,
            @NotNull(message = COLOR_MESSAGE)
            @Pattern(regexp = COLOR_PATTERN, message = COLOR_MESSAGE)
            String board) {
    }

    /**
     * テーマの取得・変更の応答（4.17）。
     * customColors と image は、type に関係なく保存されていれば返す。
     * パネルを開いたときの初期値・縮小表示に使うため。
     */
    public record ThemeResponse(
            ThemeType type,
            String presetKey,
            CustomColors customColors,
            ImageInfo image) {
    }

    /**
     * 背景画像の情報。画像の中身は含めない（大きいため）。
     * version はアップロード日時のミリ秒で、画面が画像の URL に ?v= として付け、
     * 置き換えたときにブラウザの古いキャッシュを使わせないようにする。
     */
    public record ImageInfo(long version, String contentType, int sizeBytes) {

        public static ImageInfo from(BackgroundImageRepository.Info info) {
            return new ImageInfo(info.getUpdatedAt().toEpochMilli(), info.getContentType(), info.getSizeBytes());
        }
    }
}
