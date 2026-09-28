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

variable "instance_type" {
  description = <<-EOT
    EC2 のサイズ。t2.micro はメモリが 1GB しかないため、
    user_data.sh でスワップ領域を 2GB 追加している（JVM と PostgreSQL を同居させるため）。
  EOT
  type        = string
  default     = "t2.micro"
}

variable "root_volume_size" {
  description = "EC2 のディスクサイズ（GB）。gp3 は $0.096/GB・月"
  type        = number
  default     = 20
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
  description = "GitHub Actions から ECR へ push させるリポジトリ（オーナー名/リポジトリ名）"
  type        = string
  default     = "major182/TaskManegementTool"
}
