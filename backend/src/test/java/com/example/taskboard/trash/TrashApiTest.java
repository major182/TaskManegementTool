package com.example.taskboard.trash;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * ゴミ箱 API の結合テスト（docs/04_api-design.md 4.14〜4.16）。
 * 「親の1件として表示する」「親を戻すと個別に捨てた子は戻らない」を重点的に確認する。
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class TrashApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void 捨てたものが削除日時の新しい順に並び元の場所が付く() throws Exception {
        MockHttpSession session = signup("trash");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long cardId = createCard(session, listId, "要件定義を書く");
        long otherBoard = createBoard(session, "個人タスク");
        long otherList = createList(session, boardId, "DOING");

        trash(session, "boards", otherBoard);
        trash(session, "lists", otherList);
        trash(session, "cards", cardId);

        mockMvc.perform(get("/api/trash").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].type").value("CARD"))
                .andExpect(jsonPath("$[0].id").value(cardId))
                .andExpect(jsonPath("$[0].name").value("要件定義を書く"))
                .andExpect(jsonPath("$[0].originalLocation").value("学習計画 ＞ TODO"))
                .andExpect(jsonPath("$[0].restorable").value(true))
                .andExpect(jsonPath("$[1].type").value("LIST"))
                .andExpect(jsonPath("$[1].originalLocation").value("学習計画"))
                .andExpect(jsonPath("$[2].type").value("BOARD"))
                .andExpect(jsonPath("$[2].originalLocation").doesNotExist());

        mockMvc.perform(get("/api/trash/count").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(3));
    }

    @Test
    void 親と一緒にゴミ箱へ入った子は親の1件として表示する() throws Exception {
        MockHttpSession session = signup("parent");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        createCard(session, listId, "1枚目");

        trash(session, "lists", listId);

        // カードは自分で捨てていないので出ない。リスト1件だけ
        mockMvc.perform(get("/api/trash").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("LIST"));
    }

    @Test
    void 自分で捨てた子は親も捨てたあとも表示し続けるが戻せない() throws Exception {
        MockHttpSession session = signup("ownchild");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long cardId = createCard(session, listId, "自分で捨てるカード");

        // カードを先に捨て、あとから親のリストも捨てる
        trash(session, "cards", cardId);
        trash(session, "lists", listId);

        // カードが消えずに残っていること。戻すリストが無いので戻せない
        mockMvc.perform(get("/api/trash").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].type").value("LIST"))
                .andExpect(jsonPath("$[0].restorable").value(true))
                .andExpect(jsonPath("$[1].type").value("CARD"))
                .andExpect(jsonPath("$[1].restorable").value(false));

        mockMvc.perform(get("/api/trash/count").session(session))
                .andExpect(jsonPath("$.count").value(2));
    }

    @Test
    void 自分で捨てたリストは親のボードを捨てても表示し続けるが戻せない() throws Exception {
        MockHttpSession session = signup("ownlist");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");

        trash(session, "lists", listId);
        trash(session, "boards", boardId);

        mockMvc.perform(get("/api/trash").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].type").value("BOARD"))
                .andExpect(jsonPath("$[0].restorable").value(true))
                .andExpect(jsonPath("$[1].type").value("LIST"))
                .andExpect(jsonPath("$[1].restorable").value(false));
    }

    @Test
    void 親を戻すと子はまた戻せるようになる() throws Exception {
        MockHttpSession session = signup("again");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long cardId = createCard(session, listId, "自分で捨てるカード");

        trash(session, "cards", cardId);
        trash(session, "lists", listId);
        restore(session, "lists", listId).andExpect(status().isOk());

        // カードはゴミ箱に残ったまま。元のリストが戻ったので戻せるようになる
        mockMvc.perform(get("/api/trash").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("CARD"))
                .andExpect(jsonPath("$[0].restorable").value(true));
    }

    @Test
    void 親がゴミ箱にある子も完全に削除できる() throws Exception {
        MockHttpSession session = signup("purgechild");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long cardId = createCard(session, listId, "自分で捨てるカード");

        trash(session, "cards", cardId);
        trash(session, "lists", listId);

        mockMvc.perform(delete("/api/trash/cards/" + cardId).session(session).with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/trash").session(session))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("LIST"));
    }

    @Test
    void ゴミ箱を空にすると親がゴミ箱にある子も消える() throws Exception {
        MockHttpSession session = signup("emptyall");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long cardId = createCard(session, listId, "自分で捨てるカード");

        trash(session, "cards", cardId);
        trash(session, "lists", listId);
        trash(session, "boards", boardId);

        mockMvc.perform(delete("/api/trash").session(session).with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/trash/count").session(session))
                .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void ボードを戻すと個別に捨てたカードは戻らない() throws Exception {
        MockHttpSession session = signup("restore");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long kept = createCard(session, listId, "残すカード");
        long dropped = createCard(session, listId, "個別に捨てたカード");

        trash(session, "cards", dropped);
        trash(session, "boards", boardId);

        restore(session, "boards", boardId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("BOARD"))
                .andExpect(jsonPath("$.id").value(boardId))
                .andExpect(jsonPath("$.message").doesNotExist());

        // 捨てていないカードだけが戻る（docs/03_db-design.md 1.1）
        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[0].cards.length()").value(1))
                .andExpect(jsonPath("$.lists[0].cards[0].id").value(kept));

        // 個別に捨てたカードはゴミ箱に残っている
        mockMvc.perform(get("/api/trash").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(dropped));
    }

    @Test
    void リストは一番右カードは一番下に戻る() throws Exception {
        MockHttpSession session = signup("tail");
        long boardId = createBoard(session, "学習計画");
        long todo = createList(session, boardId, "TODO");
        long doing = createList(session, boardId, "DOING");
        long first = createCard(session, todo, "1枚目");
        long target = createCard(session, todo, "戻すカード");

        // カードを先に捨てる。リストを捨てたあとでは、中のカードはもう操作できない
        trash(session, "cards", first);
        trash(session, "lists", todo);

        // リストは一番右へ（元は一番左だった）
        restore(session, "lists", todo)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("LIST"))
                .andExpect(jsonPath("$.position").value(1));

        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[0].id").value(doing))
                .andExpect(jsonPath("$.lists[1].id").value(todo));

        // カードは一番下へ（target が残っているので position 1）
        restore(session, "cards", first)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("CARD"))
                .andExpect(jsonPath("$.listId").value(todo))
                .andExpect(jsonPath("$.position").value(1))
                .andExpect(jsonPath("$.message").doesNotExist());

        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[1].cards[0].id").value(target))
                .andExpect(jsonPath("$.lists[1].cards[1].id").value(first));
    }

    @Test
    void 元のリストがないカードは一番左のリストに戻る() throws Exception {
        MockHttpSession session = signup("moved");
        long boardId = createBoard(session, "学習計画");
        long todo = createList(session, boardId, "TODO");
        long doing = createList(session, boardId, "DOING");
        long cardId = createCard(session, doing, "戻すカード");

        trash(session, "cards", cardId);
        trash(session, "lists", doing);

        restore(session, "cards", cardId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.listId").value(todo))
                .andExpect(jsonPath("$.message").value("元のリストがないため、一番左のリストに戻しました"));
    }

    @Test
    void 戻す場所がないときは409になる() throws Exception {
        MockHttpSession session = signup("noplace");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long cardId = createCard(session, listId, "戻すカード");

        trash(session, "cards", cardId);
        trash(session, "lists", listId);
        // ボードにリストが1つもなくなった状態

        restore(session, "cards", cardId)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("戻せる場所がないため戻せません"));

        // 元のボードがゴミ箱にあるリストも戻せない
        trash(session, "boards", boardId);
        restore(session, "lists", listId)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("元のボードがないため戻せません"));
    }

    @Test
    void 完全に削除すると子も消えて元に戻せない() throws Exception {
        MockHttpSession session = signup("purge");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long cardId = createCard(session, listId, "1枚目");

        trash(session, "boards", boardId);

        mockMvc.perform(delete("/api/trash/boards/" + boardId)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/trash").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        restore(session, "boards", boardId).andExpect(status().isNotFound());
        // 中のカードも CASCADE で消えている
        restore(session, "cards", cardId).andExpect(status().isNotFound());
    }

    @Test
    void ゴミ箱を空にすると全部消える() throws Exception {
        MockHttpSession session = signup("empty");
        long boardId = createBoard(session, "学習計画");
        long listId = createList(session, boardId, "TODO");
        long cardId = createCard(session, listId, "1枚目");
        long otherList = createList(session, boardId, "DOING");
        long otherBoard = createBoard(session, "個人タスク");

        trash(session, "cards", cardId);
        trash(session, "lists", otherList);
        trash(session, "boards", otherBoard);

        mockMvc.perform(delete("/api/trash")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/trash/count").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0));

        // 捨てていないボードとリストは残る
        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists.length()").value(1))
                .andExpect(jsonPath("$.lists[0].id").value(listId));
    }

    @Test
    void 他人のゴミ箱には手が届かない() throws Exception {
        MockHttpSession owner = signup("owner");
        long boardId = createBoard(owner, "他人のボード");
        trash(owner, "boards", boardId);

        MockHttpSession stranger = signup("thief");

        mockMvc.perform(get("/api/trash").session(stranger))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        restore(stranger, "boards", boardId).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/trash/boards/" + boardId)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(stranger))
                .andExpect(status().isNotFound());

        // 空にしても他人のものは消えない
        mockMvc.perform(delete("/api/trash")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(stranger))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/trash/count").session(owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1));
    }

    @Test
    void 知らない種類を指定すると404になる() throws Exception {
        MockHttpSession session = signup("type");

        restore(session, "users", 1L).andExpect(status().isNotFound());
    }

    private ResultActions restore(MockHttpSession session, String type, long id) throws Exception {
        return mockMvc.perform(post("/api/trash/" + type + "/" + id + "/restore")
                .with(SecurityMockMvcRequestPostProcessors.csrf())
                .session(session));
    }

    /** ゴミ箱へ移動する。{type} に合わせて DELETE /api/{type}/{id} を呼ぶ。 */
    private void trash(MockHttpSession session, String type, long id) throws Exception {
        mockMvc.perform(delete("/api/" + type + "/" + id)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session))
                .andExpect(status().isNoContent());
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
        String body = """
                {"title": "%s"}
                """.formatted(title);

        MvcResult result = mockMvc.perform(post("/api/lists/" + listId + "/cards")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return idOf(result);
    }

    private String nameBody(String name) {
        return """
                {"name": "%s"}
                """.formatted(name);
    }

    private long idOf(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.get("id").asLong();
    }
}
