package com.example.taskboard.list;

import java.net.URI;
import java.util.List;

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
import com.example.taskboard.list.TaskListDtos.MoveRequest;
import com.example.taskboard.list.TaskListDtos.TaskListCreatedResponse;
import com.example.taskboard.list.TaskListDtos.TaskListNameRequest;
import com.example.taskboard.list.TaskListDtos.TaskListNameResponse;
import com.example.taskboard.list.TaskListDtos.TaskListPositionResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * リスト API（docs/04_api-design.md 3.3）。
 * 作成だけはボードに属するため /api/boards/{boardId}/lists、
 * それ以外はリスト自身を指す /api/lists/{listId} になる。
 */
@RestController
@Tag(name = "リスト", description = "リストの作成・名前の変更・ゴミ箱への移動・並び替え")
public class TaskListController {

    private final TaskListService taskListService;

    public TaskListController(TaskListService taskListService) {
        this.taskListService = taskListService;
    }

    /** リスト作成（F-21）。位置は指定させず、サーバーが一番右に置く。 */
    @PostMapping("/api/boards/{boardId}/lists")
    @Operation(summary = "リスト作成", description = "ボードの一番右に追加する")
    public ResponseEntity<TaskListCreatedResponse> create(@AuthenticationPrincipal AppUserDetails user,
                                                              @PathVariable Long boardId,
                                                          @Valid @RequestBody TaskListNameRequest request) {
        TaskList list = taskListService.create(user.getId(), boardId, request.name());

        return ResponseEntity.created(URI.create("/api/lists/" + list.getId()))
                .body(TaskListCreatedResponse.from(list));
    }

    /** リスト名の変更（F-22）。 */
    @PutMapping("/api/lists/{listId}")
    @Operation(summary = "リスト名の変更")
    public TaskListNameResponse rename(@AuthenticationPrincipal AppUserDetails user,
                                           @PathVariable Long listId,
                                       @Valid @RequestBody TaskListNameRequest request) {
        return TaskListNameResponse.from(
                taskListService.rename(user.getId(), listId, request.name()));
    }

    /** ゴミ箱へ移動（F-23）。中のカードごと移動する。 */
    @DeleteMapping("/api/lists/{listId}")
    @Operation(summary = "リストをゴミ箱へ移動", description = "残ったリストの並び順は詰め直される")
    public ResponseEntity<Void> moveToTrash(@AuthenticationPrincipal AppUserDetails user,
                                                @PathVariable Long listId) {
        taskListService.moveToTrash(user.getId(), listId);
        return ResponseEntity.noContent().build();
    }

    /** 並び替え（F-24）。再採番の結果をそのまま返す。 */
    @PatchMapping("/api/lists/{listId}/move")
    @Operation(summary = "リストの並び替え", description = "並び替えたあとのボード内のリストの順番を返す")
    public List<TaskListPositionResponse> move(@AuthenticationPrincipal AppUserDetails user,
                                                   @PathVariable Long listId,
                                               @Valid @RequestBody MoveRequest request) {
        return taskListService.move(user.getId(), listId, request.position()).stream()
                .map(TaskListPositionResponse::from)
                .toList();
    }
}
