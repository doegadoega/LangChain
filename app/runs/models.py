"""AgentRun ledger models and the snapshot builder."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from app.models import AgentConfig


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AgentSnapshot(BaseModel):
    """Immutable record of an agent's configuration at execution time.

    Captured per run so history stays accurate even after the agent's saved
    config changes later.
    """

    id: str
    name: str
    phase_roles: list[str] = Field(default_factory=list)
    discipline: list[str] = Field(default_factory=list)
    provider: str
    model: str | None = None
    persona: str = ""
    skills: list[str] = Field(default_factory=list)
    skill_refs: list[dict[str, Any]] = Field(default_factory=list)
    permissions: dict[str, Any] = Field(default_factory=dict)
    mcp_enabled: bool = False
    mcp_servers: list[str] = Field(default_factory=list)
    allow_web_search: bool = False
    research_sources: list[str] = Field(default_factory=list)
    prompt_hash: str | None = None


class AgentRun(BaseModel):
    """One agent execution within a task / workflow run."""

    id: str = Field(min_length=1, max_length=64)
    task_id: str | None = None
    workflow_run_id: str | None = None
    phase_run_id: str | None = None
    agent_id: str
    agent_snapshot: AgentSnapshot
    input_text: str = ""
    input_artifacts: list[str] = Field(default_factory=list)
    system_prompt: str = ""
    output_text: str | None = None
    output_artifacts: list[str] = Field(default_factory=list)
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    status: RunStatus = RunStatus.PENDING
    error: str | None = None
    token_input: int | None = None
    token_output: int | None = None
    cost_usd: float | None = None
    started_at: str = Field(default_factory=_utcnow_iso)
    finished_at: str | None = None


def _prompt_hash(system_prompt: str | None) -> str | None:
    if not system_prompt:
        return None
    digest = hashlib.sha256(system_prompt.encode("utf-8")).hexdigest()
    return f"sha256:{digest[:16]}"


def snapshot_from_agent(
    agent: AgentConfig,
    *,
    system_prompt: str | None = None,
    phase_roles: list[str] | None = None,
    discipline: list[str] | None = None,
    permissions: dict[str, Any] | None = None,
) -> AgentSnapshot:
    """Build an AgentSnapshot from a live AgentConfig.

    `phase_roles` defaults to the agent's single org_role; callers running a
    workflow may pass the roles the agent actually filled for that phase.
    """
    return AgentSnapshot(
        id=agent.id,
        name=agent.name,
        phase_roles=phase_roles if phase_roles is not None else [agent.org_role.value],
        discipline=discipline or [],
        provider=agent.provider.value,
        model=agent.model,
        persona=agent.persona,
        skills=list(agent.skills),
        skill_refs=[ref.model_dump() for ref in agent.skill_refs],
        permissions=permissions or {},
        mcp_enabled=agent.mcp_enabled,
        mcp_servers=list(agent.mcp_servers),
        allow_web_search=agent.allow_web_search,
        research_sources=list(agent.research_sources),
        prompt_hash=_prompt_hash(system_prompt),
    )
