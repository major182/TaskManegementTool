package com.example.taskboard.card;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.taskboard.card.CardDtos.CardMoveResponse;
import com.example.taskboard.common.BadRequestException;
import com.example.taskboard.common.NotFoundException;
import com.example.taskboard.list.TaskList;
import com.example.taskboard.list.TaskListService;

/**
 * カードの業務ルールの単体テスト。
 * 別のリストへ移したときに、移動元・移動先の両方で position が詰まることを重点的に確認する。
 */
@ExtendWith(MockitoExtension.class)
class CardServiceTest {

    private static final Long USER_ID = 1L;
    private static final Long BOARD_ID = 12L;
    private static final Long TODO = 3L;
    private static final Long DOING = 4L;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private TaskListService taskListService;

    @InjectMocks
    private CardService cardService;

    @Test
    void 新しいカードは一番下に作られる() {
        when(cardRepository.countByListId(TODO)).thenReturn(2);
        when(cardRepository.save(any(Card.class))).thenAnswer(i -> i.getArgument(0));

        cardService.create(USER_ID, TODO, "  テスト項目表を作る  ");

        ArgumentCaptor<Card> saved = ArgumentCaptor.forClass(Card.class);
        verify(cardRepository).save(saved.capture());
        assertThat(saved.getValue().getPosition()).isEqualTo(2);
        assertThat(saved.getValue().getTitle()).isEqualTo("テスト項目表を作る");
        assertThat(saved.getValue().isDone()).isFalse();
        assertThat(saved.getValue().getDueDate()).isNull();
    }

    @Test
    void 他人のリストにはカードを作れない() {
        when(taskListService.requireOwned(USER_ID, TODO))
                .thenThrow(new NotFoundException("リストが見つかりません"));

        assertThatThrownBy(() -> cardService.create(USER_ID, TODO, "勝手に作る"))
                .isInstanceOf(NotFoundException.class);

        verify(cardRepository, never()).save(any());
    }

    @Test
    void 期限日はnullを送ると消える() {
        Card card = card(8L, TODO, "要件定義を書く", 0);
        card.update("要件定義を書く", "説明", LocalDate.of(2026, 9, 30), false);
        givenCard(card);

        cardService.update(USER_ID, 8L, "要件定義を書く", "説明", null, true);

        assertThat(card.getDueDate()).isNull();
        assertThat(card.isDone()).isTrue();
    }

    @Test
    void 説明文の空欄は説明なしとして保存する() {
        Card card = card(8L, TODO, "要件定義を書く", 0);
        givenCard(card);

        cardService.update(USER_ID, 8L, "要件定義を書く", "   ", null, false);

        assertThat(card.getDescription()).isNull();
    }

    @Test
    void ゴミ箱のカードは操作できない() {
        when(cardRepository.findByIdAndDeletedAtIsNull(8L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> cardService.update(USER_ID, 8L, "題", null, null, false))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("カードが見つかりません");
    }

    @Test
    void 同じリスト内で並び替えると影響したリストは1つだけ返る() {
        Card first = card(8L, TODO, "1枚目", 0);
        Card second = card(9L, TODO, "2枚目", 1);
        Card third = card(10L, TODO, "3枚目", 2);
        givenCard(third);
        givenList(TODO);
        givenLiveCards(TODO, first, second, third);

        CardMoveResponse moved = cardService.move(USER_ID, 10L, TODO, 0);

        assertThat(moved.lists()).hasSize(1);
        assertThat(moved.lists().get(0).cardIds()).containsExactly(10L, 8L, 9L);
        assertThat(third.getPosition()).isEqualTo(0);
        assertThat(first.getPosition()).isEqualTo(1);
        assertThat(second.getPosition()).isEqualTo(2);
    }

    @Test
    void 別のリストへ移すと移動元と移動先の両方が詰め直される() {
        Card first = card(8L, TODO, "1枚目", 0);
        Card target = card(9L, TODO, "移すカード", 1);
        Card third = card(10L, TODO, "3枚目", 2);
        Card other = card(12L, DOING, "移動先の1枚目", 0);
        givenCard(target);
        givenList(TODO);
        givenList(DOING);
        givenLiveCards(TODO, first, target, third);
        givenLiveCards(DOING, other);

        CardMoveResponse moved = cardService.move(USER_ID, 9L, DOING, 0);

        assertThat(target.getListId()).isEqualTo(DOING);
        // 移動元は穴が詰まる
        assertThat(first.getPosition()).isEqualTo(0);
        assertThat(third.getPosition()).isEqualTo(1);
        // 移動先は割り込んだぶん後ろへずれる
        assertThat(target.getPosition()).isEqualTo(0);
        assertThat(other.getPosition()).isEqualTo(1);

        assertThat(moved.lists()).hasSize(2);
        assertThat(moved.lists().get(0).cardIds()).containsExactly(8L, 10L);
        assertThat(moved.lists().get(1).cardIds()).containsExactly(9L, 12L);
    }

    @Test
    void カードの数を超える位置は指定できない() {
        Card first = card(8L, TODO, "1枚目", 0);
        Card second = card(9L, TODO, "2枚目", 1);
        givenCard(second);
        givenList(TODO);
        givenLiveCards(TODO, first, second);

        // 自分を抜くと残り1枚なので、置けるのは 0 と 1 まで
        assertThatThrownBy(() -> cardService.move(USER_ID, 9L, TODO, 2))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("指定された位置にはカードを置けません");
    }

    @Test
    void 別のボードのリストへは移動できない() {
        Card target = card(9L, TODO, "移すカード", 0);
        givenCard(target);
        when(taskListService.requireOwned(USER_ID, TODO)).thenReturn(list(TODO, BOARD_ID));
        when(taskListService.requireOwned(USER_ID, DOING)).thenReturn(list(DOING, 99L));

        assertThatThrownBy(() -> cardService.move(USER_ID, 9L, DOING, 0))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("別のボードのリストへは移動できません");
    }

    @Test
    void ゴミ箱へ移動すると残ったカードの並びが詰め直される() {
        Card first = card(8L, TODO, "1枚目", 0);
        Card second = card(9L, TODO, "2枚目", 1);
        Card third = card(10L, TODO, "3枚目", 2);
        givenCard(second);
        givenLiveCards(TODO, first, second, third);

        cardService.moveToTrash(USER_ID, 9L);

        assertThat(second.getDeletedAt()).isNotNull();
        assertThat(first.getPosition()).isEqualTo(0);
        assertThat(third.getPosition()).isEqualTo(1);
    }

    private void givenCard(Card card) {
        when(cardRepository.findByIdAndDeletedAtIsNull(card.getId())).thenReturn(Optional.of(card));
        lenient().when(taskListService.requireOwned(USER_ID, card.getListId()))
                .thenReturn(list(card.getListId(), BOARD_ID));
    }

    private void givenList(Long listId) {
        lenient().when(taskListService.requireOwned(USER_ID, listId))
                .thenReturn(list(listId, BOARD_ID));
    }

    private void givenLiveCards(Long listId, Card... cards) {
        when(cardRepository.findByListIdAndDeletedAtIsNullOrderByPositionAsc(listId))
                .thenReturn(List.of(cards));
        lenient().when(cardRepository.findByListIdAndDeletedAtIsNotNullOrderByDeletedAtAscIdAsc(listId))
                .thenReturn(List.of());
    }

    private TaskList list(Long id, Long boardId) {
        TaskList list = new TaskList(boardId, "リスト", 0);
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
