# サーバー本体。

# ---------- AMI（OS イメージ）を取得する ----------
# AMI の ID はリージョンごとに違い、更新もされる。
# ID を直接書かず、AWS が公開しているパラメータから「最新の Amazon Linux 2023」を引いてくる。
# こうしておくと、コードを書き換えずに常に最新の OS を使える
data "aws_ssm_parameter" "al2023_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023_ami.value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  # 初回起動時に実行するスクリプト。user_data.sh のテンプレートに値を埋め込む
  user_data = templatefile("${path.module}/user_data.sh", {
    db_password  = var.db_password
    aws_region   = var.aws_region
    ecr_registry = split("/", aws_ecr_repository.backend.repository_url)[0]
    ecr_image    = "${aws_ecr_repository.backend.repository_url}:latest"
  })

  # user_data を変更したらインスタンスを作り直す。
  # user_data は初回起動時にしか走らないため、これが無いと変更が反映されない。
  # ただし作り直すと DB のデータは消えるので、plan に -/+ が出たら必ず内容を確認すること
  user_data_replace_on_change = true

  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3" # 最新世代。gp2 より安く速い
    encrypted   = true  # ディスクを暗号化する。無料。付けない理由がない
  }

  # インスタンスメタデータへのアクセスを IMDSv2 に限定する。
  # 古い IMDSv1 は、アプリの脆弱性（SSRF）経由で認証情報を盗まれる経路になりうる
  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  tags = {
    Name = "${var.project_name}-app"
  }
}

# ---------- Elastic IP（固定のグローバル IP） ----------
# これが無いと、EC2 を停止・起動するたびに IP アドレスが変わってしまう。
#
# 注意：Elastic IP は「確保しているだけで課金」される（$0.005／時 ＝ 約 $3.65／月）。
# EC2 を停止しても止まらないため、長く使わないときは terraform destroy で消すこと
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-eip"
  }

  # インターネットゲートウェイが出来上がってから作る
  depends_on = [aws_internet_gateway.main]
}
