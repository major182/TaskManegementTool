package com.example.taskboard.board;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.taskboard.auth.User;
import com.example.taskboard.auth.UserRepository;
import com.example.taskboard.board.BoardDtos.BoardDetailResponse;
import com.example.taskboard.board.BoardDtos.CardResponse;
import com.example.taskboard.board.BoardDtos.ListResponse;
import com.example.taskboard.card.Card;
import com.example.taskboard.card.CardRepository;
import com.example.taskboard.common.NotFoundException;
import com.example.taskboard.list.TaskList;
import com.example.taskboard.list.TaskListRepository;

/**
 * ボードの業務ルール（docs/04_api-design.md 3.2）。
 * すべてのメソッドで「ログイン中の利用者のボードか」を確認し、
 * 他人のボードのときは 403 ではなく 404 を返す（存在を知らせないため。同 7章）。
 */
@Service
public class BoardService {

    private final BoardRepository boardRepository;
    private final TaskListRepository taskListRepository;
    private final CardRepository cardRepository;
    private final UserRepository userRepository;

    public BoardService(BoardRepository boardRepository,
                        TaskListRepository taskListRepository,
                        CardRepository cardRepository,
                        UserRepository userRepository) {
        this.boardRepository = boardRepository;
        this.taskListRepository = taskListRepository;
        this.cardRepository = cardRepository;
        this.userRepository = userRepository;
    }

    /** サイドバー用の一覧（F-11）。作成日の新しい順。 */
    @Transactional(readOnly = true)
    public List<Board> findAll(Long userId) {
        return boardRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId);
    }

    /** ボード作成（F-12）。 */
    @Transactional
    public Board create(Long userId, String name) {
        return boardRepository.save(new Board(userId, name.trim()));
    }

    /**
     * 画面表示用にボード・リスト・カードをまとめて取得する（F-02）。
     * 問い合わせはボード・リスト・カードで1回ずつの合計3回に抑える。
     */
    @Transactional(readOnly = true)
    public BoardDetailResponse findDetail(Long userId, Long boardId) {
        Board board = requireOwned(userId, boardId);

        List<TaskList> lists = taskListRepository.findByBoardIdAndDeletedAtIsNullOrderByPositionAsc(boardId);
        if (lists.isEmpty()) {
            return new BoardDetailResponse(board.getId(), board.getName(), List.of());
        }

        List<Long> listIds = lists.stream().map(TaskList::getId).toList();
        // listId ごとに振り分ける。position の昇順で引いているので、
        // groupingBy が作る各リストの中身も昇順のまま（カードの上から下の順）。
        Map<Long, List<Card>> cardsByListId =
                cardRepository.findByListIdInAndDeletedAtIsNullOrderByPositionAsc(listIds).stream()
                        .collect(Collectors.groupingBy(Card::getListId));

        List<ListResponse> listResponses = lists.stream()
                .map(list -> ListResponse.from(list, cardsByListId.getOrDefault(list.getId(), List.of()).stream()
                        .map(CardResponse::from)
                        .toList()))
                .toList();

        return new BoardDetailResponse(board.getId(), board.getName(), listResponses);
    }

    /** ボード名の変更（F-13）。 */
    @Transactional
    public Board rename(Long userId, Long boardId, String name) {
        Board board = requireOwned(userId, boardId);
        board.rename(name.trim());
        return board;
    }

    /**
     * ゴミ箱へ移動（F-14）。
     * 中のリスト・カードの deleted_at は変えない。ゴミ箱にはボード1件として出し、
     * 元に戻したときに中身がそのまま戻るようにするため（docs/03_db-design.md 1.1）。
     */
    @Transactional
    public void moveToTrash(Long userId, Long boardId) {
        Board board = requireOwned(userId, boardId);
        board.moveToTrash(Instant.now());

        // 最後に開いたボードとして覚えていたら忘れる。
        // ゴミ箱のボードは表示できないため、覚えたままだと次に開いたときに 404 になる（F-15）。
        User user = requireUser(userId);
        if (boardId.equals(user.getLastOpenedBoardId())) {
            user.setLastOpenedBoardId(null);
        }
    }

    /**
     * 最後に開いていたボードを記録する（F-15）。
     * 自分のもので、ゴミ箱に入っていないボードだけを記録する。
     *
     * @throws NotFoundException 存在しない・他人のもの・ゴミ箱に入っているボードを指定されたとき
     */
    @Transactional
    public void updateLastOpenedBoard(Long userId, Long boardId) {
        requireOwned(userId, boardId);
        requireUser(userId).setLastOpenedBoardId(boardId);
    }

    /**
     * 自分のもので、かつゴミ箱に入っていないボードを取り出す。
     * リストやカードの Service からも「親のボードが自分のものか」の確認に使う。
     *
     * @throws NotFoundException 存在しない・他人のもの・ゴミ箱に入っているとき
     */
    public Board requireOwned(Long userId, Long boardId) {
        return boardRepository.findByIdAndUserIdAndDeletedAtIsNull(boardId, userId)
                .orElseThrow(() -> new NotFoundException("ボードが見つかりません"));
    }

    /** ログイン中の利用者。Security を通っている以上、見つからないのは異常事態。 */
    private User requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("ログイン中の利用者が見つかりません: " + userId));
    }
}
