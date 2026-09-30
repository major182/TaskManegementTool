# タスク管理ツール（Trello 風）

「ボード・リスト・カード」の形でタスクを見える化し、ドラッグ＆ドロップで進み具合を管理できる Web アプリです。
入力した内容はその場でサーバーに保存されるため、保存ボタンはありません。ログインすれば、別のパソコンやブラウザからでも同じデータを開けます。

![メイン画面。左のサイドバーでボードを切り替え、右の表示エリアにリストとカードが並ぶ。背景には利用者がアップロードした画像を設定している](docs/images/main-screen.png)

*メイン画面（背景に画像を設定した状態）。左のサイドバーでボードの切り替え・ゴミ箱・テーマの変更を行い、右の表示エリアでリストとカードを操作します。*

> プログラミングスクールの課題として、要件定義からリリースまでの実務の開発工程に沿って作成しています。

---

## 目次

- [主な機能](#主な機能)
- [システム構成](#システム構成)
- [使用技術](#使用技術)
- [開発環境で動かす](#開発環境で動かす)
- [テスト](#テスト)
- [本番環境（AWS）](#本番環境aws)
- [ドキュメント](#ドキュメント)
- [フォルダ構成](#フォルダ構成)
- [制約事項](#制約事項)

---

## 主な機能

| 分類 | できること |
|---|---|
| アカウント | ユーザーID とパスワードで新規登録・ログイン・ログアウト。ログイン状態は最大30日間保持 |
| ボード | 作成・名前の変更・削除。サイドバーでの切り替えと、ドラッグ＆ドロップでの並び替え。最後に開いていたボードを次回も表示 |
| リスト | 作成・名前の変更・削除。ドラッグ＆ドロップで左右に並び替え |
| カード | 作成・タイトルと説明文の編集・削除。ドラッグ＆ドロップで同じリスト内・別のリストへ移動 |
| 完了チェック | チェックを付けたカードは、取り消し線と薄い色で表示 |
| 期限日 | カードに期限日を設定。期限を過ぎた未完了のカードは日付を目立たせる |
| ゴミ箱 | 削除したものはまずゴミ箱へ入り、元に戻せる。ゴミ箱から完全に削除すると元に戻せない（確認あり） |
| 背景テーマ | サイドバーと表示エリアの2色を、テンプレート5種類またはカスタムカラー（RGB 指定）から選べる。画像をアップロードして背景にもできる |
| 自動保存 | 操作のたびにサーバーへ保存。通信に失敗したときは画面を元に戻し、やり直せるようにする |

名前やカードは、押した場所でそのまま編集できます（別の画面やポップアップは開きません）。
機能の詳細は [01-2 機能要件](docs/01-2_functional-requirements.md)、操作のルールは [01-3 業務ルール](docs/01-3_business-rules.md) にまとめています。

---

## システム構成

```
 ブラウザ（許可した IP のみ）
      │ HTTP
      ▼
 ┌─ AWS（東京リージョン）──────────────────────────┐
 │  EC2（Docker）                                   │
 │   └ アプリのコンテナ                              │
 │      ├ 画面（React をビルドしたもの）              │
 │      └ API（Spring Boot）                         │
 │            │                                     │
 │            ▼                                     │
 │  RDS for PostgreSQL（外部から直接つながらない場所） │
 └──────────────────────────────────────────────────┘
       ▲
       │ main にマージされると自動でビルド・反映（GitHub Actions）
```

- 画面と API を1つのコンテナにまとめ、同じサーバーから配信しています
- インフラはすべて Terraform（コードでインフラを作る道具）で管理しています
- 構成と、そう決めた理由は [07 デプロイ手順書](docs/07_deployment.md) にまとめています

---

## 使用技術

| 区分 | 技術 |
|---|---|
| バックエンド | Java 21 / Spring Boot（Spring Web・Spring Data JPA・Spring Security・Bean Validation）/ Gradle |
| データベース | PostgreSQL 17（テーブルの作成・変更は Flyway で管理） |
| フロントエンド | React / TypeScript / Vite / TanStack Query / dnd-kit / CSS Modules |
| テスト | JUnit 5・Mockito・Testcontainers / Vitest・React Testing Library |
| 品質チェック | Spotless・Checkstyle / oxlint・Prettier / GitHub Actions（Pull Request ごとに自動実行） |
| インフラ | AWS（EC2・RDS・ECR）/ Terraform / Docker |
| 自動デプロイ | GitHub Actions（AWS への認証は OIDC。アクセスキーを GitHub に置かない） |

技術を選んだ理由と、選ばなかった案は [02 技術選定書](docs/02_tech-stack.md) にまとめています。

---

## 開発環境で動かす

### 必要なもの

- JDK 21
- Node.js 24
- Docker Desktop（Windows では WSL2 も必要）

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

`http://localhost:8080` で起動し、テーブルは Flyway が自動で作ります。
`local` プロファイルは、開発中（HTTP）でもログイン用の Cookie が届くようにするための指定です。
API の一覧と試し打ちは <http://localhost:8080/swagger-ui.html> で行えます（開発環境のみ）。

### 3. フロントエンドを起動する

```bash
cd frontend
npm install
npm run dev
```

<http://localhost:5173> を開きます。`/api` への通信はバックエンドへ自動で転送されます。

---

## テスト

| 対象 | コマンド | 内容 |
|---|---|---|
| バックエンド | `cd backend && ./gradlew check` | 整形・Checkstyle・ユニットテスト・API の結合テスト。結合テストは Testcontainers で実際の PostgreSQL を起動する（Docker が必要） |
| フロントエンド | `cd frontend && npm run check && npm run build` | 型・lint・整形・部品テスト・ビルド |

同じチェックが Pull Request ごとに GitHub Actions でも動きます。
利用者の操作で要件を確かめる総合テストは、[06 テスト仕様書](docs/06_test-spec.md) の手順で実施し、結果を記録しています。

---

## 本番環境（AWS）

- **公開範囲**：作業する PC の IP アドレスからのみアクセスできます（課題の指示による）。URL は公開していません
- **デプロイ**：`main` にマージされると、GitHub Actions がイメージをビルドして ECR に置き、EC2 のアプリを入れ替えます。起動後の死活確認に失敗した場合はワークフローが失敗します
- **稼働**：常時は動かさず、作業するときだけ起動します。止め方・再開のしかた・費用は [07 デプロイ手順書](docs/07_deployment.md) を参照してください

---

## ドキュメント

設計書は「お客様に説明し、合意をいただくための資料」という想定で書いています。判断に迷った箇所は、選ばなかった案とその理由も残しています。

| No | ドキュメント | 内容 |
|---|---|---|
| 01 | [要件定義書](docs/01_requirements.md) | 目的・対象範囲・非機能要件・受け入れ基準 |
| 01-1 | [ユースケース](docs/01-1_use-cases.md) | 利用者の操作の流れ |
| 01-2 | [機能要件](docs/01-2_functional-requirements.md) | 機能の一覧（ID・内容・優先度） |
| 01-3 | [業務ルール](docs/01-3_business-rules.md) | 入力・表示・削除・保存・ログイン・背景テーマのルール |
| 01-4 | [データ要件](docs/01-4_data-requirements.md) | 扱うデータと、その関係 |
| 01-5 | [用語集](docs/01-5_glossary.md) | 用語の説明 |
| 02 | [技術選定書](docs/02_tech-stack.md) | 使用技術と選定理由 |
| 03 | [DB設計書](docs/03_db-design.md) | ER図・テーブル定義・DDL |
| 04 | [API設計書](docs/04_api-design.md) | エンドポイント・JSON・エラーの形式 |
| 05 | [画面設計書](docs/05_screen-design.md) | 画面遷移・画面項目・メッセージ |
| 06 | [テスト仕様書](docs/06_test-spec.md) | 総合テストの項目と結果 |
| 07 | [デプロイ手順書](docs/07_deployment.md) | AWS の構成・費用・運用手順 |

初めて読む場合は [01 要件定義書](docs/01_requirements.md) から、仕組みを知りたい場合は [02 技術選定書](docs/02_tech-stack.md) からどうぞ。

---

## フォルダ構成

```
TaskManegementTool/
├── README.md          … このファイル
├── docs/              … 要件定義書・設計書・手順書
├── backend/           … API（Spring Boot）
├── frontend/          … 画面（React）
├── infra/terraform/   … AWS のインフラ定義（Terraform）
├── .github/workflows/ … CI（品質チェック）と自動デプロイ
├── Dockerfile         … 画面と API を1つにまとめる本番用イメージ
├── compose.yaml       … 開発用の PostgreSQL
└── prototype/         … 開発初期に画面イメージを確かめた試作（本番では使わない）
```

開発のルール（Issue・ブランチ・Pull Request の進め方など）は [CLAUDE.md](CLAUDE.md) にまとめています。

---

## 制約事項

- 対応するブラウザは PC の Google Chrome です。スマートフォン・タブレットでの表示には対応していません
- パスワードの再設定・退会はできません（メール送信の仕組みが必要になるため）。パスワードを忘れるとデータを開けなくなります
- ボードの共有や、複数人での同時編集はできません
- サーバーを再起動するとログイン状態が解除され、もう一度ログインが必要になります
- 通信は HTTPS ではなく HTTP です。アクセスできる IP アドレスを限定することで補っています
