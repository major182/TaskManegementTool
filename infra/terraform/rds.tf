# データベース（RDS for PostgreSQL）。
#
# EC2 の中でコンテナとして動かす案と比べ、月 $21 ほど高くなるが、次の利点がある。
#   - 自動バックアップが取られ、特定時点に戻せる（EC2 上のコンテナには無い）
#   - EC2 を作り直したり destroy したりしても、データが消えない
#   - メモリを EC2 と奪い合わない（EC2 は t3.micro でメモリが 1GB しかない）
# スクール教材の構成に合わせるという意図もある（docs/02_tech-stack.md 3.4）。

# ---------- DB サブネットグループ ----------
# RDS は「2つ以上のアベイラビリティゾーンにまたがるサブネットの組」を必ず要求する。
# 単一 AZ（multi_az = false）で作る場合でも同じ。
# AWS が後から別の AZ へ移せるように、置き場所の候補を確保しておく仕組みのため。
#
# network.tf の aws_subnet.private がその2つにあたる。
# 片方の AZ には実際には何も置かれないが、これが無いと RDS は作成できない
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = [for s in aws_subnet.private : s.id]

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

# ---------- DB 用のセキュリティグループ ----------
resource "aws_security_group" "db" {
  name        = "${var.project_name}-db-sg"
  description = "Database: allow PostgreSQL from the application server only"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-db-sg"
  }
}

# インバウンド：5432番を「アプリのセキュリティグループからのみ」許可する。
#
# IP アドレスではなくセキュリティグループを指定しているのが要点。
# EC2 を作り直して IP が変わっても、このルールは直さなくてよい。
# 「あのサーバーだけ」ではなく「アプリの役割を持つものだけ」という許可の仕方になる
resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from the application server"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

# アウトバウンドは1つも作らない。
# RDS から外部へ通信する必要がないため、出口を開けない

# ---------- RDS インスタンス ----------
resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-db"

  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  db_name  = "taskboard"
  username = "taskboard"
  password = var.db_password
  port     = 5432

  # ストレージ。gp3 は gp2 と同額（$0.138／GB・月）で性能が上のため gp3 を選ぶ
  allocated_storage = var.db_allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  # インターネットから直接つながらないようにする。
  # プライベートサブネットに置いているので二重の防御になる
  publicly_accessible = false

  # 冗長化しない（学習用のため）。有効にすると料金が2倍になる
  multi_az = false

  # 自動バックアップ。保持日数を1以上にすると有効になる。
  # ストレージと同量までは無料。RDS を選ぶ最大の利点なので必ず有効にする
  backup_retention_period = var.db_backup_retention_days
  backup_window           = "18:00-19:00" # UTC。日本時間の 03:00-04:00
  maintenance_window      = "sun:19:00-sun:20:00"

  # マイナーバージョンの自動更新。脆弱性の修正が自動で当たる
  auto_minor_version_upgrade = true

  # 削除時に最終スナップショットを取るかどうか。
  # 学習用として、terraform destroy をすぐ実行できるよう既定では取らない。
  # 本番では必ず false（＝スナップショットを取る）にする
  skip_final_snapshot = var.db_skip_final_snapshot
  final_snapshot_identifier = (
    var.db_skip_final_snapshot ? null : "${var.project_name}-db-final-${formatdate("YYYYMMDDhhmmss", timestamp())}"
  )

  # 誤って terraform destroy でデータベースを消すのを防ぐ仕組み。
  # 学習用では destroy できないと困るため既定は false
  deletion_protection = var.db_deletion_protection

  tags = {
    Name = "${var.project_name}-db"
  }

  lifecycle {
    # final_snapshot_identifier に timestamp() を使っているため、
    # 何もしていなくても毎回差分が出てしまう。それを無視する
    ignore_changes = [final_snapshot_identifier]
  }
}

# ---------- パスワードの受け渡し ----------
# EC2 にパスワードを渡す方法として、起動スクリプト（user_data）に直接書く手もあるが、
# user_data は次のコマンドで誰でも読み出せてしまう。
#
#   aws ec2 describe-instance-attribute --instance-id <ID> --attribute userData
#
# ec2:DescribeInstanceAttribute の権限を持つ人に、そのままパスワードが渡ることになる。
# そこでパラメータストアに暗号化して預け、EC2 は起動時に自分の権限で取りに行く形にする。
# 標準のパラメータストアは無料で使える。
resource "aws_ssm_parameter" "db_password" {
  name = "/${var.project_name}/db/password"
  # SecureString は AWS が管理する鍵で暗号化して保存する形式
  type        = "SecureString"
  value       = var.db_password
  description = "RDS の taskboard ユーザーのパスワード。EC2 が起動時に取得する"

  tags = {
    Name = "${var.project_name}-db-password"
  }
}
