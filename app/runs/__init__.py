"""AgentRun ledger: provenance for every agent execution.

Records who ran (AgentSnapshot — persona, skills, provider, model, permissions),
what they received (input text + artifacts + system prompt) and what they
produced (output text + artifacts + tool calls), with status, tokens and cost.

Sprint 2 ships the models, store and read APIs. Recording is wired into the
workflow/phase runner in Sprint 4; the existing refine engine is left untouched.
"""

from app.runs.models import (
    AgentRun,
    AgentSnapshot,
    RunStatus,
    snapshot_from_agent,
)

__all__ = ["AgentRun", "AgentSnapshot", "RunStatus", "snapshot_from_agent"]
