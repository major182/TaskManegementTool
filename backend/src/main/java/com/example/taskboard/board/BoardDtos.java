package com.example.taskboard.board;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.example.taskboard.card.Card;
import com.example.taskboard.list.TaskList;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * ボード API のリクエスト・レスポンス（docs/04_api-design.md 4.4〜4.7）。
 * 入力のルールは docs/01-3_business-rules.md 5.1 に合わせる。
 */
public final class BoardDtos {

    private BoardDtos() {
    }

    /**
     * ボード名の入力。作成（4.6）と名前の変更（4.7）で共通。
     * @NotBlank は空白だけの入力も弾く（DDL の ck_boards_name と同じルール）。
     */
    public record BoardNameRequest(
            @NotBlank(message = "ボード名を入力してください")
            @Size(max = 50, message = "ボード名は50文字以内で入力してください")
            String name) {
    }

    /** PUT /api/me/last-opened-board のリクエスト（4.4 の F-15）。 */
    public record LastOpenedBoardRequest(
            @NotNull(message = "ボードを指定してください") Long boardId) {
    }

    /** サイドバー用の一覧（4.4）。リスト・カードは含めない。 */
    public record BoardSummaryResponse(Long id, String name, Instant createdAt) {

        public static BoardSummaryResponse from(Board board) {
            return new BoardSummaryResponse(board.getId(), board.getName(), board.getCreatedAt());
        }
    }

    /** ボード作成の応答（4.6）。作った直後なのでリストは必ず空。 */
    public record BoardCreatedResponse(Long id, String name, List<ListResponse> lists, Instant createdAt) {

        public static BoardCreatedResponse from(Board board) {
            return new BoardCreatedResponse(board.getId(), board.getName(), List.of(), board.getCreatedAt());
        }
    }

    /** ボード名の変更の応答（4.7）。 */
    public record BoardNameResponse(Long id, String name) {

        public static BoardNameResponse from(Board board) {
            return new BoardNameResponse(board.getId(), board.getName());
        }
    }

    /** 画面表示用の入れ子（4.5）。ゴミ箱に入っているリスト・カードは含めない。 */
    public record BoardDetailResponse(Long id, String name, List<ListResponse> lists) {
    }

    public record ListResponse(Long id, String name, int position, List<CardResponse> cards) {

        public static ListResponse from(TaskList list, List<CardResponse> cards) {
            return new ListResponse(list.getId(), list.getName(), list.getPosition(), cards);
        }
    }

    /**
     * カード1枚分。
     * 「期限切れを色で目立たせる」判定（F-35）は画面側で行うため、ここでは事実だけを返す。
     */
    public record CardResponse(Long id,
                               String title,
                               String description,
                               LocalDate dueDate,
                               boolean isDone,
                               int position) {

        public static CardResponse from(Card card) {
            return new CardResponse(card.getId(), card.getTitle(), card.getDescription(),
                    card.getDueDate(), card.isDone(), card.getPosition());
        }
    }
}
