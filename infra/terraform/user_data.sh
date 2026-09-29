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
# JVM と PostgreSQL を同時に動かすと足りなくなり、OOM Killer にプロセスを殺される。
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

# 環境変数ファイル。compose.yaml から読まれる。
# 600 にして、root 以外からは読めないようにする
cat > /opt/taskboard/.env <<ENVFILE
POSTGRES_DB=taskboard
POSTGRES_USER=taskboard
POSTGRES_PASSWORD=${db_password}
ECR_IMAGE=${ecr_image}
ENVFILE
chmod 600 /opt/taskboard/.env

# 本番用の compose.yaml
cat > /opt/taskboard/compose.yaml <<'COMPOSEFILE'
services:
  db:
    image: postgres:17
    restart: always
    environment:
      POSTGRES_DB: $${POSTGRES_DB}
      POSTGRES_USER: $${POSTGRES_USER}
      POSTGRES_PASSWORD: $${POSTGRES_PASSWORD}
      TZ: Asia/Tokyo
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 10
    # ポートを公開しない。アプリからは Docker 内部のネットワークで届く

  app:
    image: $${ECR_IMAGE}
    restart: always
    depends_on:
      db:
        condition: service_healthy
    environment:
      # ホスト名 "db" は Docker Compose がサービス名から自動で解決してくれる
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/$${POSTGRES_DB}
      SPRING_DATASOURCE_USERNAME: $${POSTGRES_USER}
      SPRING_DATASOURCE_PASSWORD: $${POSTGRES_PASSWORD}
      PORT: 8080
      TZ: Asia/Tokyo
      # メモリ 1GB に収めるための JVM 設定
      JAVA_TOOL_OPTIONS: "-XX:MaxRAMPercentage=50 -XX:+UseSerialGC"
    ports:
      # ホストの 80番を、コンテナの 8080番につなぐ。
      # これでブラウザから http://<IP> で届くようになる
      - "80:8080"

volumes:
  db-data:
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
