package com.example.taskboard.card;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.taskboard.board.Board;
import com.example.taskboard.board.BoardRepository;
import com.example.taskboard.card.CardDtos.CardMoveResponse;
import com.example.taskboard.card.CardDtos.CardMoveResponse.ListCards;
import com.example.taskboard.common.BadRequestException;
import com.example.taskboard.common.ConflictException;
import com.example.taskboard.common.NotFoundException;
import com.example.taskboard.list.TaskList;
import com.example.taskboard.list.TaskListRepository;
import com.example.taskboard.list.TaskListService;

/**
 * カードの業務ルール（docs/04_api-design.md 3.4）。
 * カードは必ずリストに属するため、どの操作でも先に
 * 「そのリスト（とボード）が自分のものか」を確認する。
 *
 * <p>並び順の決まりごとはリストと同じで、リストの中を
 * 「表示するカード（0 から連番）→ ゴミ箱のカード（削除した順）」の通し番号に保つ
 * （docs/03_db-design.md 5.3）。
 */
@Service
public class CardService {

    private final CardRepository cardRepository;
    private final TaskListService taskListService;
    private final TaskListRepository taskListRepository;
    private final BoardRepository boardRepository;

    public CardService(CardRepository cardRepository,
                       TaskListService taskListService,
                       TaskListRepository taskListRepository,
                       BoardRepository boardRepository) {
        this.cardRepository = cardRepository;
        this.taskListService = taskListService;
        this.taskListRepository = taskListRepository;
        this.boardRepository = boardRepository;
    }

    /**
     * カード作成（F-31）。position は指定させず、そのリストの一番下に置く。
     * 期限日は空、未完了で作られる（要件 8.3）。
     */
    @Transactional
    public Card create(Long userId, Long listId, String title) {
        taskListService.requireOwned(userId, listId);

        // まだ誰も使っていない位置で作ってから、リスト全体を振り直す
        int free = cardRepository.countByListId(listId);
        Card card = cardRepository.save(new Card(listId, title.trim(), free));

        renumberList(listId, liveCards(listId));
        return card;
    }

    /** カードの更新（F-32、F-35、F-38）。4項目をまとめて置き換える。 */
    @Transactional
    public Card update(Long userId, Long cardId, String title, String description,
                       LocalDate dueDate, boolean done) {
        Card card = requireOwned(userId, cardId);
        card.update(title.trim(), normalize(description), dueDate, done);
        return card;
    }

    /**
     * ゴミ箱へ移動（F-33）。
     * 残ったカードは position を詰め直し、0 からの連番を保つ（docs/03_db-design.md 5.3）。
     */
    @Transactional
    public void moveToTrash(Long userId, Long cardId) {
        Card card = requireOwned(userId, cardId);
        card.moveToTrash(Instant.now());

        List<Card> remaining = liveCards(card.getListId());
        remaining.removeIf(sibling -> sibling.getId().equals(cardId));
        renumberList(card.getListId(), remaining);
    }

    /**
     * カードの移動（F-34）。同じリスト内の並び替えも、別のリストへの移動も同じ処理で行う。
     * 1つのトランザクションで「移動元を詰める → 移動先に挿入する → 再採番する」を行う
     * （docs/03_db-design.md 5.1）。
     *
     * @return 影響したリスト（移動元・移動先）の並び。同じリスト内なら1つだけ
     */
    @Transactional
    public CardMoveResponse move(Long userId, Long cardId, Long toListId, int position) {
        Card card = requireOwned(userId, cardId);
        Long fromListId = card.getListId();

        TaskList toList = taskListService.requireOwned(userId, toListId);
        // 移動元と移動先が別のボードにまたがることは画面上ありえないが、
        // ID を書き換えられた場合に他のボードへ差し込めてしまうので確認する
        TaskList fromList = taskListService.requireOwned(userId, fromListId);
        if (!fromList.getBoardId().equals(toList.getBoardId())) {
            throw new BadRequestException("別のボードのリストへは移動できません");
        }

        List<Card> destination = liveCards(toListId);
        destination.removeIf(sibling -> sibling.getId().equals(cardId));
        if (position > destination.size()) {
            throw new BadRequestException("指定された位置にはカードを置けません");
        }

        if (toListId.equals(fromListId)) {
            destination.add(position, card);
            card.moveTo(position);
            renumberList(toListId, destination);
            return new CardMoveResponse(List.of(listCards(toListId, destination)));
        }

        // 移動元から抜いて詰める
        List<Card> source = liveCards(fromListId);
        source.removeIf(sibling -> sibling.getId().equals(cardId));
        renumberList(fromListId, source);

        // 移動先へ入れる。list_id を先に変えてから振り直す
        card.moveTo(toListId, position);
        destination.add(position, card);
        renumberList(toListId, destination);

        return new CardMoveResponse(List.of(
                listCards(fromListId, source),
                listCards(toListId, destination)));
    }

    /**
     * ゴミ箱から元に戻す（F-42）。元のリストの一番下に戻る
     * （docs/01-3_business-rules.md 5.3。削除時に詰め直すので元の位置は残っていない）。
     *
     * <p>元のリストがないときは、同じボードの一番左のリストに戻し、その旨を message で伝える。
     * ボードにリストが1つもなければ戻す場所がないので 409 にする。
     *
     * @throws ConflictException 戻せる場所がないとき
     */
    @Transactional
    public RestoreResult restore(Long userId, Long cardId) {
        Card card = cardRepository.findById(cardId)
                .filter(target -> target.getDeletedAt() != null)
                .orElseThrow(() -> new NotFoundException("ゴミ箱にカードが見つかりません"));

        TaskList originalList = taskListRepository.findById(card.getListId())
                .orElseThrow(() -> new NotFoundException("ゴミ箱にカードが見つかりません"));
        Board board = boardRepository.findById(originalList.getBoardId())
                .filter(target -> target.getUserId().equals(userId))
                .orElseThrow(() -> new NotFoundException("ゴミ箱にカードが見つかりません"));

        if (board.getDeletedAt() != null) {
            // ボードごとゴミ箱にあるときは、ボードを戻せばカードも一緒に戻る
            throw new ConflictException("戻せる場所がないため戻せません");
        }

        String message = null;
        Long toListId = originalList.getId();
        if (originalList.getDeletedAt() != null) {
            // 元のリストがゴミ箱にある。同じボードの一番左のリストに戻す
            TaskList leftmost = taskListRepository
                    .findByBoardIdAndDeletedAtIsNullOrderByPositionAsc(board.getId()).stream()
                    .findFirst()
                    .orElseThrow(() -> new ConflictException("戻せる場所がないため戻せません"));

            toListId = leftmost.getId();
            message = "元のリストがないため、一番左のリストに戻しました";
        }

        card.restore();

        List<Card> cards = liveCards(toListId);
        cards.removeIf(sibling -> sibling.getId().equals(cardId));
        cards.add(card);
        card.moveTo(toListId, cards.size() - 1);
        renumberList(toListId, cards);

        return new RestoreResult(card, message);
    }

    /** 完全に削除（F-43）。 */
    @Transactional
    public void deletePermanently(Long userId, Long cardId) {
        cardRepository.delete(cardRepository.findTrashedById(cardId, userId)
                .orElseThrow(() -> new NotFoundException("ゴミ箱にカードが見つかりません")));
    }

    /** ゴミ箱に表示するカード（削除日時の新しい順）。 */
    @Transactional(readOnly = true)
    public List<Card> findTrashed(Long userId) {
        return cardRepository.findTrashed(userId);
    }

    /** ゴミ箱を空にする（F-44）。 */
    @Transactional
    public void deleteAllTrashed(Long userId) {
        cardRepository.deleteTrashed(userId);
    }

    /** 元に戻した結果。message は「元のリストがないので別の場所に戻した」ときだけ入る。 */
    public record RestoreResult(Card card, String message) {
    }

    /**
     * 自分のもので、かつゴミ箱に入っていないカードを取り出す。
     * カード自身と、親のリスト・ボードの両方を確認する。
     *
     * @throws NotFoundException 存在しない・他人のもの・ゴミ箱に入っているとき
     */
    public Card requireOwned(Long userId, Long cardId) {
        Card card = cardRepository.findByIdAndDeletedAtIsNull(cardId)
                .orElseThrow(() -> new NotFoundException("カードが見つかりません"));

        // 親のリスト・ボードが他人のもの・ゴミ箱の場合もここで 404 になる
        taskListService.requireOwned(userId, card.getListId());
        return card;
    }

    /** 説明文は、空文字を null（説明なし）として扱う。画面から空欄が送られてくるため。 */
    private String normalize(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        return description;
    }

    /** リストの中の表示するカード（上から下の順）。並べ替えるので可変リストにする。 */
    private List<Card> liveCards(Long listId) {
        return new ArrayList<>(cardRepository.findByListIdAndDeletedAtIsNullOrderByPositionAsc(listId));
    }

    /**
     * リストの中の position を振り直す。
     * 表示するカードを 0 から、続けてゴミ箱のカードを削除した順に並べる。
     * 一意制約はゴミ箱の行も対象なので、こうしないと詰め直しでぶつかる
     * （docs/03_db-design.md 5.3）。
     */
    private void renumberList(Long listId, List<Card> ordered) {
        List<Card> all = new ArrayList<>(ordered);
        all.addAll(cardRepository.findByListIdAndDeletedAtIsNotNullOrderByDeletedAtAscIdAsc(listId));

        for (int i = 0; i < all.size(); i++) {
            all.get(i).moveTo(i);
        }
    }

    private ListCards listCards(Long listId, List<Card> cards) {
        return new ListCards(listId, cards.stream().map(Card::getId).toList());
    }
}
