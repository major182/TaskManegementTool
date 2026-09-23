package com.example.taskboard.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import com.example.taskboard.TestcontainersConfiguration;

/**
 * API の説明画面（Swagger UI）を、既定では外に出さないことの確認
 * （docs/04_api-design.md 6章）。
 *
 * <p>誰でも API の一覧を読めて試し打ちもできてしまうため、
 * local プロファイルのときだけ開く設定にしている。
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class SwaggerExposureTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void 既定ではAPIの定義を返さない() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isNotFound());
    }

    @Test
    void 既定ではSwaggerUIを返さない() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isNotFound());
    }
}
