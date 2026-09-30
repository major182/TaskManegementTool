# デプロイ手順書：AWS ＋ Terraform（IaC）

| 項目 | 内容 |
|---|---|
| ドキュメント版数 | 2.0 |
| 作成日 | 2026-09-27 |
| 最終更新日 | 2026-09-30 |
| 作成者 | （氏名） |
| ステータス | 運用中 |

> このアプリを AWS 上で動かすための構成と、その運用手順をまとめた資料です。
> インフラは **Terraform（コードでインフラを作る道具）** で管理しており、
> 実際の設定は [`infra/terraform/`](../infra/terraform/) と [`.github/workflows/`](../.github/workflows/) のファイルが正です。
> 本書には「**何を・なぜそう決めたか**」と「**どう運用するか**」だけを書き、ソースの中身は載せません。

---

## 1. 構成と決定事項

### 1.1 決めたこと

| 項目 | 決定 | 理由 |
|---|---|---|
| 費用の方針 | **付与クレジット（約 $140）の範囲に収める**（実質無料） | スクール課題のため（費用は2章） |
| 稼働方針 | **常時稼働しない。** 作業時だけ起動し、長く触らないときは削除する | 24時間公開する必要がない（運用は 5.4） |
| アプリの実行場所 | **EC2（仮想サーバー）t3.micro 1台** の上で Docker として動かす | App Runner や ECS Fargate＋ALB（約 $25／月〜）より安い（約 $10／月） |
| データベース | **RDS for PostgreSQL 17（db.t4g.micro）** | 自動バックアップが取れ、サーバーを作り直してもデータが残る（1.3） |
| イメージの置き場 | **Amazon ECR（プライベート）** | t3.micro（メモリ 1GB）ではビルドできないため、GitHub Actions でビルドして ECR に置き、EC2 は受け取るだけにする |
| 画面（React）の配信 | **バックエンドに同梱**（1コンテナで配信） | 画面と API が同じ場所になり、CORS・CSRF の手当てが不要。インフラの追加も要らない（1.4） |
| 公開範囲 | **作業する PC の IP アドレスからのみ許可** | 課題の指示による。公開範囲を狭めるほど攻撃されにくい |
| 通信 | **HTTP（80番）**。HTTPS にはしない | 同梱構成で証明書を扱う仕組みがなく、アクセス元も限定しているため許容する（1.4） |
| リージョン | **ap-northeast-1（東京）** | 日本から最も近く、遅延が小さい |
| インフラの作り方 | **Terraform** | 課題の指定。同じ構成を何度でも作り直せ、消し忘れも防げる |
| 自動デプロイ | **main へのマージで自動反映**（GitHub Actions） | 手作業の反映漏れを無くす（4章） |

### 1.2 構成図

```
        作業する PC（許可した IP のみ）
                       │ HTTP（80番）
                       ▼
 ┌─ AWS（東京リージョン）─────────────────────────────────┐
 │ ┌─ VPC 10.0.0.0/16 ─────────────────────────────────┐ │
 │ │  ┌─ パブリックサブネット（AZ-a）10.0.1.0/24 ────┐  │ │
 │ │  │   EC2 t3.micro / Amazon Linux 2023           │  │ │
 │ │  │    └ app コンテナ（Spring Boot ＋ 画面）      │  │ │
 │ │  └──────────────┬───────────────────────────────┘  │ │
 │ │                 │ 5432番（アプリの SG からのみ許可） │ │
 │ │  ┌─ プライベートサブネット（AZ-a）10.0.11.0/24 ─┐  │ │
 │ │  │   RDS db.t4g.micro / PostgreSQL 17           │  │ │
 │ │  └──────────────────────────────────────────────┘  │ │
 │ │  ┌─ プライベートサブネット（AZ-c）10.0.12.0/24 ─┐  │ │
 │ │  │   （RDS の要件を満たすための予備。空のまま）   │  │ │
 │ │  └──────────────────────────────────────────────┘  │ │
 │ └────────────────────────────────────────────────────┘ │
 │          ▲ docker pull                                 │
 │        ECR  ◀── GitHub Actions がビルドして push        │
 └────────────────────────────────────────────────────────┘
```

- **プライベートサブネットにはインターネットへの経路がありません。** RDS は外から直接たどり着けず、EC2 を経由しないと届きません
- RDS は冗長化しない設定でも「2つの AZ（別々のデータセンター）にまたがるサブネットの組」を要求するため、使わない2つ目のサブネットを用意しています

### 1.3 データベースに RDS を選んだ理由

| | EC2 上の PostgreSQL コンテナ | **RDS（採用）** |
|---|---|---|
| 追加費用 | $0 | 約 $21／月 |
| 自動バックアップ | なし | **あり**（特定時点に戻せる） |
| EC2 を作り直したら | データが消える | **データは残る** |
| メモリ | EC2 の 1GB をアプリと奪い合う | DB 専用 |

当初は費用を優先してコンテナ案で設計しましたが、次の理由で RDS に変更しました。

1. データが消える設計では、作り直しのたびに手動バックアップが必要で、1つ飛ばすとデータを失う
2. RDS を足しても総額は約 $27 で、クレジットの範囲に十分収まる（2章）
3. スクール教材の構成と揃い、実務で使う知識にも触れられる

### 1.4 画面をバックエンドに同梱した理由

| 案 | 費用 | 判定 |
|---|---|---|
| **A. バックエンドに同梱**（Spring Boot が画面も配る） | 追加 $0 | **採用** |
| B. S3 ＋ CloudFront | 月 $1 未満 | 見送り（配信経路が増え、IP 制限とも両立しにくい） |
| C. Amplify Hosting | 月 $1 程度 | 見送り（Terraform で管理する意義が薄い） |

**この選択で諦めたこと**

| 諦めたこと | 影響と対処 |
|---|---|
| HTTPS | 通信が暗号化されない。アクセス元を自分の IP に限定しているため許容する |
| セッション Cookie の `Secure` 属性 | HTTP では `Secure` 付きの Cookie が保存されずログインが維持できないため、EC2 の環境変数で `SESSION_COOKIE_SECURE=false` を渡している。**既定値は安全側（true）のまま**で、HTTPS にしたらこの環境変数を外すだけで戻る |
| 画面だけの更新 | 画面を直してもイメージ全体を作り直す（自動デプロイなので手間は変わらない） |

- 画面は URL を変えない作り（常に `/`）のため、**SPA フォールバック（どのパスでも `index.html` を返す設定）は入れていません。** 入れると `/api` の打ち間違いまで画面にすり替わり、エラー処理が崩れるためです
- 画面の CORS 設定は同梱構成では使われませんが、開発時の動きを変えないために残しています

### 1.5 安全のための設計

| 対象 | やっていること |
|---|---|
| アプリへの入口 | 80・443番は `allowed_app_cidr` に書いた IP だけに開く。未設定なら誰にも開かない |
| サーバーへのログイン | SSH（22番）は開けない。**SSM Session Manager**（鍵なしで AWS の権限だけで入れる仕組み）で接続する |
| データベース | プライベートサブネットに置き、外部公開なし。5432番は **アプリのセキュリティグループからのみ** 許可（IP ではなく役割で許可するので、EC2 を作り直しても設定が崩れない） |
| DB のパスワード | **パラメータストアに暗号化して保管**し、EC2 が起動時に取りに行く。起動スクリプトに直接書くとメタデータから読めてしまうため |
| EC2 の権限 | アクセスキーを置かず、IAM ロール（ECR の読み取りと SSM 接続のみ）を持たせる。メタデータは IMDSv2 を必須にしている |
| GitHub Actions の権限 | アクセスキーを預けず **OIDC**（GitHub が発行する一時的な身分証を AWS が確かめる方式）で認証。できるのは「このリポジトリへの push」と「`Project=taskboard` タグの EC2 へのデプロイ指示」だけ |
| 秘密情報の扱い | `terraform.tfvars`・`*.tfstate` は Git に入れない（`.gitignore` 済み）。`.dockerignore` で `infra/` を除外し、イメージにも入れない。**公開リポジトリのため、実際の IP アドレス・エンドポイントもドキュメントに書かない** |

### 1.6 （参考）本番運用ならどうするか

| 観点 | 今回 | 本番相当 |
|---|---|---|
| アプリの実行 | EC2 1台 | ECS Fargate ＋ ALB（複数台・自動復旧） |
| DB | RDS 単一 AZ、バックアップ保持1日 | RDS 複数 AZ、保持期間を長く取る |
| 公開範囲 | 自分の IP のみ | 全世界に公開し、WAF・レート制限で守る |
| HTTPS | なし | ACM（無料の証明書）＋ ALB / CloudFront |
| tfstate の置き場 | 手元のファイル | S3（バージョン管理＋ロック） |
| 人の認証 | IAM ユーザーのアクセスキー | IAM Identity Center（一時的な認証情報） |

---

## 2. 費用

金額は AWS の請求と同じ **USD** で記載します。

### 2.1 クレジットと無料プランの制限

このアカウント（2026-09-27 作成）は **新方式の無料プラン** で、無料枠ではなく **クレジットを消費しながら使う** 形です。

| 項目 | 内容 |
|---|---|
| 見込めるクレジット | 約 **$160**（登録時 $100 ＋ Budgets 設定・EC2 起動・RDS 作成の達成分 $20 × 3）。控えめに $140 で判断する |
| 有効期限 | **2027-03-27 頃**（作成から6か月）。使い切るか期限が来ると通常請求に切り替わる |
| 機能の制限 | RDS のバックアップ保持は **最大1日**、EC2 は **t2.micro が使えない**（t3.micro を採用。価格は t2 より安く、メモリは同じ 1GB） |

制限を外すには有料プランへのアップグレードが必要ですが、本プロジェクトでは制限内に収めています。

### 2.2 単価（東京リージョン）

| 項目 | 単価 | 課金される条件 |
|---|---|---|
| EC2 t3.micro | $0.0136／時 | 起動中のみ |
| RDS db.t4g.micro | $0.025／時 | 起動中のみ（停止は最大7日で自動再開） |
| EBS（EC2 のディスク）20GB | $1.92／月 | **存在する限り常に** |
| Elastic IP（固定 IP）1個 | $3.65／月 | **確保している限り常に** |
| RDS ストレージ 20GB | $2.76／月 | **存在する限り常に** |
| ECR | $0.10／GB・月 | 保管している限り |
| VPC・サブネット・セキュリティグループ・データ転送（100GB まで） | $0 | — |

**止めても約 $8.4／月（ストレージと IP）はかかります。「止めれば $0」ではなく「消せば $0」です。**

### 2.3 見積もり

| 使い方 | 月額 |
|---|---|
| 作業時だけ起動（月 80 時間ほど） | 約 $11.7 |
| 1週間つけっぱなし | 約 $15.2 |
| 参考：常時稼働 | 約 $37.8 |
| 使わない期間は削除 | $0 |

構築・開発（2か月）＋提出前1週間 ＋ 提出後に削除、で **総額約 $27**。クレジット $140 に対して5倍の余裕があります。
気にすべきは金額ではなく **「消し忘れ」と「期限」** です。

### 2.4 請求の見張り

| 設定 | 内容 |
|---|---|
| 予算アラート | 月 **$5**。実績の 80% と、予測の 100% で通知。**クレジットを費用に含める（既定）** ことで、クレジットが尽きて実課金が始まったときだけ鳴る |
| コスト異常検出 | 有効。普段と違う使われ方を検知する |

---

## 3. インフラ（Terraform）

### 3.1 ファイル構成

| ファイル | 役割 |
|---|---|
| `versions.tf` | Terraform と AWS プロバイダのバージョン固定 |
| `variables.tf` | 設定値の定義（型・説明・既定値・入力チェック） |
| `network.tf` | VPC・サブネット・経路・アプリ用セキュリティグループ |
| `iam.tf` | EC2 に持たせるロール（ECR 読み取り・SSM・パラメータ取得） |
| `rds.tf` | RDS・DB サブネットグループ・DB 用セキュリティグループ・パスワードの保管 |
| `ecr.tf` | イメージの保管庫。古いイメージを自動で削除する |
| `ec2.tf` | サーバー本体と Elastic IP |
| `user_data.sh` | EC2 の初回起動時の初期設定（スワップ 2GB・Docker・ログ上限・`.env`・`compose.yaml`・`deploy.sh`・自動起動） |
| `github_oidc.tf` | GitHub Actions 用の OIDC 設定と最小権限のロール |
| `outputs.tf` | 構築後に表示する値（URL・インスタンス ID・接続コマンドなど） |
| `terraform.tfvars` | 実際の設定値（**Git に入れない**）。ひな形は `terraform.tfvars.example` |

### 3.2 利用者が設定する値（`terraform.tfvars`）

| 変数 | 内容 |
|---|---|
| `db_password` | DB のパスワード（16文字以上） |
| `allowed_app_cidr` | アプリへのアクセスを許す IP。`["<自分のIP>/32"]` の形で書く（`/32` は「このアドレス1つだけ」） |
| `db_skip_final_snapshot` / `db_deletion_protection` | 既定は「消しやすさ優先」。大事なデータを入れるなら `false` / `true` に切り替える |

その他の値（インスタンスタイプ・CIDR・OIDC の照合に使う GitHub の数値 ID など）は `variables.tf` の既定値のまま使っています。

### 3.3 構築する

前提：AWS CLI（`aws configure` 済み）・Terraform・Session Manager Plugin・Docker Desktop を導入済みであること。

```powershell
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform plan
terraform -chdir=infra/terraform apply
```

- **`apply` の前に必ず `plan` を読む。** `-`（削除）や `-/+`（作り直し＝データが消える）が意図しない所に出ていたら実行しない
- `-auto-approve` は使わない。確認画面が課金事故を防ぐ最後の砦になる
- 所要時間は約10分（大半は RDS の作成）。EC2 は作成後さらに約1分半、初期設定が続く

### 3.4 構築後に確かめること

下から順に確認し、失敗したらそこで止まって原因を調べます。

| 段階 | 確認すること |
|---|---|
| ① ネットワーク | サブネットが3つ（パブリック1・プライベート2、プライベートは別々の AZ）。プライベート側の経路にインターネット（`0.0.0.0/0`）が **無い** |
| ② ファイアウォール | アプリ用 SG は 80・443番が自分の IP からのみで 22番なし。DB 用 SG は 5432番がアプリの SG からのみ |
| ③ サーバー | SSM で接続できる。`docker ps` が動く。スワップが 2GB ある |
| ④ データベース | EC2 から `psql` で接続できる。**手元の PC からは接続できない**（つながらないのが正しい） |
| ⑤ アプリ | `http://<IP>/actuator/health` が `{"status":"UP"}`。ブラウザでログイン画面が出る |

---

## 4. アプリのデプロイ

### 4.1 自動デプロイの流れ

`main` にマージされると、[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) が次を行います。

```
 main にマージ ─▶ GitHub Actions
                   1. 画面とサーバーを1つのイメージにビルド
                   2. ECR に push（latest と コミットID の2つのタグ）
                   3. タグ Project=taskboard の起動中 EC2 を探す（1台に定まらなければ止める）
                   4. SSM で EC2 の /opt/taskboard/deploy.sh を実行
                      （ECR ログイン → pull → 起動 → 古いイメージの掃除 → 死活確認）
                   5. 死活確認が通らなければワークフローを失敗させる
```

| 決めたこと | 理由 |
|---|---|
| 動くのは `backend/`・`frontend/`・`Dockerfile` などが変わったときだけ | ドキュメントだけの変更で無駄にデプロイしない |
| 発火条件は `push`（main）。**`pull_request` にしない** | 公開リポジトリでは、他人の PR のコードが AWS の権限付きで動いてしまう |
| デプロイ先はタグで探す（インスタンス ID を固定しない） | `user_data.sh` を変えると EC2 が作り直され ID が変わるため |
| 入れ替え手順は EC2 側の `deploy.sh` に置く | 手動で入れ替えるときも同じ手順を使える |
| `docker build` に `--provenance=false --sbom=false` を付ける | 付けないと ECR の脆弱性スキャンがイメージを読めず、検査されない |
| **EC2 が止まっているとデプロイは失敗する** | デプロイ先が見つからないため。起動してから再実行する（GitHub の Actions 画面で「Re-run」） |

### 4.2 手動でデプロイする・前の版に戻す

自動デプロイが使えないときは、手元でビルドして push し、EC2 で `deploy.sh` を実行します。

```powershell
$ecrUrl = (terraform -chdir=infra/terraform output -raw ecr_repository_url)
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin $ecrUrl.Split("/")[0]
docker build --provenance=false --sbom=false --platform linux/amd64 -t "${ecrUrl}:latest" .
docker push "${ecrUrl}:latest"

aws ssm send-command --instance-ids (terraform -chdir=infra/terraform output -raw instance_id) `
  --document-name "AWS-RunShellScript" --parameters 'commands=["bash /opt/taskboard/deploy.sh"]'
```

不具合が出たときは、コミットごとのタグで前の版に戻せます（EC2 の中で実行）。

```bash
sudo sed -i "s|taskboard-backend:latest|taskboard-backend:<戻したいコミットID>|" /opt/taskboard/.env
cd /opt/taskboard && sudo docker compose up -d
```

### 4.3 OIDC の設定で注意すること

GitHub が AWS に送る識別子は、名前だけでなく **数値 ID を含む形式** です。

```
よく見る形:   repo:major182/TaskManegementTool:ref:refs/heads/main
実際に届く形: repo:major182@<オーナーID>/TaskManegementTool@<リポジトリID>:ref:refs/heads/main
```

名前だけで条件を書くと `Not authorized to perform sts:AssumeRoleWithWebIdentity` で失敗します。
ID は `gh api repos/major182/TaskManegementTool --jq '.owner.id, .id'` で調べられます（`variables.tf` の `github_owner_id`・`github_repository_id` に設定済み）。
ID は名前と違って変わらないため、名前を第三者に取られても認証されない点でも安全です。

原因が分からないときは、CloudTrail の `AssumeRoleWithWebIdentity` イベントで実際に届いた識別子を確認します。

ロールの ARN は GitHub の Secret `AWS_ROLE_ARN` に登録しています。

```powershell
gh secret set AWS_ROLE_ARN --body (terraform -chdir=infra/terraform output -raw github_actions_role_arn)
```

---

## 5. 日々の運用

### 5.1 よく使うコマンド

```powershell
terraform -chdir=infra/terraform output      # URL・IP・インスタンス ID を表示
terraform -chdir=infra/terraform plan        # コードと実物の差分を見る（何も変更しない）

# サーバーに入る
aws ssm start-session --target (terraform -chdir=infra/terraform output -raw instance_id) --region ap-northeast-1

# 今月の請求額
aws ce get-cost-and-usage --time-period Start=<月初>,End=<今日> --granularity MONTHLY --metrics UnblendedCost --output table
```

サーバーの中で：

```bash
cd /opt/taskboard
sudo docker compose ps             # コンテナの状態
sudo docker compose logs -f app    # アプリのログ
sudo docker compose restart app    # アプリの再起動
```

### 5.2 アクセス元の IP が変わったとき

家庭の回線はルーターの再起動などで IP が変わります。**昨日まで開けたのに開けない場合、まずこれを疑います。**
テザリング・外出先の Wi-Fi・スマホの回線からつながらないのも設定どおりの動作です。

```powershell
(Invoke-RestMethod https://checkip.amazonaws.com).Trim()   # 今の IP を調べる
# terraform.tfvars の allowed_app_cidr を書き換えてから
terraform -chdir=infra/terraform apply                      # SG のルールだけが入れ替わる
```

デモで他の人に見せるときは、一時的に `["0.0.0.0/0"]` にして apply し、終わったら戻します。

### 5.3 一晩〜数日、作業を空けるとき（止める）

```powershell
# 止める（RDS も止めないと、費用の大きいほうが動き続ける）
aws ec2 stop-instances --instance-ids (terraform -chdir=infra/terraform output -raw instance_id)
aws rds stop-db-instance --db-instance-identifier taskboard-db

# 再開する（RDS を先に。EC2 が先だと DB につながらずアプリが再起動を繰り返す）
aws rds start-db-instance --db-instance-identifier taskboard-db
aws ec2 start-instances --instance-ids (terraform -chdir=infra/terraform output -raw instance_id)
curl.exe http://(terraform -chdir=infra/terraform output -raw app_public_ip)/actuator/health
```

- アプリは自動で立ち上がり、**IP も変わりません**（Elastic IP のため）
- 一晩（16時間）の費用：両方動かしたまま 約 $0.62 ／ 両方停止 約 $0.18

混同しやすい3つの期限：

| 何の話か | 期限 | 意味 |
|---|---|---|
| データの保存 | **期限なし** | 停止中も消えない。消えるのは削除（6章）したときだけ |
| RDS を停止していられる期間 | 最大7日 | 超えると AWS が自動で起動する（課金が再開するだけ） |
| 自動バックアップの保持 | 1日 | 過去のある時点に戻せる範囲。停止中はバックアップが取られない |

### 5.4 運用パターン

| パターン | 操作 | 月額 | データ | 使う場面 |
|---|---|---|---|---|
| ① 起動したまま | 何もしない | 約 $38 | 残る | デモ・提出直前 |
| ② 止める | 5.3 | 約 $8 ＋ 使った分 | 残る | その日の作業を終えるとき |
| ③ 全部削除 | 6章 | **$0** | **消える** | 1週間以上触らないとき |

削除しても `terraform apply` で同じ構成を約15分で作り直せます（IP は変わり、DB は空になる）。
イメージが ECR にあれば、EC2 は起動時に自動で取り込みます。

**「来週また触る」なら RDS だけ残す**方法もあります（月約 $21、データは残る）。

```powershell
terraform -chdir=infra/terraform destroy -target=aws_instance.app -target=aws_eip.app
```

### 5.5 DB のバックアップ

RDS が毎日自動でバックアップを取っています（日本時間 03:00〜04:00、保持1日）。
復元は「特定時点への復元」で **新しいインスタンスとして** 作られます。

**削除（6章）すると自動バックアップも消えます。** 残したいデータがあるときは、先に EC2 経由で書き出します
（RDS は外部から届かないため、手元の PC から直接は取れません）。

```bash
# EC2 の中で
sudo dnf install -y postgresql17
source /opt/taskboard/.env
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" > /tmp/backup-$(date +%Y%m%d).sql

# 戻すとき
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" < backup.sql
```

---

## 6. 後片付け（課題が終わったら必ず実行する）

```powershell
terraform -chdir=infra/terraform destroy
```

削除後、消し残しがないか確認します（残っていると課金が続く）。

```powershell
aws ec2 describe-instances --query "Reservations[].Instances[?State.Name!='terminated'].[InstanceId,State.Name]" --output table
aws ec2 describe-addresses --output table     # Elastic IP
aws ec2 describe-volumes --output table       # EBS
aws ecr describe-repositories --output table
```

数日後に請求ダッシュボードで $0 に近いことも確認します。

---

## 7. つまずきポイント早見表

| 症状 | 原因 | 対処 |
|---|---|---|
| ブラウザで開けない・昨日まで開けたのに開けない | アクセス元の IP が変わった（最も多い） | 5.2 |
| ブラウザで開けない（IP は正しい） | コンテナが起動していない・起動中 | `docker compose ps`、数分待つ |
| アプリが DB につながらない | RDS が停止中・起動中 | RDS が `available` か確認。起動順は RDS が先（5.3） |
| 自動デプロイが「デプロイ先が1台に定まりません」で失敗 | EC2 が停止している | EC2 を起動してワークフローを再実行 |
| 自動デプロイが OIDC の認証で失敗 | 信頼条件の識別子が合っていない | 4.3 |
| `FreeTierRestrictionError` / `not eligible for Free Tier` | 無料プランの制限（2.1） | 値を制限内にする |
| `plan` に `-/+` が出た | リソースが作り直される＝データが消える | apply せず原因を調べる。`user_data.sh` の変更が典型 |
| EC2 作成直後に `docker: command not found` | 初期設定がまだ実行中 | `test -f /var/lib/cloud/instance/boot-finished` が通るまで待つ |
| SSM で接続できない | エージェントの登録待ち | 3分待つ。`aws ssm describe-instance-information` で確認 |
| アプリが起動直後に落ちる | メモリ不足 | `free -h` でスワップを確認 |
| 手元の PC から DB につなげない | 設計どおり | EC2 を経由する（5.5） |
| ECR の push で `denied` | ECR へのログインが失効（12時間） | `aws ecr get-login-password ...` をやり直す |
| `destroy` で RDS が消せない | `db_deletion_protection = true` | `false` にして apply してから destroy |
| destroy 後も課金される | Elastic IP・EBS が残っている | 6章の確認コマンドで探して削除 |
| コンソールにリソースが表示されない | 見ているリージョンが違う | 画面右上で「東京」を選ぶ |

---

## 8. 用語集

| 用語 | 意味 |
|---|---|
| IaC / Terraform | インフラをコードで管理すること／そのための道具 |
| tfstate | Terraform が「何を作ったか」を記録するファイル。失うと管理できなくなる |
| VPC / サブネット | 自分専用の仮想ネットワーク／それを区切った小部屋 |
| パブリック／プライベートサブネット | インターネットへの経路を持つ／持たないサブネット |
| AZ | アベイラビリティゾーン。リージョン内の独立したデータセンター |
| セキュリティグループ（SG） | 仮想のファイアウォール。書いた通信だけを通す |
| CIDR | `10.0.0.0/16` のような IP の範囲の書き方。`/32` は1アドレス、`/0` は全世界 |
| EC2 / EBS | 仮想サーバー／そのディスク |
| Elastic IP | 固定のグローバル IP アドレス |
| RDS | AWS が運用するデータベース。バックアップや更新を代行する |
| ECR | コンテナイメージの保管庫 |
| IAM ロール | サービスに持たせる権限の束 |
| OIDC | 外部サービスと信頼関係を結ぶ認証方式。鍵の保存が不要 |
| SSM Session Manager | 鍵なしでサーバーに接続できる仕組み |
| パラメータストア | 設定値や秘密情報を暗号化して保管する AWS のサービス |
| user_data | EC2 の初回起動時に1回だけ実行されるスクリプト |

---

## 改訂履歴

| 版数 | 日付 | 内容 | 作成者 |
|---|---|---|---|
| 2.0 | 2026-09-30 | 製品説明の資料として全面的に整理。Terraform・`user_data.sh`・ワークフローなどのソース掲載、初学者向けの一般解説、進捗状況、アカウント設定の画面操作、構築・デプロイ・品質チェックの作業記録を削除し、決定事項・構成・費用・運用手順・トラブル対応に絞った。ソースの中身は実ファイルを正とする | |
| 1.5 | 2026-09-29 | 10.3 を「一晩〜数日空けるとき」の手順に書き換え（RDS も止める手順、起動の順番、費用の目安、3つの期限の整理） | |
| 1.4 | 2026-09-29 | 自動デプロイの OIDC 認証の失敗原因（識別子が数値 ID を含む形式）と、CloudTrail での調べ方を追記 | |
| 1.3 | 2026-09-29 | 自動デプロイ（CD）を導入。デプロイ先をタグで探す方式、`deploy.sh` への手順集約、発火条件の注意を明記 | |
| 1.2 | 2026-09-29 | 品質チェックの記録を新設。公開リポジトリに実際の IP アドレスを書かない方針に変更 | |
| 1.1 | 2026-09-29 | 品質チェックの結果を反映（DB パスワードのパラメータストア化、Docker のログ上限、ヘルスチェック追加など） | |
| 1.0 | 2026-09-29 | アプリのデプロイを完了。画面の同梱、Cookie 設定、SPA フォールバック不要の判断を反映 | |
| 0.9 | 2026-09-29 | 初回の構築を実施。無料プランの制限により t3.micro・バックアップ保持1日に変更 | |
| 0.8 | 2026-09-29 | 構築後の確認を段階に分ける方針を追加。画面の配信を「バックエンドに同梱」に決定 | |
| 0.7 | 2026-09-29 | データベースを EC2 上のコンテナから RDS に変更し、プライベートサブネットを新設 | |
| 0.6 | 2026-09-29 | 公開範囲を「作業する PC の IP のみ」に変更 | |
| 0.5 | 2026-09-29 | アカウント設定・CLI・Terraform の準備完了を反映 | |
| 0.4 | 2026-09-27 | 必要なツールの導入手順を追加 | |
| 0.3 | 2026-09-27 | クレジットの見込み額と、常時稼働しない前提の費用試算に修正 | |
| 0.2 | 2026-09-27 | アカウントの実状（新方式の無料プラン）に合わせて修正 | |
| 0.1 | 2026-09-27 | 初版作成 | |
