package com.example.taskboard.theme;

/**
 * テーマの種類（docs/01-3_business-rules.md 5.7）。
 * DB には名前の文字列のまま保存する（user_themes.theme_type）。
 */
public enum ThemeType {
    /** 既定（サイドバー濃紺・表示エリア青）。 */
    DEFAULT,
    /** 5種類のテンプレートのどれか。 */
    PRESET,
    /** 利用者が指定した2色。 */
    CUSTOM,
    /** アップロードした背景画像。 */
    IMAGE
}
