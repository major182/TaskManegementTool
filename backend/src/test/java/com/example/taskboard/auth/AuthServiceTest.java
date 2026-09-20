package com.example.taskboard.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.taskboard.common.ConflictException;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AuthService authService;

    @Test
    void 登録するとパスワードはハッシュ化されて保存される() {
        when(userRepository.existsByUsername("taro_123")).thenReturn(false);
        when(passwordEncoder.encode("pass1234")).thenReturn("$2a$10$hashed");
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        authService.signup("taro_123", "pass1234");

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getUsername()).isEqualTo("taro_123");
        assertThat(saved.getValue().getPasswordHash()).isEqualTo("$2a$10$hashed");
    }

    @Test
    void すでに使われているユーザーIDでは登録できない() {
        when(userRepository.existsByUsername("taro_123")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup("taro_123", "pass1234"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("このユーザーID は使われています");

        verify(userRepository, never()).save(any());
    }
}
