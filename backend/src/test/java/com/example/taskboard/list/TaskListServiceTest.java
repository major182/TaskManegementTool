package com.example.taskboard.list;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.taskboard.board.Board;
import com.example.taskboard.board.BoardService;
import com.example.taskboard.common.BadRequestException;
import com.example.taskboard.common.NotFoundException;

/**
 * リストの業務ルールの単体テスト。
 * 並び替え・詰め直しのあとに position が 0 からの連番になることを重点的に確認する。
 */
@ExtendWith(MockitoExtension.class)
class TaskListServiceTest {

    private static final Long USER_ID = 1L;
    private static final Long BOARD_ID = 12L;

    @Mock
    private TaskListRepository taskListRepository;

    @Mock
    private BoardService boardService;

    @InjectMocks
    private TaskListService taskListService;

    @Test
    void 新しいリストは一番右に作られる() {
        when(taskListRepository.countByBoardId(BOARD_ID)).thenReturn(2);
        when(taskListRepository.save(any(TaskList.class))).thenAnswer(i -> i.getArgument(0));

        taskListService.create(USER_ID, BOARD_ID, "  DONE  ");

        ArgumentCaptor<TaskList> saved = ArgumentCaptor.forClass(TaskList.class);
        verify(taskListRepository).save(saved.capture());
        assertThat(saved.getValue().getPosition()).isEqualTo(2);
        assertThat(saved.getValue().getName()).isEqualTo("DONE");
    }

    @Test
    void 他人のボードにはリストを作れない() {
        when(boardService.requireOwned(USER_ID, BOARD_ID))
                .thenThrow(new NotFoundException("ボードが見つかりません"));

        assertThatThrownBy(() -> taskListService.create(USER_ID, BOARD_ID, "DONE"))
                .isInstanceOf(NotFoundException.class);

        verify(taskListRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void ゴミ箱のリストは操作できない() {
        when(taskListRepository.findByIdAndDeletedAtIsNull(3L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskListService.rename(USER_ID, 3L, "TODO"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("リストが見つかりません");
    }

    @Test
    void 親のボードが他人のものならリストにも届かない() {
        when(taskListRepository.findByIdAndDeletedAtIsNull(3L))
                .thenReturn(Optional.of(list(3L, "TODO", 0)));
        when(boardService.requireOwned(USER_ID, BOARD_ID))
                .thenThrow(new NotFoundException("ボードが見つかりません"));

        assertThatThrownBy(() -> taskListService.rename(USER_ID, 3L, "やること"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void 一番左へ動かすと他のリストが右へずれる() {
        TaskList todo = list(3L, "TODO", 0);
        TaskList doing = list(4L, "DOING", 1);
        TaskList done = list(5L, "DONE", 2);
        givenBoardHas(done, todo, doing, done);

        List<TaskList> moved = taskListService.move(USER_ID, 5L, 0);

        assertThat(moved).extracting(TaskList::getId).containsExactly(5L, 3L, 4L);
        assertThat(moved).extracting(TaskList::getPosition).containsExactly(0, 1, 2);
    }

    @Test
    void 一番右へ動かせる() {
        TaskList todo = list(3L, "TODO", 0);
        TaskList doing = list(4L, "DOING", 1);
        TaskList done = list(5L, "DONE", 2);
        givenBoardHas(todo, todo, doing, done);

        List<TaskList> moved = taskListService.move(USER_ID, 3L, 2);

        assertThat(moved).extracting(TaskList::getId).containsExactly(4L, 5L, 3L);
        assertThat(moved).extracting(TaskList::getPosition).containsExactly(0, 1, 2);
    }

    @Test
    void 同じ位置へ動かしても並びは変わらない() {
        TaskList todo = list(3L, "TODO", 0);
        TaskList doing = list(4L, "DOING", 1);
        givenBoardHas(doing, todo, doing);

        List<TaskList> moved = taskListService.move(USER_ID, 4L, 1);

        assertThat(moved).extracting(TaskList::getId).containsExactly(3L, 4L);
        assertThat(moved).extracting(TaskList::getPosition).containsExactly(0, 1);
    }

    @Test
    void リストの数を超える位置は指定できない() {
        TaskList todo = list(3L, "TODO", 0);
        TaskList doing = list(4L, "DOING", 1);
        givenBoardHas(todo, todo, doing);

        assertThatThrownBy(() -> taskListService.move(USER_ID, 3L, 2))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("指定された位置にはリストを置けません");
    }

    @Test
    void ゴミ箱へ移動すると残ったリストの並びが詰め直される() {
        TaskList todo = list(3L, "TODO", 0);
        TaskList doing = list(4L, "DOING", 1);
        TaskList done = list(5L, "DONE", 2);
        givenBoardHas(doing, todo, doing, done);

        taskListService.moveToTrash(USER_ID, 4L);

        assertThat(doing.getDeletedAt()).isNotNull();
        // 1 が抜けた穴を詰めて 0,1 に振り直す（docs/03_db-design.md 5.3）
        assertThat(todo.getPosition()).isEqualTo(0);
        assertThat(done.getPosition()).isEqualTo(1);
    }

    /** 操作対象のリストと、そのボードにあるリスト全部を用意する。 */
    private void givenBoardHas(TaskList target, TaskList... boardLists) {
        when(taskListRepository.findByIdAndDeletedAtIsNull(target.getId()))
                .thenReturn(Optional.of(target));
        when(taskListRepository.findByBoardIdAndDeletedAtIsNullOrderByPositionAsc(BOARD_ID))
                .thenReturn(List.of(boardLists));
        // 位置が範囲外で失敗する場合は詰め直しまで進まないため、使われないことを許す
        org.mockito.Mockito.lenient()
                .when(taskListRepository.findByBoardIdAndDeletedAtIsNotNullOrderByDeletedAtAscIdAsc(BOARD_ID))
                .thenReturn(List.of());
        when(boardService.requireOwned(USER_ID, BOARD_ID)).thenReturn(new Board(USER_ID, "学習計画", 0));
    }

    private TaskList list(Long id, String name, int position) {
        TaskList list = new TaskList(BOARD_ID, name, position);
        try {
            var field = TaskList.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(list, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        return list;
    }
}
