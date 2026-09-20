package com.example.taskboard.common;

/**
 * すでに使われているユーザーID など、状態が矛盾していて処理できないときに投げる（409）。
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
