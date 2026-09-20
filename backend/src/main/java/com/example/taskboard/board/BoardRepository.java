package com.example.taskboard.board;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BoardRepository extends JpaRepository<Board, Long> {

    /** サイドバー用の一覧。作成日の新しい順（docs/01-3_business-rules.md 5.2）。 */
    List<Board> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long userId);

    /**
     * 1件取得。「自分のものか」「ゴミ箱に入っていないか」を検索条件に含める。
     * 取得してから確認する形にすると確認漏れが起きるため、条件側で絞る。
     */
    Optional<Board> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);
}
