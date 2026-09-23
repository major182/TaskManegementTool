package com.example.taskboard.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import com.example.taskboard.TestcontainersConfiguration;

/**
 * 死活確認（docs/04_api-design.md 3.6）。
 *
 * <p>ロードバランサ等は未ログインで叩くため、ここだけは認証なしで 200 を返す必要がある。
 * 一方で中身（DB の接続先など）を外に見せたくないので、状態だけを返す。
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class HealthCheckTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void 未ログインでも死活確認できる() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void 死活確認は中身を返さない() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(jsonPath("$.components").doesNotExist());
    }

    @Test
    void health以外のactuatorには届かない() throws Exception {
        // 公開しているのは health だけ。設定値の一覧などは外から読めてはいけない。
        // 未ログインでは Security が先に止めるため 401 になる
        mockMvc.perform(get("/actuator/env"))
                .andExpect(status().isUnauthorized());
    }
}
