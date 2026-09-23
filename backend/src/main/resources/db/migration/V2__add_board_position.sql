-- ボードの並び替え（F-16）のために、boards に並び順を追加する。
-- リスト・カードと同じ考え方で、利用者が並べた順を position（0 から）で持つ。
--
-- 一意制約を DEFERRABLE INITIALLY DEFERRED にしているのは、
-- 並び替えの途中で position が一時的に重なるため。判定はコミット時まで延期される
-- （docs/03_db-design.md 4.2）。

ALTER TABLE boards ADD COLUMN position INTEGER;

-- すでにあるボードには、これまでの表示順（作成日が新しい順）のまま番号を振る。
-- こうすると、この変更で利用者の画面の並びが変わらない。
-- ゴミ箱のボードは後ろへ回す（表示するものを前、ゴミ箱を後ろ、という決まりに合わせる）
WITH numbered AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id
               ORDER BY (deleted_at IS NOT NULL), created_at DESC, id DESC
           ) - 1 AS new_position
    FROM boards
)
UPDATE boards
SET position = numbered.new_position
FROM numbered
WHERE boards.id = numbered.id;

ALTER TABLE boards ALTER COLUMN position SET NOT NULL;

ALTER TABLE boards
    ADD CONSTRAINT uq_boards_user_position UNIQUE (user_id, position) DEFERRABLE INITIALLY DEFERRED;

-- サイドバーの一覧は position 順に引くため、その順で索引を作る
CREATE INDEX idx_boards_user_position ON boards (user_id, position);

-- 作成日順の索引は使わなくなった（一覧は position 順で引く）
DROP INDEX idx_boards_user_created;
