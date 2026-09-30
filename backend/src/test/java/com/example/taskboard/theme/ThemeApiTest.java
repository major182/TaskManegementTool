package com.example.taskboard.theme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;

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

    @Test
    void 画像のAPIも未ログインでは401になる() throws Exception {
        mockMvc.perform(get("/api/theme/image"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(uploadRequest(ImageFormatTest.PNG))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/theme/image").with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 画像をアップロードして取得し置き換えて削除できる() throws Exception {
        MockHttpSession session = signup();

        // アップロード（4.19）。テーマは切り替わらない
        MvcResult first = mockMvc.perform(uploadRequest(ImageFormatTest.PNG).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contentType").value("image/png"))
                .andExpect(jsonPath("$.sizeBytes").value(ImageFormatTest.PNG.length))
                .andReturn();
        long firstVersion = versionOf(first);

        mockMvc.perform(get("/api/theme").session(session))
                .andExpect(jsonPath("$.type").value("DEFAULT"))
                .andExpect(jsonPath("$.image.version").value(firstVersion));

        // 取得（4.20）。同じバイト列と、キャッシュ・安全のためのヘッダーが返る
        mockMvc.perform(get("/api/theme/image").param("v", String.valueOf(firstVersion)).session(session))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(ImageFormatTest.PNG))
                .andExpect(header().string("Cache-Control", "max-age=31536000, private, immutable"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));

        // 置き換え。形式と版番号が変わる
        MvcResult second = mockMvc.perform(uploadRequest(ImageFormatTest.JPEG).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contentType").value("image/jpeg"))
                .andReturn();
        assertThat(versionOf(second)).isGreaterThan(firstVersion);

        mockMvc.perform(get("/api/theme/image").session(session))
                .andExpect(content().bytes(ImageFormatTest.JPEG));

        // 画像のテーマにしてから削除（4.21）すると、既定に戻る
        updateTheme(session, "{\"type\":\"IMAGE\"}").andExpect(status().isOk());
        deleteImage(session).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/theme").session(session))
                .andExpect(jsonPath("$.type").value("DEFAULT"))
                .andExpect(jsonPath("$.image").isEmpty());
        mockMvc.perform(get("/api/theme/image").session(session))
                .andExpect(status().isNotFound());
        deleteImage(session).andExpect(status().isNotFound());
    }

    @Test
    void 画像でないファイルは拡張子や申告を偽っても400になる() throws Exception {
        MockHttpSession session = signup();
        MockMultipartFile fake = new MockMultipartFile(
                "file", "photo.jpg", "image/jpeg", "<svg><script>alert(1)</script></svg>".getBytes());

        mockMvc.perform(multipart(HttpMethod.PUT, "/api/theme/image").file(fake)
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .session(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("JPEG・PNG・WebP の画像を選んでください"));
    }

    @Test
    void 上限を超える画像は413になる() throws Exception {
        MockHttpSession session = signup();
        byte[] tooLarge = new byte[5 * 1024 * 1024 + 1];
        System.arraycopy(ImageFormatTest.PNG, 0, tooLarge, 0, ImageFormatTest.PNG.length);

        mockMvc.perform(uploadRequest(tooLarge).session(session))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.detail").value("5MB 以下の画像を選んでください"));
    }

    @Test
    void 他の利用者の画像は取得も削除もできない() throws Exception {
        MockHttpSession userA = signup();
        MockHttpSession userB = signup();
        mockMvc.perform(uploadRequest(ImageFormatTest.PNG).session(userA))
                .andExpect(status().isOk());

        // パスに ID が無いので、利用者B は常に自分の画像を見に行く。B には画像が無いので 404
        mockMvc.perform(get("/api/theme/image").session(userB))
                .andExpect(status().isNotFound());
        deleteImage(userB).andExpect(status().isNotFound());

        // 利用者A の画像は残っている
        mockMvc.perform(get("/api/theme/image").session(userA))
                .andExpect(status().isOk());
    }

    /** 背景画像のアップロード。項目名は file（docs/04_api-design.md 4.19）。 */
    private MockMultipartHttpServletRequestBuilder uploadRequest(byte[] bytes) {
        MockMultipartHttpServletRequestBuilder builder = multipart(HttpMethod.PUT, "/api/theme/image")
                .file(new MockMultipartFile("file", "background", "application/octet-stream", bytes));
        builder.with(SecurityMockMvcRequestPostProcessors.csrf());
        return builder;
    }

    private ResultActions deleteImage(MockHttpSession session) throws Exception {
        return mockMvc.perform(delete("/api/theme/image")
                .with(SecurityMockMvcRequestPostProcessors.csrf())
                .session(session));
    }

    private long versionOf(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("version").asLong();
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
