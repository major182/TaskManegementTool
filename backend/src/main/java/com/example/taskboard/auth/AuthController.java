package com.example.taskboard.auth;

import java.net.URI;

import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.taskboard.auth.AuthDtos.LoginRequest;
import com.example.taskboard.auth.AuthDtos.SignupRequest;
import com.example.taskboard.auth.AuthDtos.UserResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;

/**
 * 認証 API（docs/04_api-design.md 3.1）。
 * 画面は React が持つため、フォームログインではなく REST として実装する。
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "認証", description = "新規登録・ログイン・ログアウト・ログイン状態の確認")
public class AuthController {

    private final AuthService authService;
    private final CurrentUser currentUser;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;

    public AuthController(AuthService authService,
                          CurrentUser currentUser,
                          AuthenticationManager authenticationManager,
                          SecurityContextRepository securityContextRepository) {
        this.authService = authService;
        this.currentUser = currentUser;
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = securityContextRepository;
    }

    /** 新規登録（F-05）。成功するとそのままログイン状態にする。 */
    @PostMapping("/signup")
    @Operation(summary = "新規登録", description = "登録に成功するとそのままログイン状態になる")
    public ResponseEntity<UserResponse> signup(@Valid @RequestBody SignupRequest request,
                                               HttpServletRequest httpRequest,
                                               HttpServletResponse httpResponse) {
        User user = authService.signup(request.username(), request.password());
        authenticate(request.username(), request.password(), httpRequest, httpResponse);

        return ResponseEntity.created(URI.create("/api/auth/me"))
                .body(UserResponse.from(user));
    }

    /** ログイン（F-06）。どちらが違うかは知らせず、失敗はすべて 401 にする。 */
    @PostMapping("/login")
    @Operation(summary = "ログイン", description = "失敗の理由は知らせず、すべて 401 を返す")
    public UserResponse login(@Valid @RequestBody LoginRequest request,
                              HttpServletRequest httpRequest,
                              HttpServletResponse httpResponse) {
        Authentication authentication =
                authenticate(request.username(), request.password(), httpRequest, httpResponse);

        AppUserDetails details = (AppUserDetails) authentication.getPrincipal();
        return UserResponse.from(authService.getById(details.getId()));
    }

    /** ログアウト（F-07）。セッションを破棄する。 */
    @PostMapping("/logout")
    @Operation(summary = "ログアウト", description = "セッションを破棄する")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        HttpSession session = httpRequest.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    /** ログイン状態の確認（F-08）。未ログインなら Security 設定により 401 が返る。 */
    @GetMapping("/me")
    @Operation(summary = "ログイン状態の確認", description = "未ログインなら 401 を返す")
    public UserResponse me() {
        return UserResponse.from(authService.getById(currentUser.requireId()));
    }

    /**
     * 認証してセッションに保存する。
     * 認証に失敗すると AuthenticationException が飛び、Security 設定により 401 になる。
     */
    private Authentication authenticate(String username,
                                        String password,
                                        HttpServletRequest httpRequest,
                                        HttpServletResponse httpResponse) {
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(username, password));

        // ログイン前のセッションIDを使い回さない（セッション固定攻撃への対策）
        HttpSession oldSession = httpRequest.getSession(false);
        if (oldSession != null) {
            oldSession.invalidate();
        }
        httpRequest.getSession(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, httpRequest, httpResponse);

        return authentication;
    }
}
