package com.example.taskboard.theme;

import java.util.Optional;

/**
 * 背景画像の形式を、ファイルの中身の先頭数バイト（マジックバイト）から判定する
 * （docs/04_api-design.md 4.19）。
 *
 * 拡張子やブラウザが付ける Content-Type は利用者が自由に偽れるため使わない。
 * 画像に見せかけた HTML やスクリプトを保存させず、SVG（中にスクリプトを埋め込める）も通さないため。
 */
final class ImageFormat {

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] RIFF = {0x52, 0x49, 0x46, 0x46};
    private static final byte[] WEBP = {0x57, 0x45, 0x42, 0x50};

    private ImageFormat() {
    }

    /**
     * 中身から形式を判定する。
     *
     * @return {@code image/jpeg}・{@code image/png}・{@code image/webp} のいずれか。どれでもなければ空
     */
    static Optional<String> detect(byte[] content) {
        if (startsWith(content, 0, JPEG)) {
            return Optional.of("image/jpeg");
        }
        if (startsWith(content, 0, PNG)) {
            return Optional.of("image/png");
        }
        // WebP は「RIFF」＋大きさ（4バイト）＋「WEBP」。間の4バイトは値が決まっていないので見ない
        if (startsWith(content, 0, RIFF) && startsWith(content, 8, WEBP)) {
            return Optional.of("image/webp");
        }
        return Optional.empty();
    }

    private static boolean startsWith(byte[] content, int offset, byte[] expected) {
        if (content.length < offset + expected.length) {
            return false;
        }
        for (int i = 0; i < expected.length; i++) {
            if (content[offset + i] != expected[i]) {
                return false;
            }
        }
        return true;
    }
}
