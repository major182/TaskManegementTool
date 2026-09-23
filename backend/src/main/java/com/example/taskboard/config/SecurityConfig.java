package com.example.taskboard.config;

import java.util.List;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import tools.jackson.databind.ObjectMapper;

/**
 * 認証・認可の設定（docs/04_api-design.md 7章、docs/02_tech-stack.md 5.1）。
 */
@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(CorsProperties.class)
public class SecurityConfig {

    private final ObjectMapper objectMapper;
    private final CorsProperties corsProperties;

    public SecurityConfig(ObjectMapper objectMapper, CorsProperties corsProperties) {
        this.objectMapper = objectMapper;
        this.corsProperties = corsProperties;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            SecurityContextRepository securityContextRepository) throws Exception {
        http
                .cors(Customizer.withDefaults())
                // Cookie に入れた CSRF トークンを、画面が X-XSRF-TOKEN ヘッダーで送り返す方式（04 2.3）。
                // spa() は Spring Security が用意した SPA 向けの設定で、
                // XSRF-TOKEN Cookie の発行（毎回トークンを読み出す処理）までまとめて面倒を見てくれる
                .csrf(csrf -> csrf.spa())
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                PathPatternRequestMatcher.withDefaults().matcher("/api/auth/signup"),
                                PathPatternRequestMatcher.withDefaults().matcher("/api/auth/login"))
                        .permitAll()
                        .requestMatchers(
                                PathPatternRequestMatcher.withDefaults().matcher("/v3/api-docs/**"),
                                PathPatternRequestMatcher.withDefaults().matcher("/swagger-ui/**"),
                                PathPatternRequestMatcher.withDefaults().matcher("/swagger-ui.html"))
                        .permitAll()
                        .anyRequest().authenticated())
                // 未ログインのときはログイン画面へリダイレクトせず、401 と JSON を返す
                .exceptionHandling(handling -> handling.authenticationEntryPoint(unauthorizedEntryPoint()))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                // ログアウト（F-07）は Spring Security の標準機能に任せる。
                // セッションの破棄・SecurityContext の後始末・Cookie の削除をまとめて行ってくれる。
                // 画面は React なのでリダイレクトはせず、204 を返す
                .logout(logout -> logout
                        .logoutRequestMatcher(PathPatternRequestMatcher.withDefaults()
                                .matcher(HttpMethod.POST, "/api/auth/logout"))
                        .deleteCookies("XSRF-TOKEN")
                        .logoutSuccessHandler(
                                new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)));

        return http.build();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(corsProperties.allowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN"));
        // Cookie を送るために必須。このときオリジンに * は使えない（04 2.4）
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    private AuthenticationEntryPoint unauthorizedEntryPoint() {
        return (request, response, authException) -> {
            ProblemDetail body = ProblemDetail.forStatusAndDetail(
                    HttpStatus.UNAUTHORIZED,
                    "ログインの有効期限が切れました。もう一度ログインしてください");
            body.setInstance(java.net.URI.create(request.getRequestURI()));

            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            objectMapper.writeValue(response.getWriter(), body);
        };
    }
}
