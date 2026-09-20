package com.example.taskboard.card;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * カード。cards テーブルに対応する（docs/03_db-design.md 3.4）。
 */
@Entity
@Table(name = "cards")
public class Card {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "list_id", nullable = false)
    private Long listId;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(length = 2000)
    private String description;

    /** 期限日。時刻は持たない。null は「期限日なし」（docs/01-3_business-rules.md 5.1）。 */
    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "is_done", nullable = false)
    private boolean done;

    /** リスト内での並び順。0 が一番上。 */
    @Column(nullable = false)
    private int position;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** JPA が使う既定コンストラクタ。 */
    protected Card() {
    }

    public Card(Long listId, String title, int position) {
        this.listId = listId;
        this.title = title;
        this.position = position;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getListId() {
        return listId;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public boolean isDone() {
        return done;
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
