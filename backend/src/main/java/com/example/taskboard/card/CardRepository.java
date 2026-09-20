package com.example.taskboard.card;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CardRepository extends JpaRepository<Card, Long> {

    /**
     * 複数のリストのカードをまとめて取得する（docs/04_api-design.md 4.5）。
     * リストごとに1回ずつ問い合わせると N+1 になるため、1回で引いて呼び出し側で振り分ける。
     */
    List<Card> findByListIdInAndDeletedAtIsNullOrderByPositionAsc(Collection<Long> listIds);
}
