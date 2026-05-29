"""Workflow templates: phase-based recipes the Task Router selects from.

A WorkflowDefinition is a static recipe (not a stored user object — those live
in FileStore under `workflows/`). Each phase declares how it runs and which
artifacts it produces, so the planner can derive required roles and expected
artifacts without hard-coding them per task type.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class PhaseType(str, Enum):
    """How a phase is executed."""

    DISCUSSION = "discussion"  # multiple agents converse (reuses the refine engine)
    SINGLE_AGENT = "single_agent"  # one agent produces an artifact
    CLI_AGENT = "cli_agent"  # CLI agent edits code in a sandbox
    COMMAND = "command"  # run a shell command (e.g. tests)


class PhaseDefinition(BaseModel):
    """One step in a workflow."""

    id: str
    type: PhaseType
    # discussion phases list participants; single/cli phases name one role.
    participants: list[str] = Field(default_factory=list)
    agent_role: str | None = None
    outputs: list[str] = Field(default_factory=list)
    sandbox: str | None = None

    def roles(self) -> list[str]:
        """All agent roles this phase involves."""
        roles = list(self.participants)
        if self.agent_role and self.agent_role not in roles:
            roles.append(self.agent_role)
        return roles


class WorkflowDefinition(BaseModel):
    """A named sequence of phases."""

    id: str
    name: str
    phases: list[PhaseDefinition]

    def phase_ids(self) -> list[str]:
        return [phase.id for phase in self.phases]

    def required_roles(self) -> list[str]:
        """Union of roles across phases, preserving first-seen order."""
        seen: list[str] = []
        for phase in self.phases:
            for role in phase.roles():
                if role not in seen:
                    seen.append(role)
        return seen

    def expected_artifacts(self) -> list[str]:
        """Union of artifact outputs across phases, preserving order."""
        seen: list[str] = []
        for phase in self.phases:
            for output in phase.outputs:
                if output not in seen:
                    seen.append(output)
        return seen


_FEATURE_DEVELOPMENT_DEFAULT = WorkflowDefinition(
    id="feature_development_default",
    name="Feature Development",
    phases=[
        PhaseDefinition(
            id="spec",
            type=PhaseType.DISCUSSION,
            participants=["product_owner", "ux_designer", "architect", "qa"],
            outputs=["requirements", "acceptance_criteria"],
        ),
        PhaseDefinition(
            id="design",
            type=PhaseType.DISCUSSION,
            participants=["ux_designer", "ui_designer", "architect"],
            outputs=["screen_spec"],
        ),
        PhaseDefinition(
            id="implementation_plan",
            type=PhaseType.SINGLE_AGENT,
            agent_role="architect",
            outputs=["implementation_plan"],
        ),
        PhaseDefinition(
            id="implementation",
            type=PhaseType.CLI_AGENT,
            agent_role="implementer",
            sandbox="git_worktree",
            outputs=["patch", "implementation_notes"],
        ),
        PhaseDefinition(
            id="verification",
            type=PhaseType.COMMAND,
            outputs=["test_report"],
        ),
        PhaseDefinition(
            id="review",
            type=PhaseType.DISCUSSION,
            participants=["reviewer", "qa", "architect"],
            outputs=["code_review"],
        ),
    ],
)

_BUG_FIX_DEFAULT = WorkflowDefinition(
    id="bug_fix_default",
    name="Bug Fix",
    phases=[
        PhaseDefinition(
            id="investigation",
            type=PhaseType.SINGLE_AGENT,
            agent_role="repository_scout",
            outputs=["investigation_report"],
        ),
        PhaseDefinition(
            id="reproduction",
            type=PhaseType.SINGLE_AGENT,
            agent_role="qa",
            outputs=["reproduction_plan"],
        ),
        PhaseDefinition(
            id="implementation_plan",
            type=PhaseType.SINGLE_AGENT,
            agent_role="architect",
            outputs=["implementation_plan"],
        ),
        PhaseDefinition(
            id="implementation",
            type=PhaseType.CLI_AGENT,
            agent_role="implementer",
            sandbox="git_worktree",
            outputs=["patch"],
        ),
        PhaseDefinition(
            id="verification",
            type=PhaseType.COMMAND,
            outputs=["test_report"],
        ),
        PhaseDefinition(
            id="review",
            type=PhaseType.DISCUSSION,
            participants=["reviewer", "qa"],
            outputs=["review"],
        ),
    ],
)

_REVIEW_ONLY = WorkflowDefinition(
    id="review_only",
    name="Review Only",
    phases=[
        PhaseDefinition(
            id="repository_scan",
            type=PhaseType.SINGLE_AGENT,
            agent_role="repository_scout",
            outputs=["repository_summary"],
        ),
        PhaseDefinition(
            id="review",
            type=PhaseType.DISCUSSION,
            participants=["reviewer", "architect", "qa"],
            outputs=["review"],
        ),
    ],
)


_DESIGN_REVIEW_DEFAULT = WorkflowDefinition(
    id="design_review_default",
    name="Design Review",
    phases=[
        PhaseDefinition(
            id="repository_scan",
            type=PhaseType.SINGLE_AGENT,
            agent_role="repository_scout",
            outputs=["repository_summary"],
        ),
        PhaseDefinition(
            id="design_review",
            type=PhaseType.DISCUSSION,
            participants=["system_designer", "ui_designer", "architect", "pmo"],
            outputs=["design_spec", "screen_spec"],
        ),
        PhaseDefinition(
            id="sign_off",
            type=PhaseType.DISCUSSION,
            participants=["architect", "qa"],
            outputs=["design_review"],
        ),
    ],
)

_REFACTOR_DEFAULT = WorkflowDefinition(
    id="refactor_default",
    name="Refactor",
    phases=[
        PhaseDefinition(
            id="investigation",
            type=PhaseType.SINGLE_AGENT,
            agent_role="repository_scout",
            outputs=["investigation_report"],
        ),
        PhaseDefinition(
            id="refactor_plan",
            type=PhaseType.SINGLE_AGENT,
            agent_role="architect",
            outputs=["implementation_plan"],
        ),
        PhaseDefinition(
            id="implementation",
            type=PhaseType.CLI_AGENT,
            agent_role="implementer",
            sandbox="git_worktree",
            outputs=["patch"],
        ),
        PhaseDefinition(
            id="verification",
            type=PhaseType.COMMAND,
            outputs=["test_report"],
        ),
        PhaseDefinition(
            id="review",
            type=PhaseType.DISCUSSION,
            participants=["reviewer", "qa", "architect"],
            outputs=["code_review"],
        ),
    ],
)

_DOCUMENTATION_DEFAULT = WorkflowDefinition(
    id="documentation_default",
    name="Documentation",
    phases=[
        PhaseDefinition(
            id="outline",
            type=PhaseType.SINGLE_AGENT,
            agent_role="repository_scout",
            outputs=["doc_outline"],
        ),
        PhaseDefinition(
            id="draft",
            type=PhaseType.SINGLE_AGENT,
            agent_role="technical_writer",
            outputs=["documentation"],
        ),
        PhaseDefinition(
            id="review",
            type=PhaseType.DISCUSSION,
            participants=["reviewer", "architect"],
            outputs=["review"],
        ),
    ],
)

_RELEASE_PREPARATION_DEFAULT = WorkflowDefinition(
    id="release_preparation_default",
    name="Release Preparation",
    phases=[
        PhaseDefinition(
            id="changelog",
            type=PhaseType.SINGLE_AGENT,
            agent_role="repository_scout",
            outputs=["changelog"],
        ),
        PhaseDefinition(
            id="release_checklist",
            type=PhaseType.SINGLE_AGENT,
            agent_role="pmo",
            outputs=["release_checklist"],
        ),
        PhaseDefinition(
            id="review",
            type=PhaseType.DISCUSSION,
            participants=["reviewer", "qa"],
            outputs=["release_review"],
        ),
    ],
)


BUILTIN_WORKFLOWS: dict[str, WorkflowDefinition] = {
    workflow.id: workflow
    for workflow in (
        _FEATURE_DEVELOPMENT_DEFAULT,
        _BUG_FIX_DEFAULT,
        _REVIEW_ONLY,
        _DESIGN_REVIEW_DEFAULT,
        _REFACTOR_DEFAULT,
        _DOCUMENTATION_DEFAULT,
        _RELEASE_PREPARATION_DEFAULT,
    )
}


def get_workflow(workflow_id: str) -> WorkflowDefinition | None:
    """Look up a built-in workflow by id."""
    return BUILTIN_WORKFLOWS.get(workflow_id)


def list_workflow_definitions() -> list[WorkflowDefinition]:
    """All built-in workflow templates."""
    return list(BUILTIN_WORKFLOWS.values())
