# GitHub Actions から、鍵を預けずに AWS を操作できるようにする設定。
#
# 仕組み：
#   GitHub Actions は実行のたびに「私は major182/TaskManegementTool の実行です」という
#   署名付きの身分証（OIDC トークン）を発行できる。
#   AWS 側に「その身分証を持つ者にはこのロールを使わせる」と登録しておけば、
#   永続的なアクセスキーを GitHub に保存せずに済む。
#
#   アクセスキーを GitHub Secrets に置く方式と比べ、鍵の流出リスクが無いぶん安全。

# ---------- GitHub を信頼できる発行元として登録する ----------
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  # 証明書の拇印。AWS 側で検証されるため、現在は値の正確さに依存しないが、指定は必要
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# ---------- どの条件のときにロールを使わせるか ----------
data "aws_iam_policy_document" "github_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # ★重要★ このリポジトリからの実行だけに限定する。
    # ここを緩めると、他人のリポジトリから自分の AWS を操作できてしまう
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:*"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${var.project_name}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_assume_role.json
}

# ---------- 与える権限：ECR への push だけ（最小権限） ----------
# 人が使う IAM ユーザーには Administrator を付けたが、
# 自動化に渡す権限は必要最小限にする。この使い分けが重要
data "aws_iam_policy_document" "ecr_push" {
  statement {
    # ログイン用トークンの取得。リソースを限定できない API のため "*" になる
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:BatchGetImage",
    ]
    # このリポジトリにだけ push できる
    resources = [aws_ecr_repository.backend.arn]
  }
}

resource "aws_iam_role_policy" "github_ecr_push" {
  name   = "${var.project_name}-ecr-push"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.ecr_push.json
}
