package com.example.taskboard.board;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BoardRepository extends JpaRepository<Board, Long> {

    /** サイドバー用の一覧。利用者が並べた順（docs/01-3_business-rules.md 5.2）。 */
    List<Board> findByUserIdAndDeletedAtIsNullOrderByPositionAsc(Long userId);

    /**
     * ゴミ箱に入っているボード（削除した順）。
     * 並びを詰め直すときに末尾へ寄せるために使う（docs/03_db-design.md 5.3）。
     */
    List<Board> findByUserIdAndDeletedAtIsNotNullOrderByDeletedAtAscIdAsc(Long userId);

    /** ゴミ箱の分も含めた利用者のボード数。まだ使われていない position を求めるのに使う。 */
    int countByUserId(Long userId);

    /**
     * 1件取得。「自分のものか」「ゴミ箱に入っていないか」を検索条件に含める。
     * 取得してから確認する形にすると確認漏れが起きるため、条件側で絞る。
     */
    Optional<Board> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    /** リストを戻せるかの判定用。ゴミ箱に入っているかは問わず、自分のボードかだけを見る。 */
    boolean existsByIdAndUserId(Long id, Long userId);

    /** ゴミ箱のボード（削除日時の新しい順。docs/04_api-design.md 4.14）。 */
    List<Board> findByUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(Long userId);

    /** ゴミ箱から「元に戻す」「完全に削除」するときの1件取得。 */
    Optional<Board> findByIdAndUserIdAndDeletedAtIsNotNull(Long id, Long userId);
}
