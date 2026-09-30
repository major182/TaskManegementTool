# 外から渡す設定値の定義。
# ここには「型」「説明」「既定値」だけを書き、実際の値は terraform.tfvars に書く。
# こうしておくと、値を変えるためにコード本体を触らずに済む。

variable "project_name" {
  description = "リソース名の先頭に付ける、このプロジェクトの識別子"
  type        = string
  default     = "taskboard"
}

variable "aws_region" {
  description = "リソースを作るリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "vpc_cidr" {
  description = "VPC のアドレス範囲。他のネットワークと重ならなければ何でもよい"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "パブリックサブネットのアドレス範囲。VPC の範囲に収まっている必要がある"
  type        = string
  default     = "10.0.1.0/24"
}

variable "private_subnet_cidrs" {
  description = <<-EOT
    データベースを置くプライベートサブネットのアドレス範囲を2つ。
    RDS は2つ以上の AZ にまたがるサブネットの組を要求するため、単一 AZ 構成でも2つ必要になる。
  EOT
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]

  validation {
    condition     = length(var.private_subnet_cidrs) == 2
    error_message = "private_subnet_cidrs はちょうど2つ指定してください（RDS の要件）。"
  }
}

variable "instance_type" {
  description = <<-EOT
    EC2 のサイズ。メモリが 1GB しかないため、user_data.sh でスワップ領域を 2GB 追加している。

    t2.micro ではなく t3.micro にしているのは、AWS の無料プラン（新方式のクレジット付与型）が
    対象のインスタンスタイプを限定しており、t2.micro が含まれていないため。
    t2.micro を指定すると次のエラーで作成に失敗する。

      InvalidParameterCombination: The specified instance type is not eligible for Free Tier.

    使える種類は次のコマンドで確認できる。
      aws ec2 describe-instance-types --filters "Name=free-tier-eligible,Values=true"

    t3.micro は t2.micro より安く（$0.0136/時 対 $0.0152/時）、メモリは同じ 1GB。
    メモリが足りない場合は t3.small（2GB、$0.0272/時）に変更できる。
  EOT
  type        = string
  default     = "t3.micro"
}

variable "root_volume_size" {
  description = "EC2 のディスクサイズ（GB）。gp3 は $0.096/GB・月"
  type        = number
  default     = 20
}

variable "db_instance_class" {
  description = "RDS のサイズ。db.t4g.micro は $0.025／時 ＝ 約 $18.25／月"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = <<-EOT
    PostgreSQL のバージョン。開発環境（compose.yaml）とテスト（Testcontainers）を
    17 系で揃えているため、本番も 17 系にする。
  EOT
  type        = string
  default     = "17.11"
}

variable "db_allocated_storage" {
  description = "RDS のストレージ（GB）。gp3 は $0.138／GB・月。自動バックアップは同量まで無料"
  type        = number
  default     = 20
}

variable "db_backup_retention_days" {
  description = <<-EOT
    自動バックアップの保持日数。0 にすると自動バックアップが無効になるため 1 以上にする。

    既定を 1 にしているのは、AWS の無料プラン（新方式のクレジット付与型）に
    保持日数の上限があるため。7 を指定すると次のエラーで作成に失敗する。

      FreeTierRestrictionError: The specified backup retention period
      exceeds the maximum available to free tier customers.

    有料プランにアップグレードすれば、より長い保持日数を指定できる。
  EOT
  type        = number
  default     = 1

  validation {
    condition     = var.db_backup_retention_days >= 1
    error_message = "自動バックアップを無効にしないでください（1 以上）。"
  }
}

variable "db_skip_final_snapshot" {
  description = <<-EOT
    terraform destroy のときに最終スナップショットを取らずに削除するか。
    学習用として、すぐ消せるよう既定は true。
    大事なデータを入れたら false にすること。
  EOT
  type        = bool
  default     = true
}

variable "db_deletion_protection" {
  description = "true にすると terraform destroy でデータベースを消せなくなる。学習用のため既定は false"
  type        = bool
  default     = false
}

variable "db_password" {
  description = "PostgreSQL の taskboard ユーザーのパスワード"
  type        = string

  # sensitive = true にすると、plan / apply の出力でこの値が伏せ字（sensitive value）になる。
  # ログやスクリーンショットからの漏洩を防ぐため、秘密の値には必ず付ける
  sensitive = true

  validation {
    condition     = length(var.db_password) >= 16
    error_message = "db_password は16文字以上にしてください。"
  }
}

variable "allowed_app_cidr" {
  description = <<-EOT
    アプリ（80番・443番）へのアクセスを許可する送信元のリスト。
    スクール課題のため、インターネット全体には公開せず、作業する PC からだけ届くようにする。

    既定は空リスト。空のままだと 80番・443番は誰にも開かない（安全側に倒している）。
    値は terraform.tfvars に書く。tfvars は .gitignore で除外されているため、
    自分のグローバル IP アドレスが GitHub に載ることはない。

    書き方の例：["203.0.113.10/32"]
      /32 は「この1つのアドレスだけ」という意味。

    ★ 契約している回線のグローバル IP は、多くの場合ときどき変わる。
      つながらなくなったら、まず現在の IP を調べ直して terraform apply をやり直すこと
      （調べ方は docs/07_deployment.md 5.2）。
  EOT
  type        = list(string)
  default     = []

  validation {
    # "/" が入っていない（= /32 などを書き忘れた）指定をはじく。
    # 例："203.0.113.10" と書くと AWS 側でエラーになるため、ここで先に気づけるようにする
    condition     = alltrue([for c in var.allowed_app_cidr : can(regex("/", c))])
    error_message = "allowed_app_cidr は CIDR 表記で書いてください（例：203.0.113.10/32）。"
  }
}

variable "allowed_ssh_cidr" {
  description = <<-EOT
    SSH（22番ポート）を許可する送信元。
    既定は空リスト＝誰にも開けない。
    EC2 への接続は SSM Session Manager を使うため、22番を開ける必要がない。
  EOT
  type        = list(string)
  default     = []
}

variable "github_repository" {
  description = "GitHub Actions から AWS を操作させるリポジトリ（オーナー名/リポジトリ名）。表示用"
  type        = string
  default     = "major182/TaskManegementTool"
}

variable "github_owner_id" {
  description = <<-EOT
    GitHub アカウントの数値 ID。

    GitHub は OIDC の識別子に、名前ではなく数値 ID を含めて送ってくる。
      repo:<オーナー名>@<オーナーID>/<リポジトリ名>@<リポジトリID>:ref:refs/heads/main

    名前で照合すると一致せず、認証が拒否される（#69）。
    また ID で照合するほうが安全でもある。名前は変更できるため、
    名前だけで許可していると、変更後に同じ名前を第三者が取得して
    なりすませる余地が残る。ID は変わらないのでその心配がない。

    確認方法：
      gh api repos/<オーナー名>/<リポジトリ名> --jq '.owner.id'
  EOT
  type        = string
  default     = "329081291"
}

variable "github_repository_id" {
  description = <<-EOT
    GitHub リポジトリの数値 ID。理由は github_owner_id を参照。

    確認方法：
      gh api repos/<オーナー名>/<リポジトリ名> --jq '.id'
  EOT
  type        = string
  default     = "1371042617"
}
