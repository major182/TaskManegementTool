package com.example.taskboard.list;

import java.util.List;

import com.example.taskboard.board.BoardDtos.CardResponse;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * リスト API のリクエスト・レスポンス（docs/04_api-design.md 4.8、4.9）。
 * 入力のルールは docs/01-3_business-rules.md 5.1 に合わせる。
 */
public final class TaskListDtos {

    private TaskListDtos() {
    }

    /** リスト名の入力。作成（4.8）と名前の変更で共通。 */
    public record TaskListNameRequest(
            @NotBlank(message = "リスト名を入力してください")
            @Size(max = 50, message = "リスト名は50文字以内で入力してください")
            String name) {
    }

    /**
     * 並び替えの入力（4.9）。左から何番目に置くかで、0 が一番左。
     * 負の数はここで弾き、「リストの数より大きい」は今の状態しだいなので Service で見る。
     */
    public record MoveRequest(
            @NotNull(message = "位置を指定してください")
            @Min(value = 0, message = "位置は0以上で指定してください")
            Integer position) {
    }

    /** リスト作成の応答（4.8）。作った直後なのでカードは必ず空。 */
    public record TaskListCreatedResponse(Long id, String name, int position, List<CardResponse> cards) {

        public static TaskListCreatedResponse from(TaskList list) {
            return new TaskListCreatedResponse(list.getId(), list.getName(), list.getPosition(), List.of());
        }
    }

    /** リスト名の変更の応答。ボードの名前変更（4.7）と同じ形にそろえる。 */
    public record TaskListNameResponse(Long id, String name) {

        public static TaskListNameResponse from(TaskList list) {
            return new TaskListNameResponse(list.getId(), list.getName());
        }
    }

    /**
     * 並び替えの結果（4.9）。再採番はサーバーが行うため、並び順そのものを返す。
     * 画面は先に動かして表示し（楽観的更新）、この結果で正しい状態に合わせる。
     */
    public record TaskListPositionResponse(Long id, int position) {

        public static TaskListPositionResponse from(TaskList list) {
            return new TaskListPositionResponse(list.getId(), list.getPosition());
        }
    }
}
