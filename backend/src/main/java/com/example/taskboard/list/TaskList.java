package com.example.taskboard.list;

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
 * リスト。lists テーブルに対応する（docs/03_db-design.md 3.3）。
 * クラス名を TaskList にしているのは java.util.List と紛らわしくならないようにするため。
 */
@Entity
@Table(name = "lists")
public class TaskList {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "board_id", nullable = false)
    private Long boardId;

    @Column(nullable = false, length = 50)
    private String name;

    /** ボード内での並び順。0 が一番左（docs/01-3_business-rules.md 5.2）。 */
    @Column(nullable = false)
    private int position;

    // DDL の DEFAULT now() が入れた値を、保存した直後に読み戻す
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Generated(event = EventType.INSERT)
    @Column(name = "updated_at", nullable = false, insertable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** JPA が使う既定コンストラクタ。 */
    protected TaskList() {
    }

    public TaskList(Long boardId, String name, int position) {
        this.boardId = boardId;
        this.name = name;
        this.position = position;
    }

    /** リスト名の変更（F-22）。 */
    public void rename(String name) {
        this.name = name;
    }

    /** 並び順の付け替え。詰め直し・並び替えのどちらでも使う。 */
    public void moveTo(int position) {
        this.position = position;
    }

    /** ゴミ箱へ移動（F-23）。中のカードの deleted_at は変えない。 */
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

    public Long getBoardId() {
        return boardId;
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

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
