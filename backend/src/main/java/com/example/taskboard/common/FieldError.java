package com.example.taskboard.common;

/**
 * 入力チェック（400）のときだけ ProblemDetail に付ける項目ごとのエラー。
 * docs/04_api-design.md 2.6 の {@code errors} に対応する。
 */
public record FieldError(String field, String message) {
}
