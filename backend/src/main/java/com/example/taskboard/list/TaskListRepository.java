package com.example.taskboard.list;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

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
}
