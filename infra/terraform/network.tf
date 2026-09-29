# ネットワークの箱を作る。
# 家を建てるのに例えると、土地を用意し、道路につなげ、玄関に鍵を付ける工程にあたる。

# ---------- VPC（自分専用のネットワーク空間） ----------
resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  # VPC 内のリソースに DNS 名を割り当てる。
  # ECR からイメージを取得するときに名前解決が必要になるため、両方 true にする
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# ---------- インターネットゲートウェイ（インターネットへの出入口） ----------
# これを VPC に付けないと、中のサーバーは外と通信できない。料金はかからない
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# ---------- アベイラビリティゾーンの一覧を取得する ----------
# data ブロックは「作る」のではなく「AWS から情報を読む」ためのもの。
# AZ の名前をコードに直接書かずに済ませ、他のリージョンでも動くようにしている
data "aws_availability_zones" "available" {
  state = "available"
}

# ---------- パブリックサブネット ----------
# 「パブリック」とは、インターネットゲートウェイへの経路を持つサブネットのこと。
# サブネット自体に public / private という設定項目があるわけではなく、
# ルートテーブルの中身で決まる（初学者が必ず混乱するところ）
resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidr
  availability_zone = data.aws_availability_zones.available.names[0]

  # このサブネットで起動したインスタンスに、自動でパブリック IP を割り当てる
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet"
  }
}

# ---------- ルートテーブル（通信の行き先表） ----------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    # 「VPC 内宛て以外のすべての通信（0.0.0.0/0）は、インターネットゲートウェイへ送る」
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

# ルートテーブルをサブネットに結びつける。これで初めて「パブリックサブネット」になる
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ---------- セキュリティグループ（サーバーの前に立つ関所） ----------
# セキュリティグループは「許可リスト方式」。書いたものだけが通り、書かないものは全部拒否される。
# また「ステートフル」なので、入りを許可すればその応答の戻りは自動的に許可される
# （戻り用のルールを書く必要はない）
resource "aws_security_group" "app" {
  name        = "${var.project_name}-app-sg"
  description = "Application server: allow HTTP/HTTPS from allowed addresses only"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-app-sg"
  }
}

# インバウンド（入ってくる通信）：HTTP
#
# 0.0.0.0/0（全世界）ではなく、var.allowed_app_cidr に書いた送信元だけに許可する。
# スクール課題のため一般公開する必要がなく、公開範囲を狭めるほど攻撃されにくくなるため。
#
# for_each に空のリストを渡すとルールが1つも作られない。
# つまり allowed_app_cidr を設定しない限り、80番は誰にも開かない
resource "aws_vpc_security_group_ingress_rule" "http" {
  for_each = toset(var.allowed_app_cidr)

  security_group_id = aws_security_group.app.id
  description       = "HTTP from an allowed address"
  cidr_ipv4         = each.value
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

# インバウンド：HTTPS（後で Let's Encrypt などを入れるとき用。許可する送信元は HTTP と同じ）
resource "aws_vpc_security_group_ingress_rule" "https" {
  for_each = toset(var.allowed_app_cidr)

  security_group_id = aws_security_group.app.id
  description       = "HTTPS from an allowed address"
  cidr_ipv4         = each.value
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

# インバウンド：SSH
# 既定では var.allowed_ssh_cidr が空リストなので、このルールは1つも作られない。
# for_each に空のコレクションを渡すとリソースが作られない ―― これが Terraform での条件分岐の書き方
resource "aws_vpc_security_group_ingress_rule" "ssh" {
  for_each = toset(var.allowed_ssh_cidr)

  security_group_id = aws_security_group.app.id
  description       = "SSH from a specific address"
  cidr_ipv4         = each.value
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
}

# アウトバウンド（出ていく通信）：すべて許可。
# ECR からのイメージ取得、OS のパッケージ更新、SSM への接続に必要
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.app.id
  description       = "Allow all outbound traffic"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1" # -1 は「すべてのプロトコル」
}

# 注意：PostgreSQL の 5432 番ポートは意図的に開けていない。
# DB は同じ EC2 の中のコンテナとして動き、アプリからは Docker のネットワーク経由で届くため、
# 外部に公開する必要がない。DB のポートをインターネットに開けるのは重大な脆弱性になる
