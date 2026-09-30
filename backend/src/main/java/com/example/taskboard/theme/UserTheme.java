package com.example.taskboard.theme;

import java.time.Instant;

import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 利用者のテーマ。user_themes テーブルに対応する（docs/03_db-design.md 3.5）。
 * 利用者1人につき最大1行。行が無い利用者は既定のテーマとして扱う。
 */
@Entity
@Table(name = "user_themes")
public class UserTheme {

    /** 主キー兼、利用者 ID。1人1行を主キーで保証する。 */
    @Id
    @Column(name = "user_id")
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "theme_type", nullable = false, length = 10)
    private ThemeType themeType;

    /** テンプレートの名前。PRESET のときだけ入る。実際の色は画面側で持つ。 */
    @Column(name = "preset_key", length = 20)
    private String presetKey;

    /**
     * カスタムカラーの2色（#RRGGBB）。
     * 他の種類に切り替えても消さず、次にカスタムカラーを開いたときの初期値にする
     * （docs/01-4_data-requirements.md 8.1）。
     * DB の型は CHAR(7)。columnDefinition を書かないと、起動時の定義チェックで
     * VARCHAR と食い違うと判定されるため明示する。
     */
    @Column(name = "custom_sidebar_color", columnDefinition = "bpchar(7)")
    private String customSidebarColor;

    @Column(name = "custom_board_color", columnDefinition = "bpchar(7)")
    private String customBoardColor;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** JPA が使う既定コンストラクタ。 */
    protected UserTheme() {
    }

    /** 初めてテーマを適用する利用者の行を作る。種類は直後の use〜 で決める。 */
    public UserTheme(Long userId) {
        this.userId = userId;
        this.themeType = ThemeType.DEFAULT;
    }

    /** 既定に戻す（F-65）。カスタムカラーは残す。 */
    public void useDefault() {
        this.themeType = ThemeType.DEFAULT;
        this.presetKey = null;
    }

    /** テンプレートを使う（F-62）。 */
    public void usePreset(String presetKey) {
        this.themeType = ThemeType.PRESET;
        this.presetKey = presetKey;
    }

    /** カスタムカラーを使う（F-63）。 */
    public void useCustom(String sidebarColor, String boardColor) {
        this.themeType = ThemeType.CUSTOM;
        this.presetKey = null;
        this.customSidebarColor = sidebarColor;
        this.customBoardColor = boardColor;
    }

    /** 背景画像を使う（F-64）。画像があるかどうかは Service で確かめてから呼ぶ。 */
    public void useImage() {
        this.themeType = ThemeType.IMAGE;
        this.presetKey = null;
    }

    public Long getUserId() {
        return userId;
    }

    public ThemeType getThemeType() {
        return themeType;
    }

    public String getPresetKey() {
        return presetKey;
    }

    public String getCustomSidebarColor() {
        return customSidebarColor;
    }

    public String getCustomBoardColor() {
        return customBoardColor;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
