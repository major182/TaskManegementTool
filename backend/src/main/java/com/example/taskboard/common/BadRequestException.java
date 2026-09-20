package com.example.taskboard.common;

/**
 * 入力の形式は正しいが、内容がその場の状態に合わないときに投げる（400）。
 * 例：並び替えで、今あるリストの数を超える位置を指定されたとき。
 * 形式そのものの誤りは Bean Validation が先に 400 にするため、ここには来ない。
 */
public class BadRequestException extends RuntimeException {

    public BadRequestException(String message) {
        super(message);
    }
}
