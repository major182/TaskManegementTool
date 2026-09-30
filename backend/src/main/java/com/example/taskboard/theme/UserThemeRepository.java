package com.example.taskboard.theme;

import org.springframework.data.jpa.repository.JpaRepository;

/** テーマの取得・保存。主キーが利用者 ID なので findById で「その利用者のテーマ」になる。 */
public interface UserThemeRepository extends JpaRepository<UserTheme, Long> {
}
