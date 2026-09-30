package com.example.taskboard.theme;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

/** 背景画像の取得・保存。主キーが利用者 ID なので findById で「その利用者の画像」になる。 */
public interface BackgroundImageRepository extends JpaRepository<BackgroundImage, Long> {

    /**
     * 画像の中身（content）を読まずに、形式・大きさ・版番号だけを取る。
     * 戻り値をインターフェース（プロジェクション）にすると、Spring Data が
     * そこに書いた項目だけを SELECT するため、最大 5MB の中身を読み込まずに済む。
     */
    Optional<Info> findInfoByUserId(Long userId);

    /** 画像の情報だけを表すプロジェクション。 */
    interface Info {

        String getContentType();

        int getSizeBytes();

        Instant getUpdatedAt();
    }
}
