package com.example.taskboard.theme;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

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

import tools.jackson.databind.ObjectMapper;

/**
 * テーマ API の結合テスト（docs/04_api-design.md 4.17・4.18）。
 * 実際の PostgreSQL（Testcontainers）で、DB の CHECK 制約とエンティティの対応まで確かめる。
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class ThemeApiTest {

    /** PNG の先頭8バイト（マジックバイト）。中身の判定はアップロード API の担当なので、ここでは形だけ合わせる。 */
    private static final byte[] PNG_BYTES = {
        (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00
    };

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private BackgroundImageRepository imageRepository;

    @Test
    void 未ログインでは401になる() throws Exception {
        mockMvc.perform(get("/api/theme"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/theme")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"DEFAULT\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 新しい利用者のテーマは既定になる() throws Exception {
        MockHttpSession session = signup();

        mockMvc.perform(get("/api/theme").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("DEFAULT"))
                .andExpect(jsonPath("$.presetKey").isEmpty())
                .andExpect(jsonPath("$.customColors").isEmpty())
                .andExpect(jsonPath("$.image").isEmpty());
    }

    @Test
    void テンプレートからカスタムカラー既定へと切り替えて保存できる() throws Exception {
        MockHttpSession session = signup();

        updateTheme(session, "{\"type\":\"PRESET\",\"presetKey\":\"sunset\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("PRESET"))
                .andExpect(jsonPath("$.presetKey").value("sunset"));

        updateTheme(session, "{\"type\":\"CUSTOM\",\"customColors\":{\"sidebar\":\"#1e4428\",\"board\":\"#6BA54A\"}}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("CUSTOM"))
                .andExpect(jsonPath("$.presetKey").isEmpty())
                .andExpect(jsonPath("$.customColors.sidebar").value("#1E4428"))
                .andExpect(jsonPath("$.customColors.board").value("#6BA54A"));

        updateTheme(session, "{\"type\":\"DEFAULT\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("DEFAULT"));

        // 取り直しても保存されている。カスタムカラーは既定に戻しても残る
        mockMvc.perform(get("/api/theme").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("DEFAULT"))
                .andExpect(jsonPath("$.customColors.sidebar").value("#1E4428"))
                .andExpect(jsonPath("$.customColors.board").value("#6BA54A"));
    }

    @Test
    void 色の形式が違うと項目ごとのエラーで400になる() throws Exception {
        MockHttpSession session = signup();

        updateTheme(session, "{\"type\":\"CUSTOM\",\"customColors\":{\"sidebar\":\"red\",\"board\":\"#6BA54A\"}}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("customColors.sidebar"))
                .andExpect(jsonPath("$.errors[0].message").value("色は #RRGGBB の形式で指定してください"));
    }

    @Test
    void 種類やテンプレートの名前が正しくなければ400になる() throws Exception {
        MockHttpSession session = signup();

        updateTheme(session, "{\"type\":\"RAINBOW\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("テーマの指定が正しくありません"));
        updateTheme(session, "{\"type\":\"PRESET\",\"presetKey\":\"ocean\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("テーマの指定が正しくありません"));
    }

    @Test
    void 画像が無ければ画像のテーマは409で画像があれば選べる() throws Exception {
        MockHttpSession session = signup();

        updateTheme(session, "{\"type\":\"IMAGE\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("背景画像がありません。先に画像をアップロードしてください"));

        // アップロード API は別の Issue で作るため、ここでは直接保存しておく
        imageRepository.save(new BackgroundImage(currentUserId(session), PNG_BYTES, "image/png"));

        updateTheme(session, "{\"type\":\"IMAGE\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("IMAGE"))
                .andExpect(jsonPath("$.image.contentType").value("image/png"))
                .andExpect(jsonPath("$.image.sizeBytes").value(PNG_BYTES.length))
                .andExpect(jsonPath("$.image.version").isNumber());
    }

    @Test
    void テーマは利用者ごとに別々に保存される() throws Exception {
        MockHttpSession userA = signup();
        MockHttpSession userB = signup();

        updateTheme(userA, "{\"type\":\"PRESET\",\"presetKey\":\"night\"}")
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/theme").session(userB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("DEFAULT"));
    }

    private ResultActions updateTheme(MockHttpSession session, String body)
            throws Exception {
        return mockMvc.perform(put("/api/theme")
                .with(SecurityMockMvcRequestPostProcessors.csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private long currentUserId(MockHttpSession session) throws Exception {
        MvcResult me = mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(me.getResponse().getContentAsString()).get("id").asLong();
    }

    /**
     * 新しい利用者を登録してセッションを返す。
     * ユーザーID は UUID から作り、テストを何度流しても重ならないようにする。
     */
    private MockHttpSession signup() throws Exception {
        String username = "theme_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String body = "{\"username\": \"%s\", \"password\": \"pass1234\"}".formatted(username);

        MvcResult result = mockMvc.perform(post("/api/auth/signup")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }
}
