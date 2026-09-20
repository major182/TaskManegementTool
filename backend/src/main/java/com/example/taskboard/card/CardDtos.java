package com.example.taskboard.card;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * カード API のリクエスト・レスポンス（docs/04_api-design.md 4.10〜4.12）。
 * 入力のルールは docs/01-3_business-rules.md 5.1 に合わせる。
 *
 * <p>カード1枚分の応答は、ボード表示で使う {@link com.example.taskboard.board.BoardDtos.CardResponse}
 * をそのまま使う。同じものを2つ持つと、片方だけ直したときにずれるため。
 */
public final class CardDtos {

    private CardDtos() {
    }

    /** カード作成（4.10）。タイトルだけを受け取り、期限日は空・未完了で作る（要件 8.3）。 */
    public record CardCreateRequest(
            @NotBlank(message = "タイトルを入力してください")
            @Size(max = 100, message = "タイトルは100文字以内で入力してください")
            String title) {
    }

    /**
     * カードの更新（4.11）。
     * 変えない項目も今の値を送ってもらう。そうすると null を「消す」の意味だけに使えて、
     * 「期限日を消したい」と「期限日は変えたくない」を取り違えずに済む。
     */
    public record CardUpdateRequest(
            @NotBlank(message = "タイトルを入力してください")
            @Size(max = 100, message = "タイトルは100文字以内で入力してください")
            String title,

            @Size(max = 2000, message = "説明文は2,000文字以内で入力してください")
            String description,

            /** null は「期限日なし」。過去の日付も設定できる。 */
            LocalDate dueDate,

            @NotNull(message = "完了かどうかを指定してください")
            Boolean isDone) {
    }

    /** カードの移動（4.12）。同じリスト内の並び替えも、今のリストを指定して同じ形で送る。 */
    public record CardMoveRequest(
            @NotNull(message = "移動先のリストを指定してください")
            Long listId,

            @NotNull(message = "位置を指定してください")
            @Min(value = 0, message = "位置は0以上で指定してください")
            Integer position) {
    }

    /**
     * 移動の結果（4.12）。影響したリスト（移動元・移動先）の並びだけを返す。
     * 同じリスト内の移動なら1つ、別のリストへの移動なら2つ入る。
     */
    public record CardMoveResponse(List<ListCards> lists) {

        public record ListCards(Long listId, List<Long> cardIds) {
        }
    }
}
