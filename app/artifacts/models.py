"""Artifact model and factory."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class ArtifactType(str, Enum):
    TASK_PLAN = "task_plan"
    REQUIREMENTS = "requirements"
    ACCEPTANCE_CRITERIA = "acceptance_criteria"
    USER_FLOW = "user_flow"
    SCREEN_SPEC = "screen_spec"
    DESIGN_SPEC = "design_spec"
    IMPLEMENTATION_PLAN = "implementation_plan"
    PATCH = "patch"
    TEST_REPORT = "test_report"
    QA_REPORT = "qa_report"
    CODE_REVIEW = "code_review"
    DECISION_LOG = "decision_log"
    PR_BODY = "pr_body"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def content_hash(content: str) -> str:
    """Stable content hash used to dedupe / detect changes between runs."""
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


class Artifact(BaseModel):
    """A work product produced by a phase / agent run."""

    id: str = Field(min_length=1, max_length=64)
    task_id: str | None = None
    workflow_run_id: str | None = None
    phase_run_id: str | None = None
    agent_run_id: str | None = None
    type: ArtifactType
    title: str = Field(min_length=1, max_length=200)
    path: str | None = None
    content: str = ""
    content_hash: str = ""
    created_at: str = Field(default_factory=_utcnow_iso)
    metadata: dict[str, Any] = Field(default_factory=dict)


def make_artifact(
    type: ArtifactType,
    title: str,
    content: str,
    *,
    task_id: str | None = None,
    workflow_run_id: str | None = None,
    phase_run_id: str | None = None,
    agent_run_id: str | None = None,
    path: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> Artifact:
    """Build an Artifact, computing the content hash and a unique id."""
    return Artifact(
        id=f"art_{uuid4().hex[:12]}",
        task_id=task_id,
        workflow_run_id=workflow_run_id,
        phase_run_id=phase_run_id,
        agent_run_id=agent_run_id,
        type=type,
        title=title,
        path=path,
        content=content,
        content_hash=content_hash(content),
        metadata=metadata or {},
    )
