package com.example.taskboard.common;

/**
 * 対象のデータが存在しない、または他人のデータだったときに投げる。
 * どちらの場合も 404 を返す（存在を知らせないため。docs/04_api-design.md 7章）。
 */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
