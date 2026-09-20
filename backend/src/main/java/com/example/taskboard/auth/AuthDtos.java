package com.example.taskboard.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 認証 API のリクエスト・レスポンス（docs/04_api-design.md 4.1〜4.3）。
 * 入力のルールは docs/01-3_business-rules.md 5.1 に合わせる。
 */
public final class AuthDtos {

    private AuthDtos() {
    }

    /** POST /api/auth/signup のリクエスト。 */
    public record SignupRequest(
            @NotBlank(message = "ユーザーIDを入力してください")
            @Pattern(regexp = "^[A-Za-z0-9_]{4,20}$",
                    message = "ユーザーIDは半角英数字とアンダースコアで4〜20文字で入力してください")
            String username,

            @NotBlank(message = "パスワードを入力してください")
            @Size(min = 8, max = 72, message = "パスワードは8〜72文字で入力してください")
            @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$",
                    message = "パスワードは英字と数字をそれぞれ1文字以上含めてください")
            String password) {
    }

    /** POST /api/auth/login のリクエスト。ここでは形式チェックをしない（失敗はすべて 401）。 */
    public record LoginRequest(
            @NotBlank(message = "ユーザーIDを入力してください") String username,
            @NotBlank(message = "パスワードを入力してください") String password) {
    }

    /** 利用者の情報。パスワードは一切含めない。 */
    public record UserResponse(Long id, String username, Long lastOpenedBoardId) {

        public static UserResponse from(User user) {
            return new UserResponse(user.getId(), user.getUsername(), user.getLastOpenedBoardId());
        }
    }
}
