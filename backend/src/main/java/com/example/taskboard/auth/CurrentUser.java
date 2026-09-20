package com.example.taskboard.auth;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * ログイン中の利用者を取り出す共通処理。
 * 以降のすべての Service は、ここで得た ID と突き合わせて
 * 「そのデータがログイン中の利用者のものか」を確認する（docs/04_api-design.md 7章）。
 */
@Component
public class CurrentUser {

    /** ログイン中の利用者の ID。未ログインで呼ばれることは Security 設定上ない。 */
    public Long requireId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AppUserDetails details)) {
            throw new IllegalStateException("ログインしていません");
        }
        return details.getId();
    }
}
