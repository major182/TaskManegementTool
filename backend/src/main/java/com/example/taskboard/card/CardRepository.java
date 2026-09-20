package com.example.taskboard.card;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    /**
     * ゴミ箱に表示するカード（削除日時の新しい順）。
     * 親のリスト・ボードがゴミ箱に入っている場合は、親の1件として表示するので含めない
     * （docs/01-3_business-rules.md 5.3）。
     */
    @Query("""
            select c from Card c
            where c.deletedAt is not null
              and exists (select 1 from TaskList l, Board b
                          where l.id = c.listId and l.deletedAt is null
                            and b.id = l.boardId and b.userId = :userId and b.deletedAt is null)
            order by c.deletedAt desc
            """)
    List<Card> findTrashed(@Param("userId") Long userId);

    /** ゴミ箱から「元に戻す」「完全に削除」するときの1件取得。親が生きていることも確認する。 */
    @Query("""
            select c from Card c
            where c.id = :id
              and c.deletedAt is not null
              and exists (select 1 from TaskList l, Board b
                          where l.id = c.listId and l.deletedAt is null
                            and b.id = l.boardId and b.userId = :userId and b.deletedAt is null)
            """)
    Optional<Card> findTrashedById(@Param("id") Long id, @Param("userId") Long userId);

    /** ゴミ箱を空にするときに、ゴミ箱のカードをまとめて消す（F-44）。 */
    @Modifying
    @Query("""
            delete from Card c
            where c.deletedAt is not null
              and exists (select 1 from TaskList l, Board b
                          where l.id = c.listId and l.deletedAt is null
                            and b.id = l.boardId and b.userId = :userId and b.deletedAt is null)
            """)
    void deleteTrashed(@Param("userId") Long userId);
}
