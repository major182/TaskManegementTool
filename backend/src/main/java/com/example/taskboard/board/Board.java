package com.example.taskboard.board;

import java.time.Instant;

import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
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

    // DDL の DEFAULT now() が入れた値を、保存した直後に読み戻す
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    /** DDL の DEFAULT now() は挿入時だけなので、更新時は @PreUpdate で入れ直す。 */
    @Generated(event = EventType.INSERT)
    @Column(name = "updated_at", nullable = false, insertable = false)
    private Instant updatedAt;

    /** ゴミ箱へ移動した日時。null なら通常の（表示される）ボード。 */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** JPA が使う既定コンストラクタ。 */
    protected Board() {
    }

    public Board(Long userId, String name) {
        this.userId = userId;
        this.name = name;
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

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
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
