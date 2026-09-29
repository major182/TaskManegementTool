# EC2 に持たせる「社員証」を作る。
#
# なぜ必要か：
#   EC2 は ECR からイメージを取得する必要があり、そのためには AWS の認証が要る。
#   しかし EC2 の中にアクセスキーを置くのは危険（サーバーが乗っ取られたら鍵ごと盗まれる）。
#   代わりにロールを EC2 に付けると、AWS が自動で短時間だけ有効な認証情報を渡してくれる。
#   これが IAM ロールを使う理由。

# ---------- 信頼ポリシー：このロールを誰が使えるか ----------
data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"] # EC2 サービスだけがこのロールになれる
    }
  }
}

resource "aws_iam_role" "ec2" {
  name               = "${var.project_name}-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

# ---------- ECR からイメージを読む権限（AWS が用意済みのポリシーを使う） ----------
resource "aws_iam_role_policy_attachment" "ecr_read" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# ---------- SSM Session Manager で接続するための権限 ----------
# これがあると、SSH 鍵も 22番ポートも無しで EC2 のシェルに入れる。
# 鍵の管理が不要になり、踏み台サーバーも要らない。現在の標準的なやり方
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# ---------- インスタンスプロファイル ----------
# IAM ロールを EC2 に取り付けるための「ホルダー」。EC2 に限り、この一段が必要になる
resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ---------- パラメータストアからパスワードを読む権限 ----------
# 読めるのは、このプロジェクトのパラメータ1つだけに限定する。
# SecureString は暗号化されているため、復号（kms:Decrypt）の権限もあわせて必要になる
data "aws_iam_policy_document" "read_db_password" {
  statement {
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.db_password.arn]
  }

  statement {
    actions = ["kms:Decrypt"]
    # パラメータストアが既定で使う、AWS 管理の鍵
    resources = ["arn:aws:kms:${var.aws_region}:${data.aws_caller_identity.current.account_id}:alias/aws/ssm"]
  }
}

resource "aws_iam_role_policy" "read_db_password" {
  name   = "${var.project_name}-read-db-password"
  role   = aws_iam_role.ec2.id
  policy = data.aws_iam_policy_document.read_db_password.json
}

# 自分のアカウント ID を知るために使う
data "aws_caller_identity" "current" {}
