package com.example.taskboard.card;

import java.time.Instant;
import java.time.LocalDate;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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

    // 作成日時は Hibernate が保存時に入れる（DDL の DEFAULT now() は、SQL を直接実行したときの保険）
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
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

    /**
     * タイトル・説明文・期限日・完了をまとめて更新する（F-32、F-35、F-38）。
     * 4項目すべてを受け取る形にして、null を「消す」の意味だけに使えるようにしている
     * （docs/04_api-design.md 3.4 の補足）。
     */
    public void update(String title, String description, LocalDate dueDate, boolean done) {
        this.title = title;
        this.description = description;
        this.dueDate = dueDate;
        this.done = done;
    }

    /** 別のリストへ移す（F-34）。同じリスト内の並び替えでも使う。 */
    public void moveTo(Long listId, int position) {
        this.listId = listId;
        this.position = position;
    }

    /** 並び順の付け替え。詰め直し・並び替えのどちらでも使う。 */
    public void moveTo(int position) {
        this.position = position;
    }

    /** ゴミ箱へ移動（F-33）。 */
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
