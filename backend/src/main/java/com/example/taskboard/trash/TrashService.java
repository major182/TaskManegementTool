package com.example.taskboard.trash;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.taskboard.board.Board;
import com.example.taskboard.board.BoardRepository;
import com.example.taskboard.board.BoardService;
import com.example.taskboard.card.Card;
import com.example.taskboard.card.CardService;
import com.example.taskboard.card.CardService.RestoreResult;
import com.example.taskboard.list.TaskList;
import com.example.taskboard.list.TaskListRepository;
import com.example.taskboard.list.TaskListService;
import com.example.taskboard.trash.TrashDtos.RestoreResponse;
import com.example.taskboard.trash.TrashDtos.TrashItemResponse;
import com.example.taskboard.trash.TrashDtos.TrashType;

/**
 * ゴミ箱（docs/04_api-design.md 3.5）。
 * ボード・リスト・カードをまとめて扱うだけで、実際の出し入れは各 Service に任せる。
 * 並びの詰め直しなど、種類ごとの決まりごとをここに持ち込まないため。
 */
@Service
public class TrashService {

    private final BoardService boardService;
    private final TaskListService taskListService;
    private final CardService cardService;
    private final BoardRepository boardRepository;
    private final TaskListRepository taskListRepository;

    public TrashService(BoardService boardService,
                        TaskListService taskListService,
                        CardService cardService,
                        BoardRepository boardRepository,
                        TaskListRepository taskListRepository) {
        this.boardService = boardService;
        this.taskListService = taskListService;
        this.cardService = cardService;
        this.boardRepository = boardRepository;
        this.taskListRepository = taskListRepository;
    }

    /**
     * ゴミ箱の一覧（F-41）。削除日時の新しい順（docs/01-3_business-rules.md 5.2）。
     * 親がゴミ箱に入っている子は、各 Service の検索条件で除かれている（親の1件として表示するため）。
     */
    @Transactional(readOnly = true)
    public List<TrashItemResponse> findAll(Long userId) {
        List<Board> boards = boardService.findTrashed(userId);
        List<TaskList> lists = taskListService.findTrashed(userId);
        List<Card> cards = cardService.findTrashed(userId);

        // 「元の場所」の表示に使う親の名前を、まとめて引く
        Map<Long, TaskList> listsById = parentLists(cards);
        Map<Long, Board> boardsById = parentBoards(lists, listsById.values());

        Stream<TrashItemResponse> boardItems = boards.stream()
                .map(board -> new TrashItemResponse(
                        TrashType.BOARD, board.getId(), board.getName(),
                        null, board.getDeletedAt(), true));

        Stream<TrashItemResponse> listItems = lists.stream()
                .map(list -> new TrashItemResponse(
                        TrashType.LIST, list.getId(), list.getName(),
                        boardName(boardsById, list.getBoardId()), list.getDeletedAt(), true));

        Stream<TrashItemResponse> cardItems = cards.stream()
                .map(card -> {
                    TaskList list = listsById.get(card.getListId());
                    String location = boardName(boardsById, list.getBoardId()) + " ＞ " + list.getName();
                    return new TrashItemResponse(
                            TrashType.CARD, card.getId(), card.getTitle(),
                            location, card.getDeletedAt(), true);
                });

        return Stream.of(boardItems, listItems, cardItems)
                .flatMap(Function.identity())
                .sorted(Comparator.comparing(TrashItemResponse::deletedAt).reversed())
                .toList();
    }

    /** ゴミ箱の件数（F-41）。サイドバーに出すため、一覧と同じ数え方にする。 */
    @Transactional(readOnly = true)
    public int count(Long userId) {
        return boardService.findTrashed(userId).size()
                + taskListService.findTrashed(userId).size()
                + cardService.findTrashed(userId).size();
    }

    /** 元に戻す（F-42）。戻し先の決まりごとは種類ごとに違うので、各 Service に任せる。 */
    @Transactional
    public RestoreResponse restore(Long userId, TrashType type, Long id) {
        return switch (type) {
            case BOARD -> {
                Board board = boardService.restore(userId, id);
                yield new RestoreResponse(TrashType.BOARD, board.getId(), null, null, null, null);
            }
            case LIST -> {
                TaskList list = taskListService.restore(userId, id);
                yield new RestoreResponse(TrashType.LIST, list.getId(), list.getBoardId(),
                        null, list.getPosition(), null);
            }
            case CARD -> {
                RestoreResult result = cardService.restore(userId, id);
                Card card = result.card();
                yield new RestoreResponse(TrashType.CARD, card.getId(), null,
                        card.getListId(), card.getPosition(), result.message());
            }
        };
    }

    /** 完全に削除（F-43）。子は外部キーの ON DELETE CASCADE で一緒に消える。 */
    @Transactional
    public void deletePermanently(Long userId, TrashType type, Long id) {
        switch (type) {
            case BOARD -> boardService.deletePermanently(userId, id);
            case LIST -> taskListService.deletePermanently(userId, id);
            case CARD -> cardService.deletePermanently(userId, id);
        }
    }

    /**
     * ゴミ箱を空にする（F-44）。
     * ボードから先に消す。ボードを消すと中のリスト・カードも CASCADE で消えるため、
     * あとの2つで消す件数が減る。
     */
    @Transactional
    public void empty(Long userId) {
        boardService.deleteAllTrashed(userId);
        taskListService.deleteAllTrashed(userId);
        cardService.deleteAllTrashed(userId);
    }

    /** ゴミ箱のカードの親リスト。まとめて引いて N+1 を避ける。 */
    private Map<Long, TaskList> parentLists(List<Card> cards) {
        List<Long> listIds = cards.stream().map(Card::getListId).distinct().toList();
        return taskListRepository.findAllById(listIds).stream()
                .collect(Collectors.toMap(TaskList::getId, Function.identity()));
    }

    /** 「元の場所」に出すボード。ゴミ箱のリストと、ゴミ箱のカードの親リストの分をまとめて引く。 */
    private Map<Long, Board> parentBoards(List<TaskList> lists, Iterable<TaskList> parentsOfCards) {
        Stream<Long> fromLists = lists.stream().map(TaskList::getBoardId);
        Stream<Long> fromCards = java.util.stream.StreamSupport.stream(parentsOfCards.spliterator(), false)
                .map(TaskList::getBoardId);

        List<Long> boardIds = Stream.concat(fromLists, fromCards).distinct().toList();
        return boardRepository.findAllById(boardIds).stream()
                .collect(Collectors.toMap(Board::getId, Function.identity()));
    }

    private String boardName(Map<Long, Board> boardsById, Long boardId) {
        Board board = boardsById.get(boardId);
        return board == null ? null : board.getName();
    }
}
