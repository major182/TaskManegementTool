package com.example.taskboard.trash;

import java.time.Instant;

/**
 * ゴミ箱 API のレスポンス（docs/04_api-design.md 4.14〜4.16）。
 */
public final class TrashDtos {

    private TrashDtos() {
    }

    /** ゴミ箱に入っているものの種類。URL の {type} は小文字の複数形（boards / lists / cards）。 */
    public enum TrashType {
        BOARD, LIST, CARD
    }

    /**
     * ゴミ箱の1件（4.14）。
     *
     * @param originalLocation 画面に出す「元の場所」。ボードは元の場所がないので null
     * @param restorable       今すぐ元に戻せるか。false のとき画面は「元に戻す」を押せなくする
     */
    public record TrashItemResponse(TrashType type,
                                    Long id,
                                    String name,
                                    String originalLocation,
                                    Instant deletedAt,
                                    boolean restorable) {
    }

    /** ゴミ箱の件数（4.14 の /count）。サイドバーに出す。 */
    public record TrashCountResponse(int count) {
    }

    /**
     * 元に戻した結果（4.15）。
     * 種類によって使う項目が変わるため、使わない項目は null になる。
     */
    public record RestoreResponse(TrashType type,
                                  Long id,
                                  Long boardId,
                                  Long listId,
                                  Integer position,
                                  String message) {
    }
}
