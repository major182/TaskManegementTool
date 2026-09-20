package com.example.taskboard.list;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskListRepository extends JpaRepository<TaskList, Long> {

    /** ボード表示用。左から右の順（docs/04_api-design.md 4.5）。 */
    List<TaskList> findByBoardIdAndDeletedAtIsNullOrderByPositionAsc(Long boardId);

    /**
     * 同じボードの、ゴミ箱に入っているリスト（削除した順）。
     * 並びを詰め直すときに、これらを末尾へ寄せるために使う（docs/03_db-design.md 5.3）。
     */
    List<TaskList> findByBoardIdAndDeletedAtIsNotNullOrderByDeletedAtAscIdAsc(Long boardId);

    /** 1件取得。ゴミ箱に入っているリストは操作できない。 */
    Optional<TaskList> findByIdAndDeletedAtIsNull(Long id);

    /** ゴミ箱の分も含めたボード内のリスト数。まだ使われていない position を求めるのに使う。 */
    int countByBoardId(Long boardId);

    /**
     * ゴミ箱に表示するリスト（削除日時の新しい順）。
     * 親のボードがゴミ箱に入っている場合は、親の1件として表示するので含めない
     * （docs/01-3_business-rules.md 5.3）。
     */
    @Query("""
            select l from TaskList l
            where l.deletedAt is not null
              and exists (select 1 from Board b
                          where b.id = l.boardId and b.userId = :userId and b.deletedAt is null)
            order by l.deletedAt desc
            """)
    List<TaskList> findTrashed(@Param("userId") Long userId);

    /** ゴミ箱から「元に戻す」「完全に削除」するときの1件取得。親のボードが生きていることも確認する。 */
    @Query("""
            select l from TaskList l
            where l.id = :id
              and l.deletedAt is not null
              and exists (select 1 from Board b
                          where b.id = l.boardId and b.userId = :userId and b.deletedAt is null)
            """)
    Optional<TaskList> findTrashedById(@Param("id") Long id, @Param("userId") Long userId);

    /**
     * ゴミ箱を空にするときに、ゴミ箱のリストをまとめて消す（F-44）。
     * 中のカードは外部キーの ON DELETE CASCADE で一緒に消える。
     */
    @Modifying
    @Query("""
            delete from TaskList l
            where l.deletedAt is not null
              and exists (select 1 from Board b
                          where b.id = l.boardId and b.userId = :userId and b.deletedAt is null)
            """)
    void deleteTrashed(@Param("userId") Long userId);
}
