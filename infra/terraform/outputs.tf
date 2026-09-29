# apply の後に画面に表示される値。
# 「作ったサーバーの IP はいくつ？」を調べるためにコンソールを開かなくて済む。
# あとから見たいときは terraform output で再表示できる。

output "app_public_ip" {
  description = "アプリケーションサーバーのパブリック IP アドレス"
  value       = aws_eip.app.public_ip
}

output "app_url" {
  description = "ブラウザで開く URL"
  value       = "http://${aws_eip.app.public_ip}"
}

output "instance_id" {
  description = "EC2 インスタンス ID（SSM で接続するときに使う）"
  value       = aws_instance.app.id
}

output "ecr_repository_url" {
  description = "コンテナイメージの push 先"
  value       = aws_ecr_repository.backend.repository_url
}

output "github_actions_role_arn" {
  description = "GitHub Actions のワークフローに設定するロール ARN（9.5 で使う）"
  value       = aws_iam_role.github_actions.arn
}

output "ssm_connect_command" {
  description = "サーバーのシェルに入るコマンド"
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.aws_region}"
}
