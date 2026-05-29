"""Task intake models: what the user submits and what the planner produces."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class TaskType(str, Enum):
    """Inferred kind of work. Drives workflow selection."""

    FEATURE_DEVELOPMENT = "feature_development"
    BUG_FIX = "bug_fix"
    REFACTOR = "refactor"
    DESIGN_REVIEW = "design_review"
    CODE_REVIEW = "code_review"
    QA_VERIFICATION = "qa_verification"
    RESEARCH = "research"
    DOCUMENTATION = "documentation"
    RELEASE_PREPARATION = "release_preparation"


class TaskPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class ApprovalPolicy(str, Enum):
    """How aggressively to require human approval before/within a run."""

    DEFAULT = "default"  # approval inferred from task type / risk
    ALWAYS = "always"  # always pause for human approval
    NEVER = "never"  # never require approval (autonomous)


class TaskStatus(str, Enum):
    DRAFT = "draft"
    PLANNED = "planned"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TaskRequest(BaseModel):
    """A free-form user request. The user does not pick agents or workflows."""

    title: str | None = Field(default=None, max_length=200)
    description: str = Field(min_length=1, max_length=20000)
    repository_path: str | None = Field(default=None, max_length=500)
    base_branch: str | None = Field(default=None, max_length=200)
    target_files: list[str] = Field(default_factory=list, max_length=100)
    constraints: list[str] = Field(default_factory=list, max_length=50)
    desired_outputs: list[str] = Field(default_factory=list, max_length=50)
    priority: TaskPriority = TaskPriority.NORMAL
    approval_policy: ApprovalPolicy = ApprovalPolicy.DEFAULT
    # Optional override; when set the router skips classification's workflow pick.
    workflow_id: str | None = Field(default=None, max_length=100)

    @field_validator("description")
    @classmethod
    def _description_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("description must not be blank")
        return cleaned

    @field_validator("target_files", "constraints", "desired_outputs")
    @classmethod
    def _clean_str_list(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item.strip()]


class TaskPlan(BaseModel):
    """The planner's structured decision for a task."""

    task_id: str
    inferred_task_type: TaskType
    selected_workflow_id: str
    phases: list[str] = Field(default_factory=list)
    required_agent_roles: list[str] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    expected_artifacts: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    requires_human_approval: bool = False
    created_at: str = Field(default_factory=_utcnow_iso)


class Task(BaseModel):
    """A persisted task record (the unit the user submits)."""

    id: str = Field(min_length=1, max_length=64)
    request: TaskRequest
    status: TaskStatus = TaskStatus.DRAFT
    plan: TaskPlan | None = None
    created_at: str = Field(default_factory=_utcnow_iso)
    updated_at: str = Field(default_factory=_utcnow_iso)

    @property
    def title(self) -> str:
        """Human label: explicit title, else first line of the description."""
        if self.request.title:
            return self.request.title
        first_line = self.request.description.strip().splitlines()[0]
        return first_line[:80]
