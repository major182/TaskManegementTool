package com.example.taskboard.theme;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.taskboard.auth.AppUserDetails;
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
}
