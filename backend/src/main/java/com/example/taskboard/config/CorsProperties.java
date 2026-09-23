package com.example.taskboard.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * CORS の設定（application.yml の app.cors）。
 * 画面（Vercel）と API（Render）でドメインが違うため、許可するオリジンを設定で渡す
 * （docs/04_api-design.md 2.4）。
 *
 * @param allowedOrigins Cookie を送る通信では「*」は使えないので、必ず具体的に書く
 */
@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(List<String> allowedOrigins) {
}
