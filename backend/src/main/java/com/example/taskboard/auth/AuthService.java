package com.example.taskboard.auth;

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
        return userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public User getById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("ログイン中の利用者が見つかりません: " + id));
    }
}
