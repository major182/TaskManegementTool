package com.example.taskboard.list;

import java.util.Collection;
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

    /**
     * 指定したボードのうち、生きているリストを1つ以上持つものの ID。
     * ゴミ箱の「元に戻す」を押せるかの判定に使う（カードは戻す先のリストが要る）。
     * ボードごとに数えると件数分の問い合わせになるため、まとめて1回で引く。
     */
    @Query("""
            select distinct l.boardId from TaskList l
            where l.boardId in :boardIds and l.deletedAt is null
            """)
    List<Long> findBoardIdsHavingLiveList(@Param("boardIds") Collection<Long> boardIds);

    /** ゴミ箱の分も含めたボード内のリスト数。まだ使われていない position を求めるのに使う。 */
    int countByBoardId(Long boardId);

    /**
     * ゴミ箱に表示するリスト（削除日時の新しい順）。
     *
     * <p>親のボードがゴミ箱にあるかは見ない。親をゴミ箱へ移しても子の deletedAt は変えない
     * 決まりなので（docs/03_db-design.md 1.1）、deletedAt が入っているリスト＝利用者が自分で
     * 捨てたリストだけ。親が生きているかで絞ると、先に捨てたリストまで隠れてしまう。
     * なお「元のボードがゴミ箱にあるときは戻せない」の確認は TaskListService.restore で行う。
     */
    @Query("""
            select l from TaskList l
            where l.deletedAt is not null
              and exists (select 1 from Board b
                          where b.id = l.boardId and b.userId = :userId)
            order by l.deletedAt desc
            """)
    List<TaskList> findTrashed(@Param("userId") Long userId);

    /**
     * ゴミ箱から「元に戻す」「完全に削除」するときの1件取得。持ち主だけを確認する。
     * 元のボードが生きているかは、戻すときだけの決まりなので呼び出し側で確認する。
     */
    @Query("""
            select l from TaskList l
            where l.id = :id
              and l.deletedAt is not null
              and exists (select 1 from Board b
                          where b.id = l.boardId and b.userId = :userId)
            """)
    Optional<TaskList> findTrashedById(@Param("id") Long id, @Param("userId") Long userId);

    /**
     * ゴミ箱を空にするときに、ゴミ箱のリストをまとめて消す（F-44）。
     * 中のカードは外部キーの ON DELETE CASCADE で一緒に消える。
     * 一覧に出るものは空にしたら消えるべきなので、findTrashed と同じ条件にする。
     */
    @Modifying
    @Query("""
            delete from TaskList l
            where l.deletedAt is not null
              and exists (select 1 from Board b
                          where b.id = l.boardId and b.userId = :userId)
            """)
    void deleteTrashed(@Param("userId") Long userId);
}
