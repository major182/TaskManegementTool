package com.example.taskboard.list;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.taskboard.board.BoardRepository;
import com.example.taskboard.board.BoardService;
import com.example.taskboard.common.BadRequestException;
import com.example.taskboard.common.ConflictException;
import com.example.taskboard.common.NotFoundException;

/**
 * リストの業務ルール（docs/04_api-design.md 3.3）。
 * リストは必ずボードに属するため、どの操作でも先に「親のボードが自分のものか」を確認する。
 *
 * <p>並び順の決まりごと：一意制約 uq_lists_board_position はゴミ箱に入った行も対象にするため、
 * 表示するリストを前（0 から連番）、ゴミ箱のリストを後ろ、という並びをボード全体で保つ。
 * こうしないと、詰め直したときにゴミ箱の行と position がぶつかる（docs/03_db-design.md 4.2・5.3）。
 */
@Service
public class TaskListService {

    private final TaskListRepository taskListRepository;
    private final BoardService boardService;
    private final BoardRepository boardRepository;

    public TaskListService(TaskListRepository taskListRepository,
                           BoardService boardService,
                           BoardRepository boardRepository) {
        this.taskListRepository = taskListRepository;
        this.boardService = boardService;
        this.boardRepository = boardRepository;
    }

    /**
     * リスト作成（F-21）。position は指定させず、そのボードの一番右に置く
     * （docs/03_db-design.md 5.2）。
     */
    @Transactional
    public TaskList create(Long userId, Long boardId, String name) {
        boardService.requireOwned(userId, boardId);

        // いったん、まだ誰も使っていない位置（今ある行数）で作ってから全体を振り直す。
        // 表示するリストの末尾はゴミ箱の行が使っていることがあるため、直接は置けない。
        int free = taskListRepository.countByBoardId(boardId);
        TaskList list = taskListRepository.save(new TaskList(boardId, name.trim(), free));

        renumberBoard(boardId, liveLists(boardId));
        return list;
    }

    /** リスト名の変更（F-22）。 */
    @Transactional
    public TaskList rename(Long userId, Long listId, String name) {
        TaskList list = requireOwned(userId, listId);
        list.rename(name.trim());
        return list;
    }

    /**
     * ゴミ箱へ移動（F-23）。
     * 中のカードの deleted_at は変えない（docs/03_db-design.md 1.1）。
     * 残ったリストは position を詰め直し、0 からの連番を保つ（同 5.3）。
     */
    @Transactional
    public void moveToTrash(Long userId, Long listId) {
        TaskList list = requireOwned(userId, listId);
        list.moveToTrash(Instant.now());

        List<TaskList> remaining = liveLists(list.getBoardId());
        remaining.removeIf(sibling -> sibling.getId().equals(listId));
        renumberBoard(list.getBoardId(), remaining);
    }

    /**
     * 並び替え（F-24）。
     * いったん今の並びから取り出し、指定された位置に入れ直してから 0 から振り直す。
     * 1つずつずらすより間違いが起きにくく、詰め直しと同じ処理を使い回せる。
     *
     * @return 並び替えたあとの、表示するリスト（position の昇順）
     */
    @Transactional
    public List<TaskList> move(Long userId, Long listId, int position) {
        TaskList list = requireOwned(userId, listId);

        List<TaskList> lists = liveLists(list.getBoardId());
        if (position >= lists.size()) {
            throw new BadRequestException("指定された位置にはリストを置けません");
        }

        lists.removeIf(sibling -> sibling.getId().equals(listId));
        lists.add(position, list);
        renumberBoard(list.getBoardId(), lists);

        return lists;
    }

    /**
     * ゴミ箱から元に戻す（F-42）。元のボードの一番右に戻る
     * （docs/01-3_business-rules.md 5.3。削除時に詰め直すので元の位置は残っていない）。
     * 個別にゴミ箱へ入れたカードは戻らない（docs/03_db-design.md 1.1）。
     *
     * @throws ConflictException 元のボードがゴミ箱にある・完全に削除されているとき
     */
    @Transactional
    public TaskList restore(Long userId, Long listId) {
        TaskList list = taskListRepository.findTrashedById(listId, userId)
                .orElseThrow(() -> trashedNotFoundOrUnrestorable(userId, listId));

        list.restore();

        // 表示するリストの末尾に置いてから振り直す
        List<TaskList> lists = liveLists(list.getBoardId());
        lists.removeIf(sibling -> sibling.getId().equals(listId));
        lists.add(list);
        renumberBoard(list.getBoardId(), lists);

        return list;
    }

    /** 完全に削除（F-43）。中のカードは ON DELETE CASCADE で一緒に消える。 */
    @Transactional
    public void deletePermanently(Long userId, Long listId) {
        taskListRepository.delete(taskListRepository.findTrashedById(listId, userId)
                .orElseThrow(() -> new NotFoundException("ゴミ箱にリストが見つかりません")));
    }

    /** ゴミ箱に表示するリスト（削除日時の新しい順）。 */
    @Transactional(readOnly = true)
    public List<TaskList> findTrashed(Long userId) {
        return taskListRepository.findTrashed(userId);
    }

    /** ゴミ箱を空にする（F-44）。 */
    @Transactional
    public void deleteAllTrashed(Long userId) {
        taskListRepository.deleteTrashed(userId);
    }

    /**
     * 「見つからない」と「元のボードがないから戻せない」を区別する。
     * 画面には理由を出したいが、他人のデータの存在は知らせたくないため、
     * 自分のボードのリストだと分かるときだけ 409 にする。
     */
    private RuntimeException trashedNotFoundOrUnrestorable(Long userId, Long listId) {
        return taskListRepository.findById(listId)
                .filter(list -> list.getDeletedAt() != null)
                .filter(list -> boardRepository.existsByIdAndUserId(list.getBoardId(), userId))
                .<RuntimeException>map(list -> new ConflictException("元のボードがないため戻せません"))
                .orElseGet(() -> new NotFoundException("ゴミ箱にリストが見つかりません"));
    }

    /**
     * 自分のもので、かつゴミ箱に入っていないリストを取り出す。
     * リスト自身とボードの両方を確認する。ボードが他人のものなら、
     * リスト ID を知っていても届かないようにするため。
     *
     * @throws NotFoundException 存在しない・他人のもの・ゴミ箱に入っているとき
     */
    public TaskList requireOwned(Long userId, Long listId) {
        TaskList list = taskListRepository.findByIdAndDeletedAtIsNull(listId)
                .orElseThrow(() -> new NotFoundException("リストが見つかりません"));

        // 親のボードが他人のもの・ゴミ箱の場合もここで 404 になる
        boardService.requireOwned(userId, list.getBoardId());
        return list;
    }

    /** 表示するリスト（左から右の順）。並べ替えるので可変リストにする。 */
    private List<TaskList> liveLists(Long boardId) {
        return new ArrayList<>(taskListRepository.findByBoardIdAndDeletedAtIsNullOrderByPositionAsc(boardId));
    }

    /**
     * ボードの中の position を振り直す。
     * 渡された「表示するリスト」を並んでいる順に 0 から、続けてゴミ箱のリストを削除した順に並べる。
     *
     * <p>途中で position が重なる瞬間があるが、一意制約を
     * DEFERRABLE INITIALLY DEFERRED にしてあるので判定はコミット時まで延期される
     * （docs/03_db-design.md 4.2）。
     */
    private void renumberBoard(Long boardId, List<TaskList> ordered) {
        List<TaskList> all = new ArrayList<>(ordered);
        all.addAll(taskListRepository.findByBoardIdAndDeletedAtIsNotNullOrderByDeletedAtAscIdAsc(boardId));

        for (int i = 0; i < all.size(); i++) {
            all.get(i).moveTo(i);
        }
    }
}
