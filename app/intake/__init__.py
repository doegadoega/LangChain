"""Task intake & planning layer.

Turns a free-form user request into a structured TaskPlan: classify the task,
select a workflow template, and infer the agent roles / skills / artifacts the
workflow needs. This layer is additive — it does not touch the existing
RefineRequest execution engine.
"""

from app.intake.models import (
    ApprovalPolicy,
    Task,
    TaskPlan,
    TaskPriority,
    TaskRequest,
    TaskStatus,
    TaskType,
)
from app.intake.router import TaskRouter
from app.intake.workflows import (
    BUILTIN_WORKFLOWS,
    PhaseDefinition,
    PhaseType,
    WorkflowDefinition,
    get_workflow,
    list_workflow_definitions,
)

__all__ = [
    "ApprovalPolicy",
    "BUILTIN_WORKFLOWS",
    "PhaseDefinition",
    "PhaseType",
    "Task",
    "TaskPlan",
    "TaskPriority",
    "TaskRequest",
    "TaskRouter",
    "TaskStatus",
    "TaskType",
    "WorkflowDefinition",
    "get_workflow",
    "list_workflow_definitions",
]
