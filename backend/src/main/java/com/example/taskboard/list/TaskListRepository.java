package com.example.taskboard.list;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskListRepository extends JpaRepository<TaskList, Long> {

    /** ボード表示用。左から右の順（docs/04_api-design.md 4.5）。 */
    List<TaskList> findByBoardIdAndDeletedAtIsNullOrderByPositionAsc(Long boardId);
}
