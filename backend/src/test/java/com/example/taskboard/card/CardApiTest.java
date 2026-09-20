package com.example.taskboard.card;

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
 * カード API の結合テスト（docs/04_api-design.md 4.10〜4.12）。
 * 別のリストへ移したあとの並びを、ボードの表示（4.5）でも確認する。
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class CardApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void 作ったカードは上から順に一番下へ追加される() throws Exception {
        MockHttpSession session = signup("card");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");

        long first = createCard(session, listId, "要件定義を書く");

        // 作成の応答（4.10）。期限日は空・未完了で作られる
        mockMvc.perform(post("/api/lists/" + listId + "/cards")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleBody("DB設計")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("DB設計"))
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.dueDate").doesNotExist())
                .andExpect(jsonPath("$.isDone").value(false))
                .andExpect(jsonPath("$.position").value(1));

        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[0].cards[0].id").value(first))
                .andExpect(jsonPath("$.lists[0].cards[0].position").value(0));
    }

    @Test
    void すべての項目をまとめて更新でき期限日はnullで消せる() throws Exception {
        MockHttpSession session = signup("update");
        long listId = createList(session, createBoard(session, "学習計画"), "TODO");
        long cardId = createCard(session, listId, "要件定義を書く");

        // 期限日と説明文を入れる
        update(session, cardId, """
                {"title": "要件定義を書く", "description": "01〜01-5 を仕上げる",
                 "dueDate": "2026-09-30", "isDone": false}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("01〜01-5 を仕上げる"))
                .andExpect(jsonPath("$.dueDate").value("2026-09-30"))
                .andExpect(jsonPath("$.isDone").value(false));

        // 期限日を消して完了にする（4.11 の例）
        update(session, cardId, """
                {"title": "要件定義を書く", "description": "01〜01-5 を仕上げる",
                 "dueDate": null, "isDone": true}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dueDate").doesNotExist())
                .andExpect(jsonPath("$.isDone").value(true));
    }

    @Test
    void 同じリスト内で並び替えられる() throws Exception {
        MockHttpSession session = signup("sort");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long first = createCard(session, listId, "1枚目");
        long second = createCard(session, listId, "2枚目");
        long third = createCard(session, listId, "3枚目");

        move(session, third, listId, 0)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists.length()").value(1))
                .andExpect(jsonPath("$.lists[0].listId").value(listId))
                .andExpect(jsonPath("$.lists[0].cardIds[0]").value(third))
                .andExpect(jsonPath("$.lists[0].cardIds[1]").value(first))
                .andExpect(jsonPath("$.lists[0].cardIds[2]").value(second));

        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[0].cards[0].id").value(third))
                .andExpect(jsonPath("$.lists[0].cards[0].position").value(0))
                .andExpect(jsonPath("$.lists[0].cards[2].id").value(second));
    }

    @Test
    void 別のリストへ移すと移動元と移動先の並びが返る() throws Exception {
        MockHttpSession session = signup("across");
        long boardId = createBoard(session, "学習計画");
        long todo = createList(session, boardId, "TODO");
        long doing = createList(session, boardId, "DOING");
        long first = createCard(session, todo, "1枚目");
        long target = createCard(session, todo, "移すカード");
        long third = createCard(session, todo, "3枚目");
        long other = createCard(session, doing, "移動先の1枚目");

        move(session, target, doing, 0)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists.length()").value(2))
                .andExpect(jsonPath("$.lists[0].listId").value(todo))
                .andExpect(jsonPath("$.lists[0].cardIds[0]").value(first))
                .andExpect(jsonPath("$.lists[0].cardIds[1]").value(third))
                .andExpect(jsonPath("$.lists[1].listId").value(doing))
                .andExpect(jsonPath("$.lists[1].cardIds[0]").value(target))
                .andExpect(jsonPath("$.lists[1].cardIds[1]").value(other));

        // 移動元は穴が詰まり、移動先は後ろへずれている
        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[0].cards.length()").value(2))
                .andExpect(jsonPath("$.lists[0].cards[1].id").value(third))
                .andExpect(jsonPath("$.lists[0].cards[1].position").value(1))
                .andExpect(jsonPath("$.lists[1].cards[0].id").value(target))
                .andExpect(jsonPath("$.lists[1].cards[0].position").value(0))
                .andExpect(jsonPath("$.lists[1].cards[1].position").value(1));
    }

    @Test
    void 範囲外の位置や別のボードのリストへは移動できない() throws Exception {
        MockHttpSession session = signup("badmove");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long cardId = createCard(session, listId, "1枚目");

        // 自分を抜くと0枚なので、置けるのは 0 だけ
        move(session, cardId, listId, 1)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("指定された位置にはカードを置けません"));

        move(session, cardId, listId, -1)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].message").value("位置は0以上で指定してください"));

        long otherBoardList = createList(session, createBoard(session, "別のボード"), "TODO");
        move(session, cardId, otherBoardList, 0)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("別のボードのリストへは移動できません"));
    }

    @Test
    void ゴミ箱へ移動すると表示から消え残りの並びが詰まる() throws Exception {
        MockHttpSession session = signup("trash");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long first = createCard(session, listId, "1枚目");
        long second = createCard(session, listId, "2枚目");
        long third = createCard(session, listId, "3枚目");

        mockMvc.perform(delete("/api/cards/" + second)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[0].cards.length()").value(2))
                .andExpect(jsonPath("$.lists[0].cards[0].id").value(first))
                .andExpect(jsonPath("$.lists[0].cards[1].id").value(third))
                .andExpect(jsonPath("$.lists[0].cards[1].position").value(1));

        // 詰め直したあとに作っても位置がぶつからない
        long fourth = createCard(session, listId, "4枚目");
        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[0].cards[2].id").value(fourth))
                .andExpect(jsonPath("$.lists[0].cards[2].position").value(2));
    }

    @Test
    void リストをゴミ箱へ移動しても中のカードは表示から消える() throws Exception {
        MockHttpSession session = signup("parent");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long cardId = createCard(session, listId, "1枚目");

        mockMvc.perform(delete("/api/lists/" + listId)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists").isEmpty());

        // 親がゴミ箱にあるカードも操作できない
        update(session, cardId, """
                {"title": "触れない", "description": null, "dueDate": null, "isDone": false}
                """)
                .andExpect(status().isNotFound());
    }

    @Test
    void 他人のリストやカードは操作できない() throws Exception {
        MockHttpSession owner = signup("owner");
        long listId = createList(owner, createBoard(owner, "他人のボード"), "TODO");
        long cardId = createCard(owner, listId, "他人のカード");

        MockHttpSession stranger = signup("thief");

        mockMvc.perform(post("/api/lists/" + listId + "/cards")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(stranger)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleBody("勝手に作る")))
                .andExpect(status().isNotFound());

        update(stranger, cardId, """
                {"title": "乗っ取り", "description": null, "dueDate": null, "isDone": true}
                """)
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/cards/" + cardId)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(stranger))
                .andExpect(status().isNotFound());

        move(stranger, cardId, listId, 0).andExpect(status().isNotFound());
    }

    @Test
    void タイトルや説明文が長すぎるときは400になる() throws Exception {
        MockHttpSession session = signup("valid");
        long listId = createList(session, createBoard(session, "学習計画"), "TODO");

        mockMvc.perform(post("/api/lists/" + listId + "/cards")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleBody("   ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].message").value("タイトルを入力してください"));

        long cardId = createCard(session, listId, "1枚目");
        update(session, cardId, """
                {"title": "%s", "description": null, "dueDate": null, "isDone": false}
                """.formatted("あ".repeat(101)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].message").value("タイトルは100文字以内で入力してください"));

        update(session, cardId, """
                {"title": "1枚目", "description": "%s", "dueDate": null, "isDone": false}
                """.formatted("あ".repeat(2001)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].message").value("説明文は2,000文字以内で入力してください"));
    }

    private ResultActions update(MockHttpSession session, long cardId, String body) throws Exception {
        return mockMvc.perform(put("/api/cards/" + cardId)
                .with(SecurityMockMvcRequestPostProcessors.csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private ResultActions move(MockHttpSession session, long cardId, long listId, int position)
            throws Exception {
        String body = """
                {"listId": %d, "position": %d}
                """.formatted(listId, position);

        return mockMvc.perform(patch("/api/cards/" + cardId + "/move")
                .with(SecurityMockMvcRequestPostProcessors.csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
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

    private long createCard(MockHttpSession session, long listId, String title) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/lists/" + listId + "/cards")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleBody(title)))
                .andExpect(status().isCreated())
                .andReturn();
        return idOf(result);
    }

    private String nameBody(String name) {
        return """
                {"name": "%s"}
                """.formatted(name);
    }

    private String titleBody(String title) {
        return """
                {"title": "%s"}
                """.formatted(title);
    }

    private long idOf(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.get("id").asLong();
    }
}
