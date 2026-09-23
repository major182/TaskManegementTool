package com.example.taskboard.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.server.autoconfigure.ServerProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import com.example.taskboard.TestcontainersConfiguration;

/**
 * ログイン状態の保持（F-08）の設定が入っていることの確認。
 *
 * <p>30日の経過そのものはテストできないため、設定が入っていることで代える
 * （docs/06_test-spec.md 6.1）。サーバー側の timeout だけでは、Cookie が
 * 「ブラウザを閉じたら消える」ものになり、要件の「閉じて開き直しても保持」を満たせない。
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class SessionCookieTest {

    private static final Duration THIRTY_DAYS = Duration.ofDays(30);

    @Autowired
    private ServerProperties serverProperties;

    @Test
    void セッションは30日保持する() {
        assertThat(serverProperties.getServlet().getSession().getTimeout())
                .isEqualTo(THIRTY_DAYS);
    }

    @Test
    void ブラウザを閉じても消えないようCookieに有効期限がある() {
        assertThat(serverProperties.getServlet().getSession().getCookie().getMaxAge())
                .isEqualTo(THIRTY_DAYS);
    }

    @Test
    void CookieはJavaScriptから読めずHTTPSでのみ送る() {
        var cookie = serverProperties.getServlet().getSession().getCookie();
        assertThat(cookie.getHttpOnly()).isTrue();
        assertThat(cookie.getSecure()).isTrue();
    }
}
