"""Workflow run state models."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class WorkflowRunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class PhaseRun(BaseModel):
    """Execution record for a single workflow phase."""

    id: str
    phase_id: str
    phase_name: str
    type: str
    status: WorkflowRunStatus = WorkflowRunStatus.PENDING
    agent_run_ids: list[str] = Field(default_factory=list)
    artifact_ids: list[str] = Field(default_factory=list)
    error: str | None = None
    started_at: str = Field(default_factory=_utcnow_iso)
    finished_at: str | None = None


class WorkflowRun(BaseModel):
    """A task's workflow execution: an ordered set of phase runs."""

    id: str = Field(min_length=1, max_length=64)
    task_id: str
    workflow_id: str
    status: WorkflowRunStatus = WorkflowRunStatus.PENDING
    current_phase_id: str | None = None
    phases: list[PhaseRun] = Field(default_factory=list)
    provider: str | None = None
    error: str | None = None
    created_at: str = Field(default_factory=_utcnow_iso)
    updated_at: str = Field(default_factory=_utcnow_iso)


class RunOptions(BaseModel):
    """Knobs for executing a task's workflow."""

    provider: str | None = None  # default resolved from env / codex_cli
    model: str | None = None
    rounds: int = Field(default=1, ge=1, le=5)
    test_command: str | None = None  # used by `command` (verification) phases
