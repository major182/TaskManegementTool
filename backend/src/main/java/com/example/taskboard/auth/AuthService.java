package com.example.taskboard.auth;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.taskboard.common.ConflictException;

/**
 * 新規登録の業務ルール（docs/01-3_business-rules.md 5.6）。
 * ログインの認証そのものは Spring Security の AuthenticationManager に任せる。
 */
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 利用者を登録する。パスワードは BCrypt でハッシュ化して保存する。
     *
     * @throws ConflictException ユーザーID がすでに使われているとき
     */
    @Transactional
    public User signup(String username, String rawPassword) {
        if (userRepository.existsByUsername(username)) {
            throw new ConflictException("このユーザーID は使われています");
        }
        User user = new User(username, passwordEncoder.encode(rawPassword));
        try {
            // 確認と保存の間に、同じユーザーID の登録が入り込むことがある。
            // そのときは DB の一意制約（uq_users_username）で止まるので、
            // 上の確認と同じ 409 に変換する。変換しないと 500 になってしまう
            return userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("このユーザーID は使われています");
        }
    }

    @Transactional(readOnly = true)
    public User getById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("ログイン中の利用者が見つかりません: " + id));
    }
}
