package com.example.taskboard.theme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.example.taskboard.common.BadRequestException;
import com.example.taskboard.common.ConflictException;
import com.example.taskboard.common.NotFoundException;
import com.example.taskboard.common.PayloadTooLargeException;
import com.example.taskboard.theme.ThemeDtos.ImageInfo;
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

    @Test
    void 画像をアップロードすると中身から判定した形式で保存しテーマは変えない() {
        when(imageRepository.findById(USER_ID)).thenReturn(Optional.empty());
        when(imageRepository.saveAndFlush(any(BackgroundImage.class))).thenAnswer(i -> withUpdatedAt(i.getArgument(0)));

        ImageInfo info = themeService.uploadImage(USER_ID, ImageFormatTest.PNG);

        assertThat(info.contentType()).isEqualTo("image/png");
        assertThat(info.sizeBytes()).isEqualTo(ImageFormatTest.PNG.length);
        verify(themeRepository, never()).save(any());
    }

    @Test
    void すでに画像があれば置き換える() {
        BackgroundImage existing = new BackgroundImage(USER_ID, ImageFormatTest.PNG, "image/png");
        when(imageRepository.findById(USER_ID)).thenReturn(Optional.of(existing));
        when(imageRepository.saveAndFlush(any(BackgroundImage.class))).thenAnswer(i -> withUpdatedAt(i.getArgument(0)));

        ImageInfo info = themeService.uploadImage(USER_ID, ImageFormatTest.JPEG);

        assertThat(info.contentType()).isEqualTo("image/jpeg");
        assertThat(existing.getContent()).isEqualTo(ImageFormatTest.JPEG);
    }

    @Test
    void 画像でないファイルや空のファイルは400になる() {
        assertThatThrownBy(() -> themeService.uploadImage(USER_ID, "GIF89a......".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("JPEG・PNG・WebP の画像を選んでください");
        assertThatThrownBy(() -> themeService.uploadImage(USER_ID, new byte[0]))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("画像ファイルを選んでください");
        verify(imageRepository, never()).saveAndFlush(any());
    }

    @Test
    void 上限を超える画像は413になり上限ちょうどは通る() {
        byte[] tooLarge = new byte[ThemeService.MAX_IMAGE_BYTES + 1];
        System.arraycopy(ImageFormatTest.PNG, 0, tooLarge, 0, ImageFormatTest.PNG.length);
        assertThatThrownBy(() -> themeService.uploadImage(USER_ID, tooLarge))
                .isInstanceOf(PayloadTooLargeException.class)
                .hasMessage("5MB 以下の画像を選んでください");

        byte[] justFits = new byte[ThemeService.MAX_IMAGE_BYTES];
        System.arraycopy(ImageFormatTest.PNG, 0, justFits, 0, ImageFormatTest.PNG.length);
        when(imageRepository.findById(USER_ID)).thenReturn(Optional.empty());
        when(imageRepository.saveAndFlush(any(BackgroundImage.class))).thenAnswer(i -> withUpdatedAt(i.getArgument(0)));
        assertThat(themeService.uploadImage(USER_ID, justFits).sizeBytes()).isEqualTo(ThemeService.MAX_IMAGE_BYTES);
    }

    @Test
    void 画像のテーマを使っているときに画像を消すと既定に戻る() {
        UserTheme theme = new UserTheme(USER_ID);
        theme.useImage();
        when(imageRepository.findById(USER_ID))
                .thenReturn(Optional.of(new BackgroundImage(USER_ID, ImageFormatTest.PNG, "image/png")));
        when(themeRepository.findById(USER_ID)).thenReturn(Optional.of(theme));

        themeService.deleteImage(USER_ID);

        verify(imageRepository).delete(any(BackgroundImage.class));
        assertThat(theme.getThemeType()).isEqualTo(ThemeType.DEFAULT);
    }

    @Test
    void 画像以外のテーマなら画像を消してもテーマは変えない() {
        UserTheme theme = new UserTheme(USER_ID);
        theme.usePreset("sky");
        when(imageRepository.findById(USER_ID))
                .thenReturn(Optional.of(new BackgroundImage(USER_ID, ImageFormatTest.PNG, "image/png")));
        when(themeRepository.findById(USER_ID)).thenReturn(Optional.of(theme));

        themeService.deleteImage(USER_ID);

        assertThat(theme.getThemeType()).isEqualTo(ThemeType.PRESET);
        assertThat(theme.getPresetKey()).isEqualTo("sky");
    }

    @Test
    void 画像が無ければ取得も削除も404になる() {
        when(imageRepository.findById(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> themeService.findImage(USER_ID))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("背景画像が見つかりません");
        assertThatThrownBy(() -> themeService.deleteImage(USER_ID))
                .isInstanceOf(NotFoundException.class);
        verify(imageRepository, never()).delete(any());
    }

    /**
     * 保存時に DB が入れる更新日時を、代わりに入れる。
     * 実際は @UpdateTimestamp が書き込み時に入れるが、単体テストでは DB を通らないため。
     */
    private static BackgroundImage withUpdatedAt(BackgroundImage image) {
        ReflectionTestUtils.setField(image, "updatedAt", Instant.now());
        return image;
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
