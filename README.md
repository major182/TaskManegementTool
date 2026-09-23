# タスク管理ツール（Trello風）

プログラミングスクールの課題として開発している、Trello 風のタスク管理 Web アプリです。
「ボード・リスト・カード」の形でタスクを見える化し、ドラッグ＆ドロップで進み具合を管理できます。

**現在の進捗：総合テスト109項目をすべて実施し、すべて OK でした（[06 テスト仕様書](docs/06_test-spec.md)）。次はリリース工程です。**

---

## このリポジトリについて

スクール課題として、**実務の開発フローをそのままなぞること** を目的にしています。
いきなりコードを書くのではなく、次の順番で工程を進め、各工程の成果物をドキュメントとして残しています。

| フェーズ | 成果物 | 状態 |
|---|---|---|
| 要件定義 | [01 要件定義書](docs/01_requirements.md) ＋ 分割ドキュメント（01-1〜01-5） | ✅ 完了（未決事項5件すべて解決） |
| プロトタイプ | [prototype/](prototype/)（HTML／CSS／JavaScript） | ✅ 完了 |
| 技術選定 | [02 技術選定書](docs/02_tech-stack.md) | ✅ 完了 |
| 基本設計 | [03 DB設計書](docs/03_db-design.md)、[04 API設計書](docs/04_api-design.md)、[05 画面設計書](docs/05_screen-design.md) | ✅ 完了 |
| 実装（バックエンド） | `backend/`（Spring Boot）。認証・ボード・リスト・カード・ゴミ箱の API 21本 | ✅ 完了（テストも通過） |
| 実装（フロントエンド） | `frontend/`（React）。S-01 メイン画面、S-02 ログイン、S-03 新規登録 | ✅ 完了（テストも通過） |
| テスト | [06 テスト仕様書](docs/06_test-spec.md)（テスト項目表・結果） | ✅ 完了（109項目すべて OK） |
| リリース | 公開 URL | ⬜ 未着手 |

> ドキュメントは「お客様に説明し、合意をいただくための資料」という想定で日本語で書いています。
> 判断に迷った箇所は、選ばなかった案とその理由も残すようにしています。

---

## ドキュメント

| No | ドキュメント | 内容 |
|---|---|---|
| 01 | [要件定義書](docs/01_requirements.md) | 概要・スコープ・非機能要件・受け入れ基準・未決事項 |
| 01-1 | [ユースケース](docs/01-1_use-cases.md) | アクター、ユースケース一覧・記述 |
| 01-2 | [機能要件](docs/01-2_functional-requirements.md) | 機能一覧（ID・内容・優先度） |
| 01-3 | [業務ルール](docs/01-3_business-rules.md) | 入力・表示・削除・保存・ログインのルール |
| 01-4 | [データ要件](docs/01-4_data-requirements.md) | データ一覧・関係図・データの流れ |
| 01-5 | [用語集](docs/01-5_glossary.md) | アプリ・開発・技術の用語 |
| 02 | [技術選定書](docs/02_tech-stack.md) | 使用技術・システム構成・認証方式 |
| 03 | [DB設計書](docs/03_db-design.md) | ER図・テーブル定義・DDL |
| 04 | [API設計書](docs/04_api-design.md) | エンドポイント一覧・JSON・エラー形式 |
| 05 | [画面設計書](docs/05_screen-design.md) | 画面遷移図・画面項目定義・メッセージ一覧 |
| 06 | [テスト仕様書](docs/06_test-spec.md) | テスト項目表（109項目）・テスト環境・実施結果 |

最初に読むなら [01 要件定義書](docs/01_requirements.md) から、実装の全体像を知りたい場合は [02 技術選定書](docs/02_tech-stack.md) からどうぞ。

---

## 主な機能（バージョン1で作るもの）

- ボード・リスト・カードの作成、表示、**その場での編集**、削除
- ドラッグ＆ドロップでのカード移動・リスト並び替え
- カードの完了チェック（取り消し線と薄い色で表示）
- カードの期限日の設定と、期限切れの色表示
- ゴミ箱（削除 → 元に戻す／完全に削除の2段階）
- サーバーへの自動保存（保存ボタンはなし）
- アカウントの新規登録・ログイン・ログアウト

作らないもの：ボードの共有・同時編集、ファイル添付、パスワード再設定・退会、スマホ表示対応。
詳細は [01-2 機能要件](docs/01-2_functional-requirements.md)（Must／Should／Could）を参照してください。

---

## 技術スタック

バックエンド・フロントエンド・DB は課題での指定、それ以外は [02 技術選定書](docs/02_tech-stack.md) で選定しています。

| 区分 | 技術 |
|---|---|
| バックエンド | Java 21 / Spring Boot（Spring Web、Spring Data JPA、Spring Security、Bean Validation） |
| ビルド | Gradle（Kotlin DSL） |
| データベース | PostgreSQL（マイグレーションは Flyway） |
| フロントエンド | React / TypeScript / Vite（TanStack Query、dnd-kit、CSS Modules） |
| テスト | JUnit 5・Mockito・Testcontainers / Vitest・React Testing Library |
| 公開先 | AWS（使用するサービスは指定待ち）|

---

## フォルダ構成

```
TaskManegementTool/
├── README.md         … このファイル
├── docs/             … 要件定義・設計ドキュメント
├── prototype/        … 画面イメージ確認用の試作（HTML／CSS／JavaScript）
├── backend/          … Spring Boot（Gradle）
├── frontend/         … React（Vite）
└── compose.yaml      … 開発用 PostgreSQL
```

---

## 開発環境の動かし方

必要なもの：JDK 21、Node.js 20 以上、Docker Desktop（Windows では WSL2 も必要）。

### 1. データベースを起動する

```bash
docker compose up -d
```

PostgreSQL 17 が `localhost:5432` で起動します（DB 名・ユーザー・パスワードはすべて `taskboard`）。
止めるときは `docker compose down`、データごと消すときは `docker compose down -v` です。

### 2. バックエンドを起動する

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

`http://localhost:8080` で起動します。テーブルは起動時に Flyway が自動で作ります。
`local` プロファイルは、開発中（HTTP）でもログイン用の Cookie が届くようにするための指定です。

- API を画面から試す：<http://localhost:8080/swagger-ui.html>
- テストを流す：`./gradlew test`（Testcontainers が PostgreSQL を起動するので Docker が必要）

### 3. フロントエンドを起動する

```bash
cd frontend
npm install
npm run dev
```

<http://localhost:5173> で開きます。`/api` への通信はバックエンドへ自動で転送されます。

---

## 公開（リリース）について

公開先は **AWS** を予定しています。どのサービスを使うかは指定待ちのため、
決まっていなくても用意できるところまでを済ませてあります（[Issue #48](https://github.com/major182/TaskManegementTool/issues/48)）。

### 用意できているもの

| 内容 | 場所 |
|---|---|
| バックエンドのコンテナ化 | `backend/Dockerfile`（App Runner・ECS・EC2 のいずれでも使える） |
| 待ち受けポートの指定 | 環境変数 `PORT`（既定 8080） |
| TLS を終端する経路への対応 | `server.forward-headers-strategy: framework`（ALB・CloudFront の配下で必要） |
| 死活確認 | `GET /actuator/health`（未ログインで叩ける。中身は返さない） |

### 公開時に設定する環境変数

| 変数名 | 内容 | 例 |
|---|---|---|
| `DB_URL` | データベースの接続先 | `jdbc:postgresql://<ホスト>:5432/taskboard` |
| `DB_USERNAME` | データベースの利用者名 | `taskboard` |
| `DB_PASSWORD` | データベースのパスワード | （秘密情報。コンテナの環境変数などで渡す） |
| `CORS_ALLOWED_ORIGINS` | 画面の公開ドメイン。**画面と API を同じドメインで配信する場合は不要** | `https://example.com` |
| `PORT` | 待ち受けポート。実行環境が指定する場合のみ | `8080` |

> 設定しないと、データベースは `localhost`、CORS は `http://localhost:5173` という開発用の値が使われます。
> 公開時は必ず設定してください。

### 決めてから進めること

画面と API を**同じドメインで配信するか**を先に決める必要があります。
別のドメインにする場合、今の実装のままでは更新系の通信がすべて失敗します
（CSRF トークンの Cookie を画面側の JavaScript から読めないため）。
CloudFront で `/api/*` を API へ転送する、またはバックエンドに画面を同梱すると、この問題は起きません。

---

## プロトタイプの見かた

`prototype/index.html` をブラウザで開くだけで動きます（サーバー・ビルドは不要）。
見た目とカード・リストの動きを確認するためのもので、データはブラウザを閉じると消えます。本番の実装には使いません。

---

## 補足

- 学習用の課題として作成しているため、運用・保守（障害対応、問い合わせ対応）は対象外です。
- パスワードの再設定機能がないため、パスワードを忘れるとデータを開けなくなります（新規登録画面に注意書きを表示します）。
