# Terraform 本体と、使用するプロバイダ（AWS を操作するための部品）のバージョンを固定する。
#
# バージョンを固定する理由：
#   プロバイダが勝手に新しくなると、同じコードでも挙動が変わることがある。
#   build.gradle.kts で依存ライブラリのバージョンを書くのと同じ考え方。

terraform {
  # 1.9 以上であれば動く、という意味
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # "~> 6.0" は「6.x 系なら上げてよいが、7.0 にはしない」という意味
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  # すべてのリソースに自動で付けるタグ。
  # タグを付けておくと「どのプロジェクトのリソースか」が請求画面で分かり、消し忘れにも気づける
  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "Terraform"
    }
  }
}
