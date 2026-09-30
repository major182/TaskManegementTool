package com.example.taskboard.theme;

import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.taskboard.common.BadRequestException;
import com.example.taskboard.common.ConflictException;
import com.example.taskboard.common.NotFoundException;
import com.example.taskboard.common.PayloadTooLargeException;
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

    /** 背景画像の上限（5MB。docs/01-3_business-rules.md 5.7）。DB の ck_user_background_images_size と同じ値。 */
    static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;

    private static final String INVALID_THEME = "テーマの指定が正しくありません";
    private static final String IMAGE_NOT_FOUND = "背景画像が見つかりません";

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

    /**
     * 背景画像のアップロード（F-64）。すでにあれば置き換える。
     * テーマは切り替えない。背景にするかどうかはパネルの「適用」で決まる（docs/04_api-design.md 4.19）。
     */
    @Transactional
    public ImageInfo uploadImage(Long userId, byte[] content) {
        if (content == null || content.length == 0) {
            throw new BadRequestException("画像ファイルを選んでください");
        }
        // 上限は Spring の設定（application.yml）でも止めるが、ここでも確かめる。
        // 設定を変えたり、別の経路から呼ばれたりしても、業務ルールが守られるようにするため
        if (content.length > MAX_IMAGE_BYTES) {
            throw new PayloadTooLargeException("5MB 以下の画像を選んでください");
        }
        String contentType = ImageFormat.detect(content)
                .orElseThrow(() -> new BadRequestException("JPEG・PNG・WebP の画像を選んでください"));

        BackgroundImage image = imageRepository.findById(userId)
                .map(existing -> {
                    existing.replace(content, contentType);
                    return existing;
                })
                .orElseGet(() -> new BackgroundImage(userId, content, contentType));

        // すぐ書き込んで更新日時（版番号）を確定させ、応答に載せる
        BackgroundImage saved = imageRepository.saveAndFlush(image);
        return new ImageInfo(saved.getUpdatedAt().toEpochMilli(), saved.getContentType(), saved.getSizeBytes());
    }

    /** 背景画像の中身（F-64）。画面が背景として読み込む（docs/04_api-design.md 4.20）。 */
    @Transactional(readOnly = true)
    public BackgroundImage findImage(Long userId) {
        return imageRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException(IMAGE_NOT_FOUND));
    }

    /**
     * 背景画像の削除（F-64）。
     * 画像をテーマに使っていた場合は、表示できない背景を指したままにならないよう、
     * 同じトランザクションで既定に戻す（docs/01-3_business-rules.md 5.7）。
     */
    @Transactional
    public void deleteImage(Long userId) {
        BackgroundImage image = findImage(userId);
        imageRepository.delete(image);

        themeRepository.findById(userId)
                .filter(theme -> theme.getThemeType() == ThemeType.IMAGE)
                .ifPresent(UserTheme::useDefault);
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
