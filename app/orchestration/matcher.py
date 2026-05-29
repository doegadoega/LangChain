"""Agent Matcher: resolve workflow roles to concrete agents.

Sprint 4 synthesizes a clean agent per workflow role (deterministic, no setup
required). Sprint 6 will match against the saved agent catalog by skills,
provider availability, cost and past success.
"""

from __future__ import annotations

import os

from app.models import AgentConfig, OrgRole, ProviderKind

# workflow role -> backend org_role (drives the engine's behavior/ordering)
ROLE_TO_ORG: dict[str, OrgRole] = {
    "product_owner": OrgRole.CEO,
    "ceo": OrgRole.CEO,
    "manager": OrgRole.MANAGER,
    "pmo": OrgRole.PMO,
    "architect": OrgRole.SYSTEM_DESIGNER,
    "system_designer": OrgRole.SYSTEM_DESIGNER,
    "ux_designer": OrgRole.UI_DESIGNER,
    "ui_designer": OrgRole.UI_DESIGNER,
    "implementer": OrgRole.WORKER,
    "repository_scout": OrgRole.WORKER,
    "technical_writer": OrgRole.WORKER,
    "qa": OrgRole.QA,
    "reviewer": OrgRole.QA,
}

ROLE_PERSONA: dict[str, str] = {
    "product_owner": "目的・要件・受け入れ条件を明確にする。",
    "architect": "設計方針・責務分離・実装計画を最小限の差分で示す。",
    "system_designer": "アーキテクチャと拡張性・運用リスクを確認する。",
    "ux_designer": "操作導線と情報設計を確認する。",
    "ui_designer": "画面構成・視認性・一貫性を確認する。",
    "implementer": "対象を限定し、最小diffで安全に実装する。",
    "repository_scout": "リポジトリを調査し、関連ファイルと現状を要約する。",
    "technical_writer": "簡潔で正確なドキュメントを書く。",
    "qa": "検証観点・受け入れ条件・失敗ケースを確認する。",
    "reviewer": "差分・テスト・リスク・仕様逸脱をレビューする。",
    "pmo": "計画の抜け漏れ・依存・順序を確認する。",
}

DEFAULT_PROVIDER = "codex_cli"


def resolve_provider(provider: str | None) -> ProviderKind:
    """Pick the provider: explicit > env AGENT_OS_DEFAULT_PROVIDER > codex_cli."""
    candidate = provider or os.environ.get("AGENT_OS_DEFAULT_PROVIDER") or DEFAULT_PROVIDER
    try:
        return ProviderKind(candidate)
    except ValueError:
        return ProviderKind(DEFAULT_PROVIDER)


class AgentMatcher:
    def __init__(self, provider: str | None = None, model: str | None = None) -> None:
        self._provider = resolve_provider(provider)
        self._model = model

    def match(self, role: str) -> AgentConfig:
        org_role = ROLE_TO_ORG.get(role, OrgRole.WORKER)
        return AgentConfig(
            id=role,
            name=role.replace("_", " ").title(),
            org_role=org_role,
            provider=self._provider,
            model=self._model,
            persona=ROLE_PERSONA.get(role, f"{role} の観点で貢献する。"),
            is_custom=False,
        )

    def match_all(self, roles: list[str]) -> list[AgentConfig]:
        # dedupe while preserving order; ids must be unique within a run
        seen: list[str] = []
        for role in roles:
            if role not in seen:
                seen.append(role)
        return [self.match(role) for role in seen]


def match_agents(
    roles: list[str], provider: str | None = None, model: str | None = None
) -> list[AgentConfig]:
    return AgentMatcher(provider, model).match_all(roles)
