package com.example.taskboard.board;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.taskboard.auth.AppUserDetails;
import com.example.taskboard.board.BoardDtos.BoardCreatedResponse;
import com.example.taskboard.board.BoardDtos.BoardDetailResponse;
import com.example.taskboard.board.BoardDtos.BoardNameRequest;
import com.example.taskboard.board.BoardDtos.BoardNameResponse;
import com.example.taskboard.board.BoardDtos.BoardSummaryResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * ボード API（docs/04_api-design.md 3.2）。
 * 業務ルールはすべて BoardService に置き、ここは入出力の変換だけを行う。
 */
@RestController
@RequestMapping("/api/boards")
@Tag(name = "ボード", description = "ボードの一覧・作成・表示・名前の変更・ゴミ箱への移動")
public class BoardController {

    private final BoardService boardService;

    public BoardController(BoardService boardService) {
        this.boardService = boardService;
    }

    /** ボード一覧（F-11）。サイドバー用なのでリスト・カードは含めない。 */
    @GetMapping
    @Operation(summary = "ボード一覧", description = "作成日の新しい順。ゴミ箱のボードは含まない")
    public List<BoardSummaryResponse> list(@AuthenticationPrincipal AppUserDetails user) {
        return boardService.findAll(user.getId()).stream()
                .map(BoardSummaryResponse::from)
                .toList();
    }

    /** ボード作成（F-12）。 */
    @PostMapping
    @Operation(summary = "ボード作成")
    public ResponseEntity<BoardCreatedResponse> create(@AuthenticationPrincipal AppUserDetails user,
                                                           @Valid @RequestBody BoardNameRequest request) {
        Board board = boardService.create(user.getId(), request.name());

        return ResponseEntity.created(URI.create("/api/boards/" + board.getId()))
                .body(BoardCreatedResponse.from(board));
    }

    /** ボード1件＋リスト＋カード（F-02）。画面表示はこの1回で足りるようにする。 */
    @GetMapping("/{boardId}")
    @Operation(summary = "ボードの表示", description = "リストとカードを入れ子で返す。ゴミ箱のリスト・カードは含まない")
    public BoardDetailResponse detail(@AuthenticationPrincipal AppUserDetails user,
                                          @PathVariable Long boardId) {
        return boardService.findDetail(user.getId(), boardId);
    }

    /** ボード名の変更（F-13）。 */
    @PutMapping("/{boardId}")
    @Operation(summary = "ボード名の変更")
    public BoardNameResponse rename(@AuthenticationPrincipal AppUserDetails user,
                                        @PathVariable Long boardId,
                                    @Valid @RequestBody BoardNameRequest request) {
        return BoardNameResponse.from(boardService.rename(user.getId(), boardId, request.name()));
    }

    /** ゴミ箱へ移動（F-14）。確認ダイアログは出さない（docs/01-3_business-rules.md 5.3）。 */
    @DeleteMapping("/{boardId}")
    @Operation(summary = "ボードをゴミ箱へ移動", description = "完全には削除せず、ゴミ箱から元に戻せる")
    public ResponseEntity<Void> moveToTrash(@AuthenticationPrincipal AppUserDetails user,
                                                @PathVariable Long boardId) {
        boardService.moveToTrash(user.getId(), boardId);
        return ResponseEntity.noContent().build();
    }
}
