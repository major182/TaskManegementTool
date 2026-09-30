package com.example.taskboard.common;

/**
 * アップロードされたファイルが大きすぎるときに投げる（413）。
 * 例：背景画像が 5MB を超えたとき（docs/01-3_business-rules.md 5.7）。
 */
public class PayloadTooLargeException extends RuntimeException {

    public PayloadTooLargeException(String message) {
        super(message);
    }
}
