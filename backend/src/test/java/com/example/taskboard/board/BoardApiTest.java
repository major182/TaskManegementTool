package com.example.taskboard.board;

import static org.assertj.core.api.Assertions.assertThat;
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

import com.example.taskboard.TestcontainersConfiguration;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * ボード API の結合テスト（docs/04_api-design.md 4.4〜4.7、4.13）。
 * 認証テストと同じく、実際に新規登録してセッションを使い回す。
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class BoardApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void 作成から一覧表示改名ゴミ箱への移動まで一通り動く() throws Exception {
        MockHttpSession session = signup("board");

        // 作成（4.6）
        MvcResult created = mockMvc.perform(post("/api/boards")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody("学習計画")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("学習計画"))
                .andExpect(jsonPath("$.lists").isEmpty())
                .andExpect(jsonPath("$.createdAt").exists())
                .andReturn();

        long boardId = idOf(created);
        assertThat(created.getResponse().getHeader("Location")).isEqualTo("/api/boards/" + boardId);

        // 一覧に出る（4.4）
        mockMvc.perform(get("/api/boards").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(boardId))
                .andExpect(jsonPath("$[0].name").value("学習計画"));

        // 表示（4.5）。リストをまだ作っていないので空
        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(boardId))
                .andExpect(jsonPath("$.lists").isArray())
                .andExpect(jsonPath("$.lists").isEmpty());

        // 名前の変更（4.7）
        mockMvc.perform(put("/api/boards/" + boardId)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody("学習計画（改訂）")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("学習計画（改訂）"));

        // ゴミ箱へ移動（4.13）。本文なしの 204
        mockMvc.perform(delete("/api/boards/" + boardId)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session))
                .andExpect(status().isNoContent());

        // 一覧からも表示からも消える
        mockMvc.perform(get("/api/boards").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(get("/api/boards/" + boardId).session(session))
                .andExpect(status().isNotFound());
    }

    @Test
    void 一覧は利用者が並べた順で返り新しいボードは一番下になる() throws Exception {
        MockHttpSession session = signup("order");
        long first = createBoard(session, "先に作ったボード");
        long second = createBoard(session, "あとで作ったボード");

        // 作った順に上から並ぶ（新しいものが一番下。業務ルール 5.2）
        mockMvc.perform(get("/api/boards").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(first))
                .andExpect(jsonPath("$[1].id").value(second));
    }

    @Test
    void 並び替えると次の一覧からその順で返る() throws Exception {
        MockHttpSession session = signup("bmove");
        long first = createBoard(session, "1番目");
        long second = createBoard(session, "2番目");
        long third = createBoard(session, "3番目");

        // 3番目を一番上へ動かす
        mockMvc.perform(patch("/api/boards/" + third + "/move")
                        .session(session)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"position\": 0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(third))
                .andExpect(jsonPath("$[0].position").value(0))
                .andExpect(jsonPath("$[1].id").value(first))
                .andExpect(jsonPath("$[1].position").value(1))
                .andExpect(jsonPath("$[2].id").value(second))
                .andExpect(jsonPath("$[2].position").value(2));

        mockMvc.perform(get("/api/boards").session(session))
                .andExpect(jsonPath("$[0].id").value(third))
                .andExpect(jsonPath("$[1].id").value(first))
                .andExpect(jsonPath("$[2].id").value(second));
    }

    @Test
    void ボードの数を超える位置は400になる() throws Exception {
        MockHttpSession session = signup("bmoveng");
        long boardId = createBoard(session, "1つだけ");

        mockMvc.perform(patch("/api/boards/" + boardId + "/move")
                        .session(session)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"position\": 5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("指定された位置にはボードを置けません"));
    }

    @Test
    void 他人のボードは並び替えられない() throws Exception {
        MockHttpSession owner = signup("bowner");
        long boardId = createBoard(owner, "他人のボード");

        MockHttpSession other = signup("bother");
        mockMvc.perform(patch("/api/boards/" + boardId + "/move")
                        .session(other)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"position\": 0}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void 他人のボードは404になる() throws Exception {
        MockHttpSession owner = signup("owner");
        long boardId = createBoard(owner, "他人のボード");

        MockHttpSession stranger = signup("other");
        mockMvc.perform(get("/api/boards/" + boardId).session(stranger))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("ボードが見つかりません"));

        // 更新・削除も同じく 404（存在を知らせないため）
        mockMvc.perform(put("/api/boards/" + boardId)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(stranger)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody("乗っ取り")))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/boards/" + boardId)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(stranger))
                .andExpect(status().isNotFound());

        // 持ち主から見れば何も変わっていない
        mockMvc.perform(get("/api/boards/" + boardId).session(owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("他人のボード"));
    }

    @Test
    void ボード名が空や50文字を超えるときは400とエラー項目を返す() throws Exception {
        MockHttpSession session = signup("valid");

        mockMvc.perform(post("/api/boards")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody("   ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("入力内容を確認してください"))
                .andExpect(jsonPath("$.errors[0].field").value("name"))
                .andExpect(jsonPath("$.errors[0].message").value("ボード名を入力してください"));

        mockMvc.perform(post("/api/boards")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody("あ".repeat(51))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].message").value("ボード名は50文字以内で入力してください"));
    }

    @Test
    void 最後に開いたボードを記録するとmeで取得できる() throws Exception {
        MockHttpSession session = signup("last");
        long boardId = createBoard(session, "学習計画");

        rememberLastOpened(session, boardId)
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastOpenedBoardId").value(boardId));
    }

    @Test
    void 記録したボードをゴミ箱へ移動すると記録も消える() throws Exception {
        MockHttpSession session = signup("clear");
        long boardId = createBoard(session, "消すボード");
        rememberLastOpened(session, boardId).andExpect(status().isNoContent());

        mockMvc.perform(delete("/api/boards/" + boardId)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session))
                .andExpect(status().isNoContent());

        // 記録が残っていると、次に開いたときに表示できないボードを取りにいってしまう
        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastOpenedBoardId").doesNotExist());
    }

    @Test
    void 他人のボードは最後に開いたボードとして記録できない() throws Exception {
        long boardId = createBoard(signup("victim"), "他人のボード");

        rememberLastOpened(signup("thief"), boardId)
                .andExpect(status().isNotFound());
    }

    @Test
    void 未ログインではボードを操作できない() throws Exception {
        mockMvc.perform(get("/api/boards"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/boards")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nameBody("勝手に作る")))
                .andExpect(status().isUnauthorized());
    }

    /** 新規登録してログイン済みのセッションを得る。ユーザーID は毎回変える。 */
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

    private org.springframework.test.web.servlet.ResultActions rememberLastOpened(
            MockHttpSession session, long boardId) throws Exception {
        String body = """
                {"boardId": %d}
                """.formatted(boardId);

        return mockMvc.perform(put("/api/me/last-opened-board")
                .with(SecurityMockMvcRequestPostProcessors.csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
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
