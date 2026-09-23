package com.example.taskboard.card;

import java.net.URI;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.example.taskboard.auth.AppUserDetails;
import com.example.taskboard.board.BoardDtos.CardResponse;
import com.example.taskboard.card.CardDtos.CardCreateRequest;
import com.example.taskboard.card.CardDtos.CardMoveRequest;
import com.example.taskboard.card.CardDtos.CardMoveResponse;
import com.example.taskboard.card.CardDtos.CardUpdateRequest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * カード API（docs/04_api-design.md 3.4）。
 * 作成だけはリストに属するため /api/lists/{listId}/cards、
 * それ以外はカード自身を指す /api/cards/{cardId} になる。
 */
@RestController
@Tag(name = "カード", description = "カードの作成・更新・ゴミ箱への移動・移動")
public class CardController {

    private final CardService cardService;

    public CardController(CardService cardService) {
        this.cardService = cardService;
    }

    /** カード作成（F-31）。期限日は空、未完了で作られる。 */
    @PostMapping("/api/lists/{listId}/cards")
    @Operation(summary = "カード作成", description = "リストの一番下に追加する")
    public ResponseEntity<CardResponse> create(@AuthenticationPrincipal AppUserDetails user,
                                                   @PathVariable Long listId,
                                               @Valid @RequestBody CardCreateRequest request) {
        Card card = cardService.create(user.getId(), listId, request.title());

        return ResponseEntity.created(URI.create("/api/cards/" + card.getId()))
                .body(CardResponse.from(card));
    }

    /** カードの更新（F-32、F-35、F-38）。4項目すべてを送ってもらう。 */
    @PutMapping("/api/cards/{cardId}")
    @Operation(summary = "カードの更新",
            description = "タイトル・説明文・期限日・完了をまとめて置き換える。dueDate の null は「期限日なし」")
    public CardResponse update(@AuthenticationPrincipal AppUserDetails user,
                                   @PathVariable Long cardId,
                               @Valid @RequestBody CardUpdateRequest request) {
        return CardResponse.from(cardService.update(user.getId(), cardId,
                request.title(), request.description(), request.dueDate(), request.isDone()));
    }

    /** ゴミ箱へ移動（F-33）。 */
    @DeleteMapping("/api/cards/{cardId}")
    @Operation(summary = "カードをゴミ箱へ移動", description = "残ったカードの並び順は詰め直される")
    public ResponseEntity<Void> moveToTrash(@AuthenticationPrincipal AppUserDetails user,
                                                @PathVariable Long cardId) {
        cardService.moveToTrash(user.getId(), cardId);
        return ResponseEntity.noContent().build();
    }

    /** カードの移動（F-34）。同じリスト内の並び替えも、別のリストへの移動もこれ1つで行う。 */
    @PatchMapping("/api/cards/{cardId}/move")
    @Operation(summary = "カードの移動", description = "影響したリスト（移動元・移動先）のカードの並びを返す")
    public CardMoveResponse move(@AuthenticationPrincipal AppUserDetails user,
                                     @PathVariable Long cardId,
                                 @Valid @RequestBody CardMoveRequest request) {
        return cardService.move(user.getId(), cardId, request.listId(), request.position());
    }
}
