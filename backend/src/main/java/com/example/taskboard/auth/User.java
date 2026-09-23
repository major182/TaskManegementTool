package com.example.taskboard.auth;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 利用者。users テーブルに対応する（docs/03_db-design.md 3章）。
 * パスワードはハッシュ化した値だけを持ち、元のパスワードは保存しない。
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20, updatable = false)
    private String username;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    /** 最後に開いていたボード（F-15）。まだ開いていなければ null。 */
    @Column(name = "last_opened_board_id")
    private Long lastOpenedBoardId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** JPA が使う既定コンストラクタ。 */
    protected User() {
    }

    public User(String username, String passwordHash) {
        this.username = username;
        this.passwordHash = passwordHash;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Long getLastOpenedBoardId() {
        return lastOpenedBoardId;
    }

    public void setLastOpenedBoardId(Long lastOpenedBoardId) {
        this.lastOpenedBoardId = lastOpenedBoardId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
