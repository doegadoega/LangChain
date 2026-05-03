import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Label } from "../components/ui/Field";
import { useApp } from "../state/store";

export function Settings() {
  const templates = useApp((s) => s.templates);
  return (
    <div className="grid h-full grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-2">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
          システム共通設定 · CLI接続 / テンプレート / ログポリシー
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Provider 接続</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-3">
            <div>
              <Label>GEMINI_CLI_CMD</Label>
              <Input placeholder="gemini -p {prompt}" />
            </div>
            <div>
              <Label>CLAUDE_CLI_CMD</Label>
              <Input placeholder="claude --print --output-format text {prompt}" />
            </div>
            <div>
              <Label>CODEX_CLI_CMD</Label>
              <Input placeholder="codex exec ... {prompt}" />
            </div>
            <div>
              <Label>OLLAMA_BASE_URL</Label>
              <Input placeholder="http://localhost:11434/api" />
            </div>
            <div>
              <Label>OLLAMA_MODEL</Label>
              <Input placeholder="qwen3:8b" />
            </div>
            <div>
              <Label>LM_STUDIO_BASE_URL</Label>
              <Input placeholder="http://localhost:1234/v1" />
            </div>
            <div>
              <Label>LM_STUDIO_MODEL</Label>
              <Input placeholder="例: qwen2.5-coder-3b-instruct" />
            </div>
            <div>
              <Label>MCP デフォルト config</Label>
              <Input placeholder="~/.config/mcp/config.json" />
            </div>
            <div className="col-span-2 pt-2">
              <Button variant="outline" size="sm">
                接続テスト
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>監査ログ保存ポリシー</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-3">
            <div>
              <Label>保持日数</Label>
              <Input type="number" defaultValue={30} />
            </div>
            <div>
              <Label>最大ファイルサイズ (MB)</Label>
              <Input type="number" defaultValue={100} />
            </div>
          </CardBody>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>デフォルトテンプレート</CardTitle>
            <span className="text-[10px] text-[var(--color-fg-subtle)]">
              {templates.length} 件
            </span>
          </CardHeader>
          <CardBody className="space-y-2">
            {templates.length === 0 && (
              <div className="text-xs text-[var(--color-fg-subtle)]">未登録</div>
            )}
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
              >
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-[11px] text-[var(--color-fg-muted)]">
                  {t.description ?? ""}
                </div>
                <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
                  {t.agents?.length ?? 0} agents
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>受け入れ条件チェック</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-xs">
            <Check label="CEO によるモデル決定が実行前に必ず行われる" />
            <Check label="QA3名ルールが強制される" />
            <Check label="dependency_graph で循環依存は拒否される" />
            <Check label="UI/CLI どちらでも同じ結果フォーマットを取得できる" />
            <Check label="全構成図とフロー図がドキュメント化されている" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Check({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-4 w-4 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
        ✓
      </span>
      <span className="text-[var(--color-fg-muted)]">{label}</span>
    </div>
  );
}
