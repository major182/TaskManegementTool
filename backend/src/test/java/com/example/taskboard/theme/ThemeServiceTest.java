package com.example.taskboard.theme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.taskboard.common.BadRequestException;
import com.example.taskboard.common.ConflictException;
import com.example.taskboard.theme.ThemeDtos.CustomColors;
import com.example.taskboard.theme.ThemeDtos.ThemeResponse;
import com.example.taskboard.theme.ThemeDtos.ThemeUpdateRequest;

/**
 * テーマの業務ルールの単体テスト（docs/06_test-spec.md T-K「自動テストで確かめること」）。
 * 「行が無ければ既定」「カスタムカラーは切り替えても残す」「画像が無いのに IMAGE は 409」を中心に確認する。
 */
@ExtendWith(MockitoExtension.class)
class ThemeServiceTest {

    private static final Long USER_ID = 1L;

    @Mock
    private UserThemeRepository themeRepository;

    @Mock
    private BackgroundImageRepository imageRepository;

    @InjectMocks
    private ThemeService themeService;

    @Test
    void 一度もテーマを変えていない利用者は既定になる() {
        when(themeRepository.findById(USER_ID)).thenReturn(Optional.empty());
        when(imageRepository.findInfoByUserId(USER_ID)).thenReturn(Optional.empty());

        ThemeResponse response = themeService.find(USER_ID);

        assertThat(response.type()).isEqualTo(ThemeType.DEFAULT);
        assertThat(response.presetKey()).isNull();
        assertThat(response.customColors()).isNull();
        assertThat(response.image()).isNull();
    }

    @Test
    void 画像があれば種類に関係なく情報を返す() {
        Instant uploadedAt = Instant.parse("2026-09-30T00:00:00Z");
        when(themeRepository.findById(USER_ID)).thenReturn(Optional.empty());
        when(imageRepository.findInfoByUserId(USER_ID)).thenReturn(Optional.of(info("image/png", 1234, uploadedAt)));

        ThemeResponse response = themeService.find(USER_ID);

        assertThat(response.type()).isEqualTo(ThemeType.DEFAULT);
        assertThat(response.image().version()).isEqualTo(uploadedAt.toEpochMilli());
        assertThat(response.image().contentType()).isEqualTo("image/png");
        assertThat(response.image().sizeBytes()).isEqualTo(1234);
    }

    @Test
    void 初めて適用するときは行を作ってテンプレートを保存する() {
        when(themeRepository.findById(USER_ID)).thenReturn(Optional.empty());
        when(themeRepository.save(any(UserTheme.class))).thenAnswer(i -> i.getArgument(0));

        ThemeResponse response = themeService.update(USER_ID, new ThemeUpdateRequest("PRESET", "forest", null));

        assertThat(response.type()).isEqualTo(ThemeType.PRESET);
        assertThat(response.presetKey()).isEqualTo("forest");
    }

    @Test
    void カスタムカラーは大文字にそろえて保存する() {
        when(themeRepository.findById(USER_ID)).thenReturn(Optional.empty());
        when(themeRepository.save(any(UserTheme.class))).thenAnswer(i -> i.getArgument(0));

        ThemeResponse response = themeService.update(USER_ID,
                new ThemeUpdateRequest("CUSTOM", null, new CustomColors("#1e4428", "#6ba54a")));

        assertThat(response.type()).isEqualTo(ThemeType.CUSTOM);
        assertThat(response.customColors()).isEqualTo(new CustomColors("#1E4428", "#6BA54A"));
    }

    @Test
    void カスタムカラー以外に切り替えても保存済みの2色は残す() {
        UserTheme theme = new UserTheme(USER_ID);
        theme.useCustom("#1E4428", "#6BA54A");
        when(themeRepository.findById(USER_ID)).thenReturn(Optional.of(theme));
        when(themeRepository.save(any(UserTheme.class))).thenAnswer(i -> i.getArgument(0));

        // PRESET なのに customColors を送ってきても無視する
        ThemeResponse response = themeService.update(USER_ID,
                new ThemeUpdateRequest("PRESET", "sky", new CustomColors("#000000", "#FFFFFF")));

        assertThat(response.type()).isEqualTo(ThemeType.PRESET);
        assertThat(response.customColors()).isEqualTo(new CustomColors("#1E4428", "#6BA54A"));
    }

    @Test
    void 既定に戻すとテンプレートの名前は消える() {
        UserTheme theme = new UserTheme(USER_ID);
        theme.usePreset("night");
        when(themeRepository.findById(USER_ID)).thenReturn(Optional.of(theme));
        when(themeRepository.save(any(UserTheme.class))).thenAnswer(i -> i.getArgument(0));

        ThemeResponse response = themeService.update(USER_ID, new ThemeUpdateRequest("DEFAULT", null, null));

        assertThat(response.type()).isEqualTo(ThemeType.DEFAULT);
        assertThat(response.presetKey()).isNull();
    }

    @Test
    void 画像が無いのに画像のテーマを選ぶと409になる() {
        when(themeRepository.findById(USER_ID)).thenReturn(Optional.empty());
        when(imageRepository.existsById(USER_ID)).thenReturn(false);

        assertThatThrownBy(() -> themeService.update(USER_ID, new ThemeUpdateRequest("IMAGE", null, null)))
                .isInstanceOf(ConflictException.class)
                .hasMessage("背景画像がありません。先に画像をアップロードしてください");
        verify(themeRepository, never()).save(any());
    }

    @Test
    void 画像があれば画像のテーマにできる() {
        when(themeRepository.findById(USER_ID)).thenReturn(Optional.empty());
        when(imageRepository.existsById(USER_ID)).thenReturn(true);
        when(themeRepository.save(any(UserTheme.class))).thenAnswer(i -> i.getArgument(0));

        ThemeResponse response = themeService.update(USER_ID, new ThemeUpdateRequest("IMAGE", null, null));

        assertThat(response.type()).isEqualTo(ThemeType.IMAGE);
    }

    @Test
    void 種類やテンプレートの名前が正しくなければ400になる() {
        when(themeRepository.findById(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> themeService.update(USER_ID, new ThemeUpdateRequest(null, null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("テーマの指定が正しくありません");
        assertThatThrownBy(() -> themeService.update(USER_ID, new ThemeUpdateRequest("RAINBOW", null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("テーマの指定が正しくありません");
        assertThatThrownBy(() -> themeService.update(USER_ID, new ThemeUpdateRequest("PRESET", "ocean", null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("テーマの指定が正しくありません");
        assertThatThrownBy(() -> themeService.update(USER_ID, new ThemeUpdateRequest("CUSTOM", null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("カスタムカラーの2色を指定してください");
        verify(themeRepository, never()).save(any());
    }

    private static BackgroundImageRepository.Info info(String contentType, int sizeBytes, Instant updatedAt) {
        return new BackgroundImageRepository.Info() {
            @Override
            public String getContentType() {
                return contentType;
            }

            @Override
            public int getSizeBytes() {
                return sizeBytes;
            }

            @Override
            public Instant getUpdatedAt() {
                return updatedAt;
            }
        };
    }
}
