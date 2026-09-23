package com.example.taskboard.board;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.taskboard.auth.AppUserDetails;
import com.example.taskboard.board.BoardDtos.LastOpenedBoardRequest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * 最後に開いていたボードの記録（docs/04_api-design.md 3.1 の F-15）。
 * 扱う内容がボードなので auth ではなく board パッケージに置く。
 */
@RestController
@RequestMapping("/api/me")
@Tag(name = "利用者", description = "ログイン中の利用者に紐づく設定")
public class LastOpenedBoardController {

    private final BoardService boardService;

    public LastOpenedBoardController(BoardService boardService) {
        this.boardService = boardService;
    }

    /**
     * 最後に開いていたボードを記録する（F-15）。
     * 次にログインしたときに、このボードを開いた状態で表示する。
     */
    @PutMapping("/last-opened-board")
    @Operation(summary = "最後に開いたボードの記録", description = "記録するだけなので本文は返さない")
    public ResponseEntity<Void> update(@AuthenticationPrincipal AppUserDetails user,
                                           @Valid @RequestBody LastOpenedBoardRequest request) {
        boardService.updateLastOpenedBoard(user.getId(), request.boardId());
        return ResponseEntity.noContent().build();
    }
}
