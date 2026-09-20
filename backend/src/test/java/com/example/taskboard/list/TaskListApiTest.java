package com.example.taskboard.list;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import com.example.taskboard.TestcontainersConfiguration;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * リスト API の結合テスト（docs/04_api-design.md 4.8、4.9）。
 * 並び替えのあとに position が 0 からの連番になっていることを、DB 経由で確認する。
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class TaskListApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void 作ったリストは左から順に一番右へ追加される() throws Exception {
        MockHttpSession session = signup("list");
        long boardId = createBoard(session, "学習計画");

        long todo = createList(session, boardId, "TODO");
        long doing = createList(session, boardId, "DOING");

        // 作成の応答（4.8）。2つ目は position 1
        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[0].id").value(todo))
                .andExpect(jsonPath("$.lists[0].position").value(0))
                .andExpect(jsonPath("$.lists[0].cards").isEmpty())
                .andExpect(jsonPath("$.lists[1].id").value(doing))
                .andExpect(jsonPath("$.lists[1].position").value(1));
    }

    @Test
    void リスト名を変更できる() throws Exception {
        MockHttpSession session = signup("rename");
        long listId = createList(session, createBoard(session, "学習計画"), "TODO");

        mockMvc.perform(put("/api/lists/" + listId)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody("やること")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(listId))
                .andExpect(jsonPath("$.name").value("やること"));
    }

    @Test
    void 並び替えると再採番の結果が返る() throws Exception {
        MockHttpSession session = signup("move");
        long boardId = createBoard(session, "学習計画");
        long todo = createList(session, boardId, "TODO");
        long doing = createList(session, boardId, "DOING");
        long done = createList(session, boardId, "DONE");

        // 一番右の DONE を一番左へ（4.9）
        mockMvc.perform(patch("/api/lists/" + done + "/move")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(positionBody(0)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(done))
                .andExpect(jsonPath("$[0].position").value(0))
                .andExpect(jsonPath("$[1].id").value(todo))
                .andExpect(jsonPath("$[1].position").value(1))
                .andExpect(jsonPath("$[2].id").value(doing))
                .andExpect(jsonPath("$[2].position").value(2));

        // 保存されているか、ボードの表示でも確認する
        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[0].id").value(done))
                .andExpect(jsonPath("$.lists[1].id").value(todo))
                .andExpect(jsonPath("$.lists[2].id").value(doing));
    }

    @Test
    void 範囲外の位置を指定すると400になる() throws Exception {
        MockHttpSession session = signup("range");
        long boardId = createBoard(session, "学習計画");
        long todo = createList(session, boardId, "TODO");
        createList(session, boardId, "DOING");

        // リストは2つなので 2 は置けない
        move(session, todo, 2)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("指定された位置にはリストを置けません"));

        // 負の数は入力チェックで弾く
        move(session, todo, -1)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].message").value("位置は0以上で指定してください"));
    }

    @Test
    void ゴミ箱へ移動すると表示から消え残りの並びが詰まる() throws Exception {
        MockHttpSession session = signup("trash");
        long boardId = createBoard(session, "学習計画");
        long todo = createList(session, boardId, "TODO");
        long doing = createList(session, boardId, "DOING");
        long done = createList(session, boardId, "DONE");

        mockMvc.perform(delete("/api/lists/" + doing)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists.length()").value(2))
                .andExpect(jsonPath("$.lists[0].id").value(todo))
                .andExpect(jsonPath("$.lists[0].position").value(0))
                .andExpect(jsonPath("$.lists[1].id").value(done))
                .andExpect(jsonPath("$.lists[1].position").value(1));

        // ゴミ箱に入ったリストはもう操作できない
        mockMvc.perform(put("/api/lists/" + doing)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody("戻したい")))
                .andExpect(status().isNotFound());
    }

    @Test
    void 詰め直したあとに新しく作ると末尾に入る() throws Exception {
        MockHttpSession session = signup("append");
        long boardId = createBoard(session, "学習計画");
        long todo = createList(session, boardId, "TODO");
        long doing = createList(session, boardId, "DOING");

        mockMvc.perform(delete("/api/lists/" + todo)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session))
                .andExpect(status().isNoContent());

        // 残りは DOING だけ（position 0）なので、新しいリストは position 1
        long done = createList(session, boardId, "DONE");
        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[0].id").value(doing))
                .andExpect(jsonPath("$.lists[0].position").value(0))
                .andExpect(jsonPath("$.lists[1].id").value(done))
                .andExpect(jsonPath("$.lists[1].position").value(1));
    }

    @Test
    void 他人のボードやリストは操作できない() throws Exception {
        MockHttpSession owner = signup("owner");
        long boardId = createBoard(owner, "他人のボード");
        long listId = createList(owner, boardId, "TODO");

        MockHttpSession stranger = signup("thief");

        mockMvc.perform(post("/api/boards/" + boardId + "/lists")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(stranger)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody("勝手に作る")))
                .andExpect(status().isNotFound());

        mockMvc.perform(put("/api/lists/" + listId)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(stranger)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody("乗っ取り")))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/lists/" + listId)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(stranger))
                .andExpect(status().isNotFound());

        move(stranger, listId, 0).andExpect(status().isNotFound());
    }

    @Test
    void リスト名が空や50文字を超えるときは400になる() throws Exception {
        MockHttpSession session = signup("valid");
        long boardId = createBoard(session, "学習計画");

        mockMvc.perform(post("/api/boards/" + boardId + "/lists")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody("   ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("name"))
                .andExpect(jsonPath("$.errors[0].message").value("リスト名を入力してください"));

        mockMvc.perform(post("/api/boards/" + boardId + "/lists")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody("あ".repeat(51))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].message").value("リスト名は50文字以内で入力してください"));
    }

    private ResultActions move(MockHttpSession session, long listId, int position) throws Exception {
        return mockMvc.perform(patch("/api/lists/" + listId + "/move")
                .with(SecurityMockMvcRequestPostProcessors.csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(positionBody(position)));
    }

    private MockHttpSession signup(String prefix) throws Exception {
        String body = """
                {"username": "%s_%d", "password": "pass1234"}
                """.formatted(prefix, System.nanoTime() % 100000);

        MvcResult result = mockMvc.perform(post("/api/auth/signup")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private long createBoard(MockHttpSession session, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/boards")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody(name)))
                .andExpect(status().isCreated())
                .andReturn();
        return idOf(result);
    }

    private long createList(MockHttpSession session, long boardId, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/boards/" + boardId + "/lists")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody(name)))
                .andExpect(status().isCreated())
                .andReturn();
        return idOf(result);
    }

    private String nameBody(String name) {
        return """
                {"name": "%s"}
                """.formatted(name);
    }

    private String positionBody(int position) {
        return """
                {"position": %d}
                """.formatted(position);
    }

    private long idOf(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.get("id").asLong();
    }
}
