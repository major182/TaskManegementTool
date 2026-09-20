package com.example.taskboard.board;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
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

import com.example.taskboard.auth.User;
import com.example.taskboard.auth.UserRepository;
import com.example.taskboard.board.BoardDtos.BoardDetailResponse;
import com.example.taskboard.card.Card;
import com.example.taskboard.card.CardRepository;
import com.example.taskboard.common.NotFoundException;
import com.example.taskboard.list.TaskList;
import com.example.taskboard.list.TaskListRepository;

/**
 * ボードの業務ルールの単体テスト。
 * 「他人のボードは 404」「ゴミ箱へ移動しても中身は触らない」を中心に確認する。
 */
@ExtendWith(MockitoExtension.class)
class BoardServiceTest {

    private static final Long USER_ID = 1L;
    private static final Long BOARD_ID = 12L;

    @Mock
    private BoardRepository boardRepository;

    @Mock
    private TaskListRepository taskListRepository;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private BoardService boardService;

    @Test
    void 他人のボードやゴミ箱のボードは見つからない扱いになる() {
        // リポジトリが「自分のもの・ゴミ箱でない」で絞るため、どちらの場合も空で返る
        when(boardRepository.findByIdAndUserIdAndDeletedAtIsNull(BOARD_ID, USER_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> boardService.findDetail(USER_ID, BOARD_ID))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("ボードが見つかりません");
    }

    @Test
    void ボード名は前後の空白を取り除いて保存する() {
        when(boardRepository.save(any(Board.class))).thenAnswer(i -> i.getArgument(0));

        boardService.create(USER_ID, "  学習計画  ");

        ArgumentCaptor<Board> saved = ArgumentCaptor.forClass(Board.class);
        verify(boardRepository).save(saved.capture());
        assertThat(saved.getValue().getName()).isEqualTo("学習計画");
        assertThat(saved.getValue().getUserId()).isEqualTo(USER_ID);
    }

    @Test
    void ゴミ箱へ移動してもリストとカードの削除日時は変えない() {
        Board board = new Board(USER_ID, "学習計画");
        when(boardRepository.findByIdAndUserIdAndDeletedAtIsNull(BOARD_ID, USER_ID))
                .thenReturn(Optional.of(board));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(new User("taro_123", "hash")));

        boardService.moveToTrash(USER_ID, BOARD_ID);

        assertThat(board.getDeletedAt()).isNotNull();
        // 中身には一切触らない（docs/03_db-design.md 1.1）
        verify(taskListRepository, never()).saveAll(any());
        verify(cardRepository, never()).saveAll(any());
    }

    @Test
    void ゴミ箱へ移動したボードは最後に開いたボードの記録から外す() {
        User user = new User("taro_123", "hash");
        user.setLastOpenedBoardId(BOARD_ID);
        when(boardRepository.findByIdAndUserIdAndDeletedAtIsNull(BOARD_ID, USER_ID))
                .thenReturn(Optional.of(new Board(USER_ID, "学習計画")));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        boardService.moveToTrash(USER_ID, BOARD_ID);

        assertThat(user.getLastOpenedBoardId()).isNull();
    }

    @Test
    void 他のボードを開いていた記録は消さない() {
        User user = new User("taro_123", "hash");
        user.setLastOpenedBoardId(99L);
        when(boardRepository.findByIdAndUserIdAndDeletedAtIsNull(BOARD_ID, USER_ID))
                .thenReturn(Optional.of(new Board(USER_ID, "学習計画")));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        boardService.moveToTrash(USER_ID, BOARD_ID);

        assertThat(user.getLastOpenedBoardId()).isEqualTo(99L);
    }

    @Test
    void リストが1つもないボードではカードを問い合わせない() {
        when(boardRepository.findByIdAndUserIdAndDeletedAtIsNull(BOARD_ID, USER_ID))
                .thenReturn(Optional.of(new Board(USER_ID, "学習計画")));
        when(taskListRepository.findByBoardIdAndDeletedAtIsNullOrderByPositionAsc(BOARD_ID))
                .thenReturn(List.of());

        BoardDetailResponse detail = boardService.findDetail(USER_ID, BOARD_ID);

        assertThat(detail.lists()).isEmpty();
        verify(cardRepository, never()).findByListIdInAndDeletedAtIsNullOrderByPositionAsc(anyCollection());
    }

    @Test
    void カードはリストごとに振り分けられ空のリストも欠けない() {
        TaskList todo = list(3L, "TODO", 0);
        TaskList doing = list(4L, "DOING", 1);
        when(boardRepository.findByIdAndUserIdAndDeletedAtIsNull(BOARD_ID, USER_ID))
                .thenReturn(Optional.of(new Board(USER_ID, "学習計画")));
        when(taskListRepository.findByBoardIdAndDeletedAtIsNullOrderByPositionAsc(BOARD_ID))
                .thenReturn(List.of(todo, doing));
        // カードは1回の問い合わせでまとめて返る（N+1 を避けるため）
        when(cardRepository.findByListIdInAndDeletedAtIsNullOrderByPositionAsc(List.of(3L, 4L)))
                .thenReturn(List.of(card(8L, 3L, "要件定義を書く", 0), card(9L, 3L, "DB設計", 1)));

        BoardDetailResponse detail = boardService.findDetail(USER_ID, BOARD_ID);

        assertThat(detail.lists()).hasSize(2);
        assertThat(detail.lists().get(0).cards()).extracting("id").containsExactly(8L, 9L);
        assertThat(detail.lists().get(1).cards()).isEmpty();
    }

    private TaskList list(Long id, String name, int position) {
        TaskList list = new TaskList(BOARD_ID, name, position);
        setId(list, id);
        return list;
    }

    private Card card(Long id, Long listId, String title, int position) {
        Card card = new Card(listId, title, position);
        setId(card, id);
        return card;
    }

    /** ID は DB が採番するため、テストでは反射で入れる。 */
    private void setId(Object target, Long id) {
        try {
            var field = target.getClass().getDeclaredField("id");
            field.setAccessible(true);
            field.set(target, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
