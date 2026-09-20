package com.example.taskboard.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.example.taskboard.TestcontainersConfiguration;

import jakarta.servlet.http.HttpSession;

/**
 * 認証 API の結合テスト（docs/04_api-design.md 4.1〜4.3）。
 * 本番と同じ PostgreSQL を Testcontainers で起動して実行する。
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AuthApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void 登録するとそのままログイン状態になりmeが取得できる() throws Exception {
        String username = "taro_" + System.nanoTime() % 100000;

        MvcResult signup = mockMvc.perform(post("/api/auth/signup")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(username, "pass1234")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.lastOpenedBoardId").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andReturn();

        HttpSession session = signup.getRequest().getSession(false);
        assertThat(session).isNotNull();

        mockMvc.perform(get("/api/auth/me").session((MockHttpSession) session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(username));
    }

    @Test
    void 同じユーザーIDでは登録できない() throws Exception {
        String username = "dup_" + System.nanoTime() % 100000;
        signup(username);

        mockMvc.perform(post("/api/auth/signup")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(username, "pass1234")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("このユーザーID は使われています"));
    }

    @Test
    void 入力のルールに合わないときは400とエラー項目を返す() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("ab", "short")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("入力内容を確認してください"))
                .andExpect(jsonPath("$.errors").isArray());
    }

    @Test
    void パスワードが違うときはどちらが違うか知らせずに401を返す() throws Exception {
        String username = "login_" + System.nanoTime() % 100000;
        signup(username);

        mockMvc.perform(post("/api/auth/login")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(username, "wrong9999")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("ユーザーID またはパスワードが違います"));
    }

    @Test
    void ログアウトするとmeは401になる() throws Exception {
        String username = "out_" + System.nanoTime() % 100000;
        MockHttpSession session = (MockHttpSession) signup(username).getRequest().getSession(false);

        mockMvc.perform(post("/api/auth/logout")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail")
                        .value("ログインの有効期限が切れました。もう一度ログインしてください"));
    }

    @Test
    void 未ログインで保護された画面用のAPIを呼ぶと401になる() throws Exception {
        mockMvc.perform(get("/api/boards"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void CSRFトークンがない更新系の通信は403になる() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("taro_123", "pass1234")))
                .andExpect(status().isForbidden());
    }

    private MvcResult signup(String username) throws Exception {
        return mockMvc.perform(post("/api/auth/signup")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(username, "pass1234")))
                .andExpect(status().isCreated())
                .andReturn();
    }

    private String body(String username, String password) {
        return """
                {"username": "%s", "password": "%s"}
                """.formatted(username, password);
    }
}
