# 技術選定書：タスク管理ツール（Trello風）

| 項目 | 内容 |
|---|---|
| ドキュメント版数 | 0.7（ドラフト） |
| 作成日 | 2026-09-17 |
| 最終更新日 | 2026-09-20 |
| 作成者 | （氏名） |
| ステータス | レビュー待ち |

> [要件定義書](01_requirements.md) の「10.2 使用技術」を、スクール課題の指定に合わせて確定させるためのドキュメントです。

---

## 1. 前提（課題による指定）

| 役割 | 指定 |
|---|---|
| バックエンド | Java / Spring Boot |
| フロントエンド | React |
| データベース | PostgreSQL |

それ以外のツールは、上記に合わせて本書で選定します。

---

## 2. システム構成

フロントエンド（React）とバックエンド（Spring Boot）を分け、REST API でつなぐ構成にします。

```
┌──────────────┐   HTTPS / JSON    ┌──────────────────┐    JDBC    ┌────────────┐
│ ブラウザ       │ ───────────────▶ │ Spring Boot       │ ─────────▶ │ PostgreSQL │
│ React (SPA)  │ ◀─────────────── │ REST API          │ ◀───────── │            │
└──────────────┘                   └──────────────────┘            └────────────┘
   Vercel                              Render                          Neon
```

### 2.1 バックエンドの層構成
| 層 | 役割 | 主なクラス |
|---|---|---|
| Controller | HTTP リクエストを受け取り、JSON を返す | `BoardController` など |
| Service | 業務ルール（並び順・ゴミ箱・入力チェック）を処理する。トランザクションの単位 | `BoardService` など |
| Repository | データベースの読み書き | `BoardRepository`（Spring Data JPA） |
| Entity / DTO | テーブルに対応するクラス／API でやり取りするデータ | `Board`（Entity）、`BoardResponse`（record） |

### 2.2 フォルダ構成（1つの Git リポジトリで管理）
```
TaskManegementTool/
├── README.md         … リポジトリの説明（GitHub で最初に表示される）
├── docs/             … 要件定義・設計ドキュメント（01_〜04_）
├── backend/          … Spring Boot（Gradle）
├── frontend/         … React（Vite）
├── prototype/        … 既存のプロトタイプ
└── compose.yaml      … 開発用 PostgreSQL
```

---

## 3. 選定結果

> バージョンは作業開始時点の安定版を使います。下表は 2026-09 時点の目安です。

### 3.1 バックエンド
| 役割 | 技術 | 選んだ理由 |
|---|---|---|
| 言語 | Java 21（LTS） | 長期サポート版。record やテキストブロックなど新しい書き方が使え、教材・情報も多い |
| フレームワーク | Spring Boot（最新の安定版） | 課題の指定。[Spring Initializr](https://start.spring.io/) でひな形を作る |
| ビルドツール | Gradle（Kotlin DSL / `build.gradle.kts`） | Spring Initializr の既定であり、Spring Boot の現場で最も使われている。Kotlin DSL は IDE の補完と型チェックが効くため設定を書き間違えにくい。Gradle Wrapper（`gradlew`）が同梱され、PC に Gradle を入れなくてもビルドできる |
| Web / API | Spring Web | REST API を作るための標準モジュール |
| DB アクセス | Spring Data JPA（Hibernate） | インターフェースを書くだけで基本の CRUD ができ、学習コストが低い |
| DB マイグレーション | Flyway | テーブル定義を SQL ファイルで履歴管理でき、開発環境と本番環境で同じ構造を再現できる |
| 認証・認可 | Spring Security（spring-boot-starter-security） | ログインとパスワードの暗号化（BCrypt）を、自作せず標準的なやり方で実現できる。自作は危険なため現場でも使われる |
| 入力チェック | Bean Validation（spring-boot-starter-validation） | `@NotBlank` `@Size` で業務ルール 5.1 の文字数チェックを書ける |
| API ドキュメント | springdoc-openapi（Swagger UI） | API を画面から確認・試せるので、フロントエンドとのつなぎ込みが楽になる |
| テスト | JUnit 5 / Mockito / Spring Boot Test | Spring Boot に標準で含まれる |
| DB を使うテスト | Testcontainers（PostgreSQL） | 本番と同じ PostgreSQL でテストでき、H2 との差によるバグを防げる |
| ボイラープレート削減 | 使わない（Lombok なし） | DTO は Java の record で十分。学習用として、Java 本来の書き方を優先する |

### 3.2 フロントエンド
| 役割 | 技術 | 選んだ理由 |
|---|---|---|
| ライブラリ | React | 課題の指定 |
| 言語 | TypeScript | API の型を決めておくと、バックエンドとのデータのずれに早く気づける。現場でも標準的 |
| ビルドツール | Vite | React 公式が推奨する構成の1つ。起動・反映が速い（Create React App は非推奨） |
| 実行環境 | Node.js（LTS 版） | Vite の動作に必要 |
| サーバーとの通信・キャッシュ | TanStack Query ＋ fetch | 読み込み中・エラー・再取得の処理を自前で書かずに済む。移動直後に画面を先に更新する（楽観的更新）も書きやすい |
| ドラッグ＆ドロップ | dnd-kit | React 向けで現在も保守されている。カードのリスト間移動とリスト並び替えの両方に対応（react-beautiful-dnd は保守終了） |
| スタイル | CSS Modules | プロトタイプの CSS をほぼそのまま使え、クラス名の衝突も防げる |
| テスト | Vitest ＋ React Testing Library | Vite と設定を共有でき、Jest と同じ書き方ができる |
| コード整形・チェック | oxlint ＋ Prettier | Vite の React + TypeScript テンプレートの既定が ESLint から oxlint に変わったため、そのまま採用した。設定なしで動き、ESLint より大幅に速い（v0.7 で ESLint から変更） |

### 3.3 データベース
| 役割 | 技術 | 選んだ理由 |
|---|---|---|
| DBMS | PostgreSQL | 課題の指定 |
| 開発環境での起動 | Docker Desktop ＋ Docker Compose | PC に直接インストールせず、コマンド1つで起動・削除できる。Testcontainers にも必要 |
| DB の中身を見るツール | IntelliJ IDEA の Database ツール または DBeaver | テーブルやデータを画面で確認できる |

### 3.4 開発環境・公開
| 役割 | 技術 | 選んだ理由 |
|---|---|---|
| エディタ | IntelliJ IDEA Community Edition（Java）／VS Code（React） | Java は IntelliJ の補完・デバッグが強い。VS Code 1本にまとめる場合は Extension Pack for Java を入れる |
| ソース管理 | Git / GitHub | 現場では必ず使う |
| CI | GitHub Actions | push のたびにビルドとテストを自動で動かせる。GitHub と同じ場所で完結する |
| 公開先（フロントエンド） | Vercel | 無料で静的サイトを HTTPS 公開でき、GitHub と連携して自動デプロイできる |
| 公開先（バックエンド） | Render（Docker で公開） | Java（Spring Boot）を無料プランで動かせる。※しばらくアクセスがないと停止し、次のアクセスで起動に数十秒かかる |
| 公開先（データベース） | Neon | PostgreSQL を無料で使え、Render の無料 DB のような利用期限がない |

### 3.5 実装時に確定したバージョン（2026-09-20）

実際に環境を作ったときの版数です。

| 項目 | 版数 | 備考 |
|---|---|---|
| Java | Temurin 21.0.12（LTS） | `JAVA_HOME` に設定して使う |
| Spring Boot | 4.1.1 | Spring Initializr の既定（最新の安定版） |
| Gradle | 9.7.1 | Wrapper に同梱。PC への導入は不要 |
| PostgreSQL | 17 | `compose.yaml` と Testcontainers の両方で 17 に固定し、開発とテストの差をなくす |
| springdoc-openapi | 3.0.0 | Spring Boot 4 に対応した系列 |
| Node.js | 24（LTS） | |
| Vite | 8 / React 19 / TypeScript 6 | |

> **Spring Boot 4 で変わった点（実装でつまずいた箇所）**
> - JSON の処理が **Jackson 3** になり、パッケージが `com.fasterxml.jackson` から `tools.jackson` に変わった。`ObjectMapper` を自分で使うときは import 先に注意する
> - `spring.jackson.serialization.write-dates-as-timestamps` は廃止された。日時は既定で ISO 8601 の文字列になるため、指定は不要（[04 API設計書 2.1](04_api-design.md#21-基本) の形式をそのまま満たす）
> - テスト用の `@AutoConfigureMockMvc` が `org.springframework.boot.webmvc.test.autoconfigure` に移動した
> - 依存の名前が機能ごとに分かれた（例：`spring-boot-starter-web` → `spring-boot-starter-webmvc`）

---

## 4. 検討したが選ばなかった技術

| 候補 | 選ばなかった理由 |
|---|---|
| Maven | 設定ファイル（`pom.xml`）は宣言的で読みやすく日本語の情報も多いが、Spring Initializr の既定・現場での利用率は Gradle が上回る。依存の記述も Gradle のほうが短い（v0.4 で Gradle に変更） |
| MyBatis | SQL を直接書けて分かりやすいが、今回のテーブルは単純なため JPA で十分 |
| H2（組み込み DB） | 手軽だが PostgreSQL と SQL の方言が違い、本番だけで起きるバグの原因になる |
| Thymeleaf | サーバー側で画面を作る方式。フロントエンドを React で作る指定と合わない |
| Next.js | サーバー機能を持つ React フレームワーク。API は Spring Boot が担うため不要 |
| Redux | 状態管理ライブラリ。サーバーのデータは TanStack Query で管理でき、画面だけの状態は React 標準で足りる |
| Axios | 便利だが、ブラウザ標準の fetch で十分 |

---

## 5. 利用者の見分け方（決定：ID＋パスワードのログイン）

データをサーバーに保存するため、「誰のデータか」を見分ける仕組みが必要になります。
検討の結果、**ユーザーID とパスワードによるログイン** を作ることに決定しました（要件定義書 v0.12 で反映済み）。

| 案 | 内容 | 判定 |
|---|---|---|
| A. ログインなし・全員共通 | 1つのデータを全員で使う | ✕ 公開 URL を開いた他人にデータが見える |
| B. ログインなし・ブラウザごとの利用者キー | 初回アクセス時にサーバーがキーを発行し、Cookie で見分ける | ✕（v0.11 でいったん採用）Cookie を消すとデータを開けなくなる。別のパソコンからも使えない |
| **C. ID＋パスワードのログイン** | 新規登録・ログイン・ログアウトを作る | **◯ 採用**。別のパソコンからも使え、認証の実装を学べる。パスワード再設定・退会は作らず、範囲を絞る |

### 5.1 実現方法
| 項目 | 内容 |
|---|---|
| 認証のしくみ | Spring Security（`spring-boot-starter-security`）のフォームログインではなく、**REST API でのログイン**（`POST /api/auth/login`）として実装する。画面は React が持つため |
| パスワードの保存 | Spring Security の `BCryptPasswordEncoder` でハッシュ化して保存する。元に戻すことはできない |
| ログイン状態の保持 | サーバー側のセッション（`JSESSIONID` Cookie、`HttpOnly` / `Secure` / `SameSite=None`、有効期限30日）。セッションの保存先は Spring Security の既定（サーバーのメモリ上）とし、Spring Session JDBC は使わない。そのためサーバーの再起動・スリープ時は再ログインが必要（[04 API設計書 1.1](04_api-design.md#11-セッションをメモリに持つことの制約要件への影響)） |
| 認可（アクセス制限） | `/api/auth/**` 以外の API は、ログイン済みでなければ 401 を返す。さらに各処理で「ログイン中の利用者のデータか」を確認し、他人のデータなら 404 を返す |
| CSRF 対策 | Cookie でセッションを持つため、Spring Security の CSRF トークンを有効にする（`CookieCsrfTokenRepository`） |
| 対象外 | パスワード再設定、退会、メールアドレス登録、ログイン失敗回数によるロック |
| 開発・公開時の注意 | 画面（Vercel）と API（Render）でドメインが違うため、CORS の許可設定と、Cookie を送るための `credentials: 'include'` が必要 |

> セッション方式（Cookie）と JWT 方式を比べ、**セッション方式**を選びました。Spring Security の標準機能をそのまま使え、ログアウトでサーバー側から無効にできるためです。

### 5.2 要件定義書の更新内容（v0.11〜v0.12 で反映済み）
| 箇所 | 更新後 |
|---|---|
| 1.2 目的／1.3 対象ユーザー | ログインすればどのパソコンからでも同じ内容を見られる、1人1アカウント |
| 2.1 / 2.2 スコープ | DB 保存とアカウント機能を対象範囲に追加。パスワード再設定・退会・メール送信は対象外 |
| 4.1 アカウント | F-05 新規登録、F-06 ログイン、F-07 ログアウト、F-08 ログイン状態の保持（すべて Must） |
| 4.2 データの保存 | F-01・F-02 をサーバー保存に変更。F-04（通信エラーの表示）を追加 |
| 5.1 入力のルール | ユーザーID・パスワードの文字数と形式を追加 |
| 5.4／5.6 | 保存のルールをサーバー保存に変更。ログインのルール（5.6）を新設 |
| 6 / 6.1 | データ保持・可用性・パスワードの保護・認可・ログイン失敗時の表示を更新 |
| 7 画面一覧 | S-02 ログイン画面、S-03 新規登録画面を追加 |
| 8.1〜8.4 データ要件 | データに「利用者（ユーザーID・パスワードのハッシュ）」を追加し、保存先をデータベースに変更 |
| 9 受け入れ基準 | ログイン・ログアウト、他人のデータが見えないこと、パスワードのハッシュ化を追加 |
| 10 制約・前提 | 使用言語・公開方法を更新。パスワードを忘れるとデータを開けなくなる点を明記 |
| 01-1 ユースケース | UC-20 アカウントを作る、UC-21 ログインする、UC-22 ログアウトする を追加 |

---

## 改訂履歴
| 版数 | 日付 | 内容 | 作成者 |
|---|---|---|---|
| 0.7 | 2026-09-20 | 実装開始にあたり、3.5「実装時に確定したバージョン」を追加。コード整形・チェックを ESLint から oxlint に変更（Vite テンプレートの既定に合わせた） | |
| 0.6 | 2026-09-20 | 2.2 フォルダ構成に README.md と docs/ フォルダを反映（ドキュメントを docs/ に移動） | |
| 0.5 | 2026-09-20 | セッションの保存先を Spring Security の既定（メモリ）と明記（[04 API設計書](04_api-design.md) の決定を反映） | |
| 0.4 | 2026-09-20 | ビルドツールを Maven から Gradle（Kotlin DSL）に変更。「選ばなかった技術」も入れ替え | |
| 0.3 | 2026-09-20 | 利用者の見分け方を、ユーザーID＋パスワードのログイン（案C）に変更。Spring Security を採用し、セッション方式・BCrypt・CSRF 対策を記載 | |
| 0.2 | 2026-09-20 | 利用者の見分け方を案B（ログインなし・ブラウザごとの利用者キー）に決定し、実現方法と要件定義書の更新内容を記載 | |
| 0.1 | 2026-09-17 | 初版作成（課題の指定：Java / Spring Boot、React、PostgreSQL） | |
