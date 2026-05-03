import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "./ui/Button";
import { Input, Label } from "./ui/Field";
import { api } from "../api/client";
import { PROVIDER_LABEL } from "../lib/format";
import type { ProviderKind, ProviderModel } from "../types";

export function ModelPicker({
  provider,
  value,
  onChange,
  placeholder = "model id",
}: {
  provider: ProviderKind;
  value: string | null | undefined;
  onChange: (model: string) => void;
  placeholder?: string;
}) {
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = useMemo(
    () => `provider-models-${provider}-${Math.random().toString(36).slice(2, 8)}`,
    [provider],
  );

  const loadModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listProviderModels(provider);
      setModels(result.models);
      setError(result.error ?? null);
    } catch (err) {
      setModels([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadModels();
  }, [provider]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label className="mb-1">model</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={() => void loadModels()}
          title={`${PROVIDER_LABEL[provider]} のモデル一覧を再取得`}
        >
          <RefreshCcw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        </Button>
      </div>
      <Input
        list={models.length > 0 ? listId : undefined}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
      {models.length > 0 && (
        <datalist id={listId}>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </datalist>
      )}
      <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
        {loading
          ? "モデル一覧を取得中..."
          : models.length > 0
            ? `${models.length}件のモデル候補`
            : error || "このproviderではモデル一覧を取得できません。手入力してください。"}
      </div>
    </div>
  );
}
