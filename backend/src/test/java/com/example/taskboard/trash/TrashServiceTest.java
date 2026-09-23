package com.example.taskboard.trash;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.taskboard.board.Board;
import com.example.taskboard.board.BoardRepository;
import com.example.taskboard.board.BoardService;
import com.example.taskboard.card.Card;
import com.example.taskboard.card.CardService;
import com.example.taskboard.list.TaskList;
import com.example.taskboard.list.TaskListRepository;
import com.example.taskboard.list.TaskListService;
import com.example.taskboard.trash.TrashDtos.TrashItemResponse;
import com.example.taskboard.trash.TrashDtos.TrashType;

/**
 * ゴミ箱の単体テスト。
 * 3種類をまとめて削除日時の新しい順に並べること、「元の場所」の文字列を確認する。
 */
@ExtendWith(MockitoExtension.class)
class TrashServiceTest {

    private static final Long USER_ID = 1L;
    private static final Long BOARD_ID = 12L;

    @Mock
    private BoardService boardService;

    @Mock
    private TaskListService taskListService;

    @Mock
    private CardService cardService;

    @Mock
    private BoardRepository boardRepository;

    @Mock
    private TaskListRepository taskListRepository;

    @InjectMocks
    private TrashService trashService;

    @Test
    void ボードとリストとカードをまとめて削除日時の新しい順に並べる() {
        Board board = board(7L, "個人タスク", Instant.parse("2026-09-18T08:00:00Z"));
        TaskList list = list(4L, "DOING", Instant.parse("2026-09-19T10:00:00Z"));
        Card card = card(8L, 3L, "要件定義を書く", Instant.parse("2026-09-20T03:00:00Z"));
        TaskList parentOfCard = list(3L, "TODO", null);

        when(boardService.findTrashed(USER_ID)).thenReturn(List.of(board));
        when(taskListService.findTrashed(USER_ID)).thenReturn(List.of(list));
        when(cardService.findTrashed(USER_ID)).thenReturn(List.of(card));
        when(taskListRepository.findAllById(List.of(3L))).thenReturn(List.of(parentOfCard));
        when(boardRepository.findAllById(List.of(BOARD_ID)))
                .thenReturn(List.of(board(BOARD_ID, "学習計画", null)));

        List<TrashItemResponse> items = trashService.findAll(USER_ID);

        assertThat(items).extracting(TrashItemResponse::type)
                .containsExactly(TrashType.CARD, TrashType.LIST, TrashType.BOARD);
        assertThat(items).extracting(TrashItemResponse::restorable).containsOnly(true);
    }

    @Test
    void 元の場所は種類ごとに出し分ける() {
        Board board = board(7L, "個人タスク", Instant.parse("2026-09-18T08:00:00Z"));
        TaskList list = list(4L, "DOING", Instant.parse("2026-09-19T10:00:00Z"));
        Card card = card(8L, 3L, "要件定義を書く", Instant.parse("2026-09-20T03:00:00Z"));

        when(boardService.findTrashed(USER_ID)).thenReturn(List.of(board));
        when(taskListService.findTrashed(USER_ID)).thenReturn(List.of(list));
        when(cardService.findTrashed(USER_ID)).thenReturn(List.of(card));
        when(taskListRepository.findAllById(List.of(3L))).thenReturn(List.of(list(3L, "TODO", null)));
        when(boardRepository.findAllById(List.of(BOARD_ID)))
                .thenReturn(List.of(board(BOARD_ID, "学習計画", null)));

        List<TrashItemResponse> items = trashService.findAll(USER_ID);

        // カードは「ボード ＞ リスト」、リストはボード名、ボードは元の場所なし
        assertThat(items.get(0).originalLocation()).isEqualTo("学習計画 ＞ TODO");
        assertThat(items.get(1).originalLocation()).isEqualTo("学習計画");
        assertThat(items.get(2).originalLocation()).isNull();
    }

    @Test
    void 件数はすべての種類の合計になる() {
        when(boardService.findTrashed(USER_ID)).thenReturn(List.of(board(7L, "個人タスク", Instant.now())));
        when(taskListService.findTrashed(USER_ID))
                .thenReturn(List.of(list(4L, "DOING", Instant.now()), list(5L, "DONE", Instant.now())));
        when(cardService.findTrashed(USER_ID)).thenReturn(List.of());

        assertThat(trashService.count(USER_ID)).isEqualTo(3);
    }

    @Test
    void 空にするときはボードから先に消す() {
        trashService.empty(USER_ID);

        // ボードを消すと中のリスト・カードも CASCADE で消えるため、この順番で消す
        var order = org.mockito.Mockito.inOrder(boardService, taskListService, cardService);
        order.verify(boardService).deleteAllTrashed(USER_ID);
        order.verify(taskListService).deleteAllTrashed(USER_ID);
        order.verify(cardService).deleteAllTrashed(USER_ID);
    }

    @Test
    void 完全に削除は種類ごとのServiceへ渡す() {
        trashService.deletePermanently(USER_ID, TrashType.LIST, 4L);

        verify(taskListService).deletePermanently(USER_ID, 4L);
    }

    private Board board(Long id, String name, Instant deletedAt) {
        Board board = new Board(USER_ID, name, 0);
        setId(board, id);
        if (deletedAt != null) {
            board.moveToTrash(deletedAt);
        }
        return board;
    }

    private TaskList list(Long id, String name, Instant deletedAt) {
        TaskList list = new TaskList(BOARD_ID, name, 0);
        setId(list, id);
        if (deletedAt != null) {
            list.moveToTrash(deletedAt);
        }
        return list;
    }

    private Card card(Long id, Long listId, String title, Instant deletedAt) {
        Card card = new Card(listId, title, 0);
        setId(card, id);
        if (deletedAt != null) {
            card.moveToTrash(deletedAt);
        }
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
