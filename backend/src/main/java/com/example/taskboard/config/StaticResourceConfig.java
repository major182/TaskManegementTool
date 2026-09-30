package com.example.taskboard.config;

import java.time.Duration;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 画面（React のビルド成果物）を配るときのキャッシュ設定
 * （docs/07_deployment.md 1.4）。
 *
 * <p>Spring Security は既定で、すべての応答に「保存するな」というキャッシュ指示を付ける。
 * 認証が要る内容を端末に残さないための配慮で、API と index.html にはそのまま効かせたい。</p>
 *
 * <p>一方、ハッシュ付きのファイル（/assets/index-xxxx.js）は中身が変わると
 * ファイル名自体が変わるため、古いものが使われる心配がない。
 * ここだけ1年間ブラウザに保存させて、毎回 300KB 以上を取り直さずに済むようにする。</p>
 *
 * <p>Spring Security ではなくここで設定しているのは、
 * Security のキャッシュ指示が「まだ指示が無いときだけ付ける」作りになっているため。
 * 先にこちらで指示を付けておけば、Security は何もしない。</p>
 */
@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {

    /** ファイル名にハッシュが入っているため、長期間保存させてよい。 */
    private static final Duration ASSET_CACHE_DURATION = Duration.ofDays(365);

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                // immutable は「有効期限内は問い合わせすら不要」という指示。
                // ファイル名が変わらない限り中身も変わらないため付けられる
                .setCacheControl(CacheControl.maxAge(ASSET_CACHE_DURATION).cachePublic().immutable());
    }
}
