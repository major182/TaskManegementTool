package com.example.taskboard.card;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CardRepository extends JpaRepository<Card, Long> {

    /**
     * 複数のリストのカードをまとめて取得する（docs/04_api-design.md 4.5）。
     * リストごとに1回ずつ問い合わせると N+1 になるため、1回で引いて呼び出し側で振り分ける。
     */
    List<Card> findByListIdInAndDeletedAtIsNullOrderByPositionAsc(Collection<Long> listIds);

    /** リストの中の表示するカード（上から下の順）。 */
    List<Card> findByListIdAndDeletedAtIsNullOrderByPositionAsc(Long listId);

    /**
     * リストの中のゴミ箱に入っているカード（削除した順）。
     * 並びを詰め直すときに末尾へ寄せるために使う（docs/03_db-design.md 5.3）。
     */
    List<Card> findByListIdAndDeletedAtIsNotNullOrderByDeletedAtAscIdAsc(Long listId);

    /** 1件取得。ゴミ箱に入っているカードは操作できない。 */
    Optional<Card> findByIdAndDeletedAtIsNull(Long id);

    /** ゴミ箱の分も含めたリスト内のカード数。まだ使われていない position を求めるのに使う。 */
    int countByListId(Long listId);
}
