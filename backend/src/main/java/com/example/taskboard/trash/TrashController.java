package com.example.taskboard.trash;

import java.util.List;
import java.util.Locale;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.taskboard.auth.AppUserDetails;
import com.example.taskboard.common.NotFoundException;
import com.example.taskboard.trash.TrashDtos.RestoreResponse;
import com.example.taskboard.trash.TrashDtos.TrashCountResponse;
import com.example.taskboard.trash.TrashDtos.TrashItemResponse;
import com.example.taskboard.trash.TrashDtos.TrashType;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * ゴミ箱 API（docs/04_api-design.md 3.5）。
 * 「完全に削除」「空にする」の確認ダイアログは画面側で出す決まりなので、
 * API は確認済みとして処理する（docs/01-3_business-rules.md 5.3）。
 */
@RestController
@RequestMapping("/api/trash")
@Tag(name = "ゴミ箱", description = "ゴミ箱の一覧・件数・元に戻す・完全に削除・空にする")
public class TrashController {

    private final TrashService trashService;

    public TrashController(TrashService trashService) {
        this.trashService = trashService;
    }

    /** ゴミ箱の一覧（F-41）。削除日時の新しい順。 */
    @GetMapping
    @Operation(summary = "ゴミ箱の一覧",
            description = "ボード・リスト・カードをまとめて返す。親がゴミ箱にある子は親の1件として表示するため含まない")
    public List<TrashItemResponse> list(@AuthenticationPrincipal AppUserDetails user) {
        return trashService.findAll(user.getId());
    }

    /** ゴミ箱の件数（F-41）。サイドバーに出す。 */
    @GetMapping("/count")
    @Operation(summary = "ゴミ箱の件数")
    public TrashCountResponse count(@AuthenticationPrincipal AppUserDetails user) {
        return new TrashCountResponse(trashService.count(user.getId()));
    }

    /** 元に戻す（F-42）。リストは一番右、カードは一番下に戻る。 */
    @PostMapping("/{type}/{id}/restore")
    @Operation(summary = "元に戻す",
            description = "元の場所に戻せないときは 409。元のリストがないカードは一番左のリストに戻り、message が入る")
    public RestoreResponse restore(@AuthenticationPrincipal AppUserDetails user,
                                       @PathVariable String type, @PathVariable Long id) {
        return trashService.restore(user.getId(), toType(type), id);
    }

    /** 完全に削除（F-43）。 */
    @DeleteMapping("/{type}/{id}")
    @Operation(summary = "完全に削除", description = "元に戻せない。子のデータも一緒に消える")
    public ResponseEntity<Void> deletePermanently(@AuthenticationPrincipal AppUserDetails user,
                                                      @PathVariable String type, @PathVariable Long id) {
        trashService.deletePermanently(user.getId(), toType(type), id);
        return ResponseEntity.noContent().build();
    }

    /** ゴミ箱を空にする（F-44）。 */
    @DeleteMapping
    @Operation(summary = "ゴミ箱を空にする", description = "元に戻せない")
    public ResponseEntity<Void> empty(@AuthenticationPrincipal AppUserDetails user) {
        trashService.empty(user.getId());
        return ResponseEntity.noContent().build();
    }

    /**
     * URL の {type}（boards / lists / cards）を種類に変換する。
     * 知らない値は「そんなものはない」という意味で 404 にする。
     */
    private TrashType toType(String type) {
        return switch (type.toLowerCase(Locale.ROOT)) {
            case "boards" -> TrashType.BOARD;
            case "lists" -> TrashType.LIST;
            case "cards" -> TrashType.CARD;
            default -> throw new NotFoundException("ゴミ箱にデータが見つかりません");
        };
    }
}
