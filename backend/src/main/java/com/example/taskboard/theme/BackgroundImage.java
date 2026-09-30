package com.example.taskboard.theme;

import java.time.Instant;

import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 利用者の背景画像。user_background_images テーブルに対応する（docs/03_db-design.md 3.6）。
 * 利用者1人につき最大1枚。
 *
 * content は最大 5MB になるため、画像そのものが要るとき以外はこのエンティティを読まない。
 * 有無や版番号だけ知りたいときは {@link BackgroundImageRepository#findInfoByUserId} を使う。
 */
@Entity
@Table(name = "user_background_images")
public class BackgroundImage {

    @Id
    @Column(name = "user_id")
    private Long userId;

    /**
     * 画像の中身。byte[] は PostgreSQL の bytea に対応する。
     * {@code @Lob} を付けると bytea ではなく別の仕組み（ラージオブジェクト）になるため付けない。
     */
    @Column(name = "content", nullable = false)
    private byte[] content;

    /** 中身から判定した形式（image/jpeg など）。 */
    @Column(name = "content_type", nullable = false, length = 20)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    /** アップロード日時。画像の URL に版番号として付ける（docs/04_api-design.md 4.17）。 */
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** JPA が使う既定コンストラクタ。 */
    protected BackgroundImage() {
    }

    public BackgroundImage(Long userId, byte[] content, String contentType) {
        this.userId = userId;
        replace(content, contentType);
    }

    /** アップロードし直したときに中身を置き換える。前の画像は残さない。 */
    public void replace(byte[] content, String contentType) {
        this.content = content;
        this.contentType = contentType;
        this.sizeBytes = content.length;
    }

    public Long getUserId() {
        return userId;
    }

    public byte[] getContent() {
        return content;
    }

    public String getContentType() {
        return contentType;
    }

    public int getSizeBytes() {
        return sizeBytes;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
