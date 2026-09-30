package com.example.taskboard.theme;

import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.taskboard.common.BadRequestException;
import com.example.taskboard.common.ConflictException;
import com.example.taskboard.theme.ThemeDtos.CustomColors;
import com.example.taskboard.theme.ThemeDtos.ImageInfo;
import com.example.taskboard.theme.ThemeDtos.ThemeResponse;
import com.example.taskboard.theme.ThemeDtos.ThemeUpdateRequest;

/**
 * テーマの業務ルール（docs/01-3_business-rules.md 5.7、docs/04_api-design.md 4.17・4.18）。
 * テーマは利用者に1つなので、パスで ID を受け取らず、常にログイン中の利用者のテーマを扱う。
 * そのため他人のテーマに触れる経路がそもそも無い。
 */
@Service
public class ThemeService {

    /** テンプレートの名前。実際の色は画面側の定数で持つ（docs/03_db-design.md 3.5）。 */
    static final Set<String> PRESET_KEYS = Set.of("sky", "sunset", "forest", "night", "stone");

    private static final String INVALID_THEME = "テーマの指定が正しくありません";

    private final UserThemeRepository themeRepository;
    private final BackgroundImageRepository imageRepository;

    public ThemeService(UserThemeRepository themeRepository, BackgroundImageRepository imageRepository) {
        this.themeRepository = themeRepository;
        this.imageRepository = imageRepository;
    }

    /** 今のテーマ（F-66）。一度もテーマを変えていない利用者は既定を返す。 */
    @Transactional(readOnly = true)
    public ThemeResponse find(Long userId) {
        return themeRepository.findById(userId)
                .map(theme -> toResponse(userId, theme))
                .orElseGet(() -> new ThemeResponse(ThemeType.DEFAULT, null, null, findImageInfo(userId)));
    }

    /**
     * テーマの変更（F-62・F-63・F-65、パネルの「適用」）。
     * 行が無ければ作る。種類ごとに必要な項目だけを見て、それ以外は無視する。
     */
    @Transactional
    public ThemeResponse update(Long userId, ThemeUpdateRequest request) {
        ThemeType type = parseType(request.type());
        UserTheme theme = themeRepository.findById(userId).orElseGet(() -> new UserTheme(userId));

        switch (type) {
            case DEFAULT -> theme.useDefault();
            case PRESET -> theme.usePreset(requirePresetKey(request.presetKey()));
            case CUSTOM -> {
                CustomColors colors = request.customColors();
                if (colors == null) {
                    throw new BadRequestException("カスタムカラーの2色を指定してください");
                }
                // 形式は DTO の @Pattern で確かめ済み。DB の制約に合わせて大文字にそろえる
                theme.useCustom(colors.sidebar().toUpperCase(Locale.ROOT), colors.board().toUpperCase(Locale.ROOT));
            }
            case IMAGE -> {
                // 画像が無いまま IMAGE にすると、画面は表示できない背景を指すことになる
                if (!imageRepository.existsById(userId)) {
                    throw new ConflictException("背景画像がありません。先に画像をアップロードしてください");
                }
                theme.useImage();
            }
            // 4種類すべてを上で扱っているため通らない。種類を増やしたのに書き忘れたときに気づけるようにする
            default -> throw new IllegalStateException("未対応のテーマの種類です: " + type);
        }

        return toResponse(userId, themeRepository.save(theme));
    }

    private static ThemeType parseType(String type) {
        if (type == null) {
            throw new BadRequestException(INVALID_THEME);
        }
        try {
            return ThemeType.valueOf(type);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException(INVALID_THEME);
        }
    }

    private static String requirePresetKey(String presetKey) {
        if (presetKey == null || !PRESET_KEYS.contains(presetKey)) {
            throw new BadRequestException(INVALID_THEME);
        }
        return presetKey;
    }

    private ThemeResponse toResponse(Long userId, UserTheme theme) {
        // カスタムカラーは一度も指定していなければ null のまま返す（画面は今の色を初期値にする）
        CustomColors colors = theme.getCustomSidebarColor() == null
                ? null
                : new CustomColors(theme.getCustomSidebarColor(), theme.getCustomBoardColor());
        return new ThemeResponse(theme.getThemeType(), theme.getPresetKey(), colors, findImageInfo(userId));
    }

    /** 画像の中身は読まず、情報だけを取る（docs/03_db-design.md 3.6）。 */
    private ImageInfo findImageInfo(Long userId) {
        return imageRepository.findInfoByUserId(userId).map(ImageInfo::from).orElse(null);
    }
}
