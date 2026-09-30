package com.example.taskboard.theme;

import java.io.IOException;
import java.time.Duration;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.taskboard.auth.AppUserDetails;
import com.example.taskboard.theme.ThemeDtos.ImageInfo;
import com.example.taskboard.theme.ThemeDtos.ThemeResponse;
import com.example.taskboard.theme.ThemeDtos.ThemeUpdateRequest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * テーマ API（docs/04_api-design.md 3.5-2）。
 * 業務ルールはすべて ThemeService に置き、ここは入出力の変換だけを行う。
 */
@RestController
@RequestMapping("/api/theme")
@Tag(name = "テーマ", description = "画面の背景（ツートンカラー・背景画像）の取得と変更")
public class ThemeController {

    /**
     * 画像のキャッシュ期間（1年）。
     * 画面は URL に版番号（?v=）を付けて読み込むため、画像を置き換えれば別の URL になる。
     * そのため同じ URL の中身は変わらず、長く持たせてよい（docs/04_api-design.md 4.20）。
     */
    private static final Duration IMAGE_CACHE_DURATION = Duration.ofDays(365);

    private final ThemeService themeService;

    public ThemeController(ThemeService themeService) {
        this.themeService = themeService;
    }

    /** 今のテーマ（F-66）。 */
    @GetMapping
    @Operation(summary = "テーマの取得", description = "一度も変えていなければ DEFAULT。カスタムカラーと画像の情報は種類に関係なく返す")
    public ThemeResponse find(@AuthenticationPrincipal AppUserDetails user) {
        return themeService.find(user.getId());
    }

    /** テーマの変更（F-62・F-63・F-65）。テーマ変更パネルの「適用」で呼ばれる。 */
    @PutMapping
    @Operation(summary = "テーマの変更", description = "IMAGE は背景画像が無ければ 409")
    public ThemeResponse update(@AuthenticationPrincipal AppUserDetails user,
                                @Valid @RequestBody ThemeUpdateRequest request) {
        return themeService.update(user.getId(), request);
    }

    /** 背景画像のアップロード（F-64）。テーマは切り替えない。形式は中身で判定する。 */
    @PutMapping(path = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "背景画像のアップロード", description = "JPEG・PNG・WebP、5MB まで。すでにあれば置き換える")
    public ImageInfo uploadImage(@AuthenticationPrincipal AppUserDetails user,
                                 @RequestParam("file") MultipartFile file) throws IOException {
        return themeService.uploadImage(user.getId(), file.getBytes());
    }

    /** 背景画像の取得（F-64）。画面は CSS の background-image で読み込む。 */
    @GetMapping("/image")
    @Operation(summary = "背景画像の取得", description = "画像そのものを返す。無ければ 404")
    public ResponseEntity<byte[]> findImage(@AuthenticationPrincipal AppUserDetails user) {
        BackgroundImage image = themeService.findImage(user.getId());

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.getContentType()))
                // private：利用者ごとに違う画像なので、途中の共有キャッシュには残させない
                .cacheControl(CacheControl.maxAge(IMAGE_CACHE_DURATION).cachePrivate().immutable())
                .body(image.getContent());
    }

    /** 背景画像の削除（F-64）。画像をテーマに使っていたら既定に戻る。 */
    @DeleteMapping("/image")
    @Operation(summary = "背景画像の削除", description = "IMAGE のテーマは DEFAULT に戻る。無ければ 404")
    public ResponseEntity<Void> deleteImage(@AuthenticationPrincipal AppUserDetails user) {
        themeService.deleteImage(user.getId());
        return ResponseEntity.noContent().build();
    }
}
