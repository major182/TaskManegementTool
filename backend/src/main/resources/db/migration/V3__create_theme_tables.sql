-- 背景テーマ（F-61〜66）のテーブル（docs/03_db-design.md 3.5・3.6・6.2）。
--
-- どちらも利用者1人につき最大1行なので、user_id をそのまま主キーにする。
-- テーマの行が無い利用者は「既定」として扱う（新規登録のたびに行を作らずに済む）。
--
-- 画像をテーマと別のテーブルにしているのは、テーマを読むたびに
-- 最大 5MB の画像まで読み込まないようにするため。

CREATE TABLE user_themes (
    user_id              BIGINT      PRIMARY KEY,
    theme_type           VARCHAR(10) NOT NULL,
    preset_key           VARCHAR(20),
    custom_sidebar_color CHAR(7),
    custom_board_color   CHAR(7),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_user_themes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_user_themes_type CHECK (theme_type IN ('DEFAULT', 'PRESET', 'CUSTOM', 'IMAGE')),
    CONSTRAINT ck_user_themes_preset_key
        CHECK (preset_key IS NULL OR preset_key IN ('sky', 'sunset', 'forest', 'night', 'stone')),
    CONSTRAINT ck_user_themes_preset_required CHECK (theme_type <> 'PRESET' OR preset_key IS NOT NULL),
    -- カスタムカラーの2色は、他の種類に切り替えても残す（次に開いたときの初期値にするため）。
    -- そのため「CUSTOM 以外なら NULL」という制約は付けない
    CONSTRAINT ck_user_themes_custom_required
        CHECK (theme_type <> 'CUSTOM' OR (custom_sidebar_color IS NOT NULL AND custom_board_color IS NOT NULL)),
    CONSTRAINT ck_user_themes_sidebar_color
        CHECK (custom_sidebar_color IS NULL OR custom_sidebar_color ~ '^#[0-9A-F]{6}$'),
    CONSTRAINT ck_user_themes_board_color
        CHECK (custom_board_color IS NULL OR custom_board_color ~ '^#[0-9A-F]{6}$')
);

CREATE TABLE user_background_images (
    user_id      BIGINT      PRIMARY KEY,
    content      BYTEA       NOT NULL,
    -- 送られてきた申告ではなく、ファイルの中身から判定した形式を入れる
    content_type VARCHAR(20) NOT NULL,
    size_bytes   INTEGER     NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_user_background_images_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_user_background_images_type
        CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT ck_user_background_images_size CHECK (size_bytes BETWEEN 1 AND 5242880)
);
