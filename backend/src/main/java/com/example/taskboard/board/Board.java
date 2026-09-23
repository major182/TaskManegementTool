package com.example.taskboard.board;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * ボード。boards テーブルに対応する（docs/03_db-design.md 3.2）。
 * 削除は行を消さず deleted_at を入れる「ゴミ箱」方式（docs/03_db-design.md 1.1）。
 */
@Entity
@Table(name = "boards")
public class Board {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 持ち主の利用者 ID。
     * User への関連は張らず ID だけを持つ。画面に利用者の情報を出すことはなく、
     * 「この ID のものか」を確認できれば足りるため（docs/04_api-design.md 7章）。
     */
    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(nullable = false, length = 50)
    private String name;

    /** サイドバーでの並び順。0 が一番上（docs/01-3_business-rules.md 5.2）。 */
    @Column(nullable = false)
    private int position;

    // 作成日時は Hibernate が保存時に入れる（DDL の DEFAULT now() は、SQL を直接実行したときの保険）
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** 更新日時は Hibernate が保存・更新のたびに入れ直す。 */
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** ゴミ箱へ移動した日時。null なら通常の（表示される）ボード。 */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** JPA が使う既定コンストラクタ。 */
    protected Board() {
    }

    public Board(Long userId, String name, int position) {
        this.userId = userId;
        this.name = name;
        this.position = position;
    }

    /** 並び順の付け替え。詰め直し・並び替えのどちらでも使う。 */
    public void moveTo(int position) {
        this.position = position;
    }

    /** ボード名の変更（F-13）。 */
    public void rename(String name) {
        this.name = name;
    }

    /** ゴミ箱へ移動（F-14）。中のリスト・カードの deleted_at は変えない（docs/04_api-design.md 4.13）。 */
    public void moveToTrash(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }

    /** ゴミ箱から元に戻す（F-42）。 */
    public void restore() {
        this.deletedAt = null;
    }


    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public int getPosition() {
        return position;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
