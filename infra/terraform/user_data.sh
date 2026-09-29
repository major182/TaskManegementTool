#!/bin/bash
# EC2 の初回起動時に1回だけ root 権限で実行される初期設定スクリプト。
# 「買ってきた PC の初期セットアップ」にあたる。
# 実行ログは EC2 内の /var/log/cloud-init-output.log に残る。うまく動かないときはここを見る。
#
# 注意：このファイルは Terraform の templatefile() で読み込まれてから EC2 に渡される。
# そのため、ドル記号と波かっこの書き方に2通りの意味がある。
#   ドル1つ  … Terraform が値を埋め込む（例: db_password, aws_region）
#   ドル2つ  … ドルが1つに減って出力され、Docker Compose やシェルが解釈する
# この違いは、コメント行の中であっても同じように働く（コメントだから安全、ではない）。

set -euxo pipefail

# ---------- 1. スワップ領域を作る ----------
# t2.micro はメモリが 1GB しかない。
# データベースは RDS に分けたが、JVM とビルドツールだけでも足りなくなることがあり、
# メモリ不足になると OOM Killer にプロセスを殺される。
# ディスクの一部をメモリの代わりに使うスワップを 2GB 用意して余裕を持たせる
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- 2. Docker を入れて起動する ----------
dnf update -y
dnf install -y docker

# ログを放っておくと際限なく増え、20GB のディスクが埋まって docker pull が失敗する。
# 1ファイル 10MB × 3世代（最大 30MB）で古いものから捨てる設定を、起動前に入れておく
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'DAEMONFILE'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
DAEMONFILE

systemctl enable --now docker

# ec2-user が sudo なしで docker を使えるようにする
usermod -aG docker ec2-user

# ---------- 3. Docker Compose プラグインを入れる ----------
# Amazon Linux 2023 のリポジトリには compose プラグインが無いため、手動で配置する
mkdir -p /usr/local/lib/docker/cli-plugins
curl -sSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# ---------- 4. アプリの置き場と設定ファイルを作る ----------
mkdir -p /opt/taskboard

# パスワードはパラメータストアから取りに行く。
# 起動スクリプトに直接書くと、describe-instance-attribute で誰でも読めてしまうため
# （理由は rds.tf のコメント）。ここは EC2 に付けた権限（iam.tf）で取得できる
DB_PASSWORD_VALUE=$(aws ssm get-parameter   --name "${db_password_parameter}"   --with-decryption   --region ${aws_region}   --query "Parameter.Value"   --output text)

# 環境変数ファイル。compose.yaml から読まれる。
# 600 にして、root 以外からは読めないようにする
cat > /opt/taskboard/.env <<ENVFILE
# 接続先の部品。psql で直接つなぐときにも使うため個別に持っておく
DB_HOST=${db_host}
DB_PORT=${db_port}
DB_NAME=${db_name}

# ここから下はアプリ（application.yml）がそのまま読む名前に合わせている
DB_URL=jdbc:postgresql://${db_host}:${db_port}/${db_name}
DB_USERNAME=${db_user}
DB_PASSWORD=$DB_PASSWORD_VALUE

# HTTPS ではないため、Secure 属性を付けない。
# 付けるとブラウザがセッション Cookie を保存せず、ログインが維持できない。
# HTTPS にしたら true に戻すこと（docs/07_deployment.md 12.2）
SESSION_COOKIE_SECURE=false

ECR_IMAGE=${ecr_image}
ENVFILE
chmod 600 /opt/taskboard/.env

# 本番用の compose.yaml
# データベースは RDS に分けたため、ここで動かすのはアプリだけ
cat > /opt/taskboard/compose.yaml <<'COMPOSEFILE'
services:
  app:
    image: $${ECR_IMAGE}
    restart: always
    # 死活確認。起動に失敗したときだけでなく、応答しなくなったときも気づけるようにする。
    # restart: always は「落ちたとき」しか効かないため、これが無いと固まったまま放置される
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:8080/actuator/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      # 起動には20秒ほどかかる。その間の失敗は数えない
      start_period: 60s
    environment:
      # 接続先は RDS のエンドポイント。値は .env から読まれる。
      # 変数名は application.yml が読むものに合わせてある
      DB_URL: $${DB_URL}
      DB_USERNAME: $${DB_USERNAME}
      DB_PASSWORD: $${DB_PASSWORD}
      # HTTP で公開するため、セッション Cookie の Secure 属性を外す
      SESSION_COOKIE_SECURE: $${SESSION_COOKIE_SECURE}
      PORT: 8080
      TZ: Asia/Tokyo
      # メモリ 1GB に収めるための JVM 設定。
      # データベースが同居しなくなったぶん、割り当てを 70% まで広げている
      JAVA_TOOL_OPTIONS: "-XX:MaxRAMPercentage=70 -XX:+UseSerialGC"
    ports:
      # ホストの 80番を、コンテナの 8080番につなぐ。
      # これでブラウザから http://<IP> で届くようになる
      - "80:8080"
COMPOSEFILE

# ---------- 5. ECR にログインしてアプリを起動する ----------
# インスタンスプロファイル（iam.tf）の権限を使うので、アクセスキーは不要。
# 初回はまだイメージが push されていないことがあるため、失敗しても処理を止めない
aws ecr get-login-password --region ${aws_region} \
  | docker login --username AWS --password-stdin ${ecr_registry} || true

cd /opt/taskboard
docker compose pull || true
docker compose up -d || true

# ---------- 6. 再起動時に自動で立ち上がるようにする ----------
cat > /etc/systemd/system/taskboard.service <<'SERVICEFILE'
[Unit]
Description=Taskboard application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/taskboard
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
SERVICEFILE

systemctl daemon-reload
systemctl enable taskboard.service
