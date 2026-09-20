package com.example.taskboard.list;

import java.time.Instant;

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

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

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
