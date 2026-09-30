package com.example.taskboard.theme;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

/**
 * 画像の形式をマジックバイトで判定する処理の単体テスト（docs/04_api-design.md 4.19）。
 * 通すべき3形式と、通してはいけないもの（GIF・SVG・テキスト・短すぎるデータ）を確かめる。
 */
class ImageFormatTest {

    static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10};
    static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00};
    static final byte[] WEBP = ascii("RIFF$\u0000\u0000\u0000WEBPVP8 ");

    @Test
    void JPEGとPNGとWebPは中身から判定できる() {
        assertThat(ImageFormat.detect(JPEG)).contains("image/jpeg");
        assertThat(ImageFormat.detect(PNG)).contains("image/png");
        assertThat(ImageFormat.detect(WEBP)).contains("image/webp");
    }

    @Test
    void GIFやSVGやテキストは通さない() {
        assertThat(ImageFormat.detect(ascii("GIF89a......"))).isEmpty();
        assertThat(ImageFormat.detect(ascii("<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>"))).isEmpty();
        assertThat(ImageFormat.detect(ascii("これは画像ではありません"))).isEmpty();
    }

    @Test
    void RIFFでもWEBPでなければ通さない() {
        // WAV（音声）も RIFF で始まる
        assertThat(ImageFormat.detect(ascii("RIFF$\u0000\u0000\u0000WAVEfmt "))).isEmpty();
    }

    @Test
    void 空や数バイトだけのデータは通さない() {
        assertThat(ImageFormat.detect(new byte[0])).isEmpty();
        assertThat(ImageFormat.detect(new byte[] {(byte) 0xFF, (byte) 0xD8})).isEmpty();
        assertThat(ImageFormat.detect(ascii("RIFF"))).isEmpty();
    }

    private static byte[] ascii(String text) {
        return text.getBytes(StandardCharsets.UTF_8);
    }
}
