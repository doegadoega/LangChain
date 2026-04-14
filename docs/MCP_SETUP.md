# MCP連携設定ガイド

## 1. 目的
本ドキュメントは、エージェントごとにMCP連携を有効化し、外部コンテキストを実行時に取り込む設定方法を示します。

## 2. エージェント設定項目
- `mcp_enabled`: MCP機能を有効化するか
- `mcp_config_path`: MCP設定ファイルのパス（任意）
- `mcp_servers[]`: 利用対象MCPサーバー名
- `mcp_instruction`: MCP利用時の追加指示
- `mcp_context_command`: MCPコンテキストを取得するCLIコマンド（任意）
- `mcp_timeout_sec`: MCPコンテキスト取得コマンドのタイムアウト秒

## 3. プレースホルダ
`command_template` / `mcp_context_command` では次を利用できます。

- `{prompt}` / `{query}`
- `{model}`
- `{mcp_config_path}`
- `{mcp_servers_csv}`
- `{mcp_servers_json}`

## 4. 最小例（JSON）
```json
{
  "id": "architect",
  "name": "Architect",
  "mode": "writer",
  "provider": "custom_cli",
  "persona": "設計を担当",
  "skills": ["アーキテクチャ設計"],
  "depends_on": [],
  "command_template": "my-agent-cli --prompt {prompt} --mcp-config {mcp_config_path}",
  "model": null,
  "mcp_enabled": true,
  "mcp_config_path": "/Users/you/.mcp/config.json",
  "mcp_servers": ["github", "figma"],
  "mcp_instruction": "GitHub issueとFigma仕様を先に確認して提案する",
  "mcp_context_command": "mcp-query --servers {mcp_servers_csv} --prompt {prompt}",
  "mcp_timeout_sec": 90,
  "is_custom": true
}
```

## 5. 実行時の挙動
- `mcp_enabled=true` の場合、エージェントのシステム指示にMCP設定が反映されます。
- `mcp_context_command` が指定されている場合、実行前にコマンドを呼び出し、取得結果をプロンプトへ注入します。
- `mcp_context_command` が失敗してもターンは継続し、エラーはターン結果に記録されます。
