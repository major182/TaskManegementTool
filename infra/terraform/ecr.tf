# コンテナイメージの保管庫。自分専用の Docker Hub と考えればよい。
# GitHub Actions がここに push し、EC2 がここから pull する。

resource "aws_ecr_repository" "backend" {
  name = "${var.project_name}-backend"

  # push 時に脆弱性スキャンを自動実行する（無料）
  image_scanning_configuration {
    scan_on_push = true
  }

  # 同じタグで上書き push できるようにする（学習用のため）。
  # 本番では IMMUTABLE にして「一度作ったイメージは書き換えられない」ようにする
  image_tag_mutability = "MUTABLE"

  # terraform destroy のとき、中にイメージが残っていても削除できるようにする。
  # これが false だと「リポジトリが空でない」というエラーで destroy が止まる
  force_delete = true
}

# ---------- ライフサイクルポリシー ----------
# 古いイメージを自動で消す。
# ECR は保管している量に応じて課金される（$0.10／GB・月）。
# Spring Boot のイメージは1つ約 300MB あるため、push のたびに溜めると保管量が膨らむ。
# 学習用途では最新の数件だけあれば十分なので、自動で削除させる
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the latest 3 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 3
        }
        action = { type = "expire" }
      }
    ]
  })
}
