"""WorkflowRunner: execute a task's workflow phase by phase."""

from __future__ import annotations

import subprocess
from datetime import datetime, timezone
from typing import Callable
from uuid import uuid4

from app.artifacts import Artifact, ArtifactType, make_artifact
from app.intake import Task, get_workflow
from app.intake.workflows import PhaseDefinition, PhaseType
from app.models import CodeContext, OrchestrationMode, RefineRequest, WorkflowMode
from app.orchestration.matcher import AgentMatcher
from app.orchestration.models import (
    PhaseRun,
    RunOptions,
    WorkflowRun,
    WorkflowRunStatus,
)
from app.orchestrator import run_refinement as _default_run_refinement
from app.runs import AgentRun, AgentSnapshot, RunStatus, snapshot_from_agent
from app.store import FileStore

# phase output name -> closest ArtifactType (exact name kept in metadata.output)
_OUTPUT_TO_TYPE: dict[str, ArtifactType] = {
    "requirements": ArtifactType.REQUIREMENTS,
    "acceptance_criteria": ArtifactType.ACCEPTANCE_CRITERIA,
    "user_flow": ArtifactType.USER_FLOW,
    "screen_spec": ArtifactType.SCREEN_SPEC,
    "design_spec": ArtifactType.DESIGN_SPEC,
    "design_review": ArtifactType.CODE_REVIEW,
    "implementation_plan": ArtifactType.IMPLEMENTATION_PLAN,
    "patch": ArtifactType.PATCH,
    "implementation_notes": ArtifactType.IMPLEMENTATION_PLAN,
    "test_report": ArtifactType.TEST_REPORT,
    "qa_report": ArtifactType.QA_REPORT,
    "code_review": ArtifactType.CODE_REVIEW,
    "review": ArtifactType.CODE_REVIEW,
    "release_review": ArtifactType.CODE_REVIEW,
    "pr_body": ArtifactType.PR_BODY,
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit] + "\n…"


def _artifact_type_for(output: str) -> ArtifactType:
    return _OUTPUT_TO_TYPE.get(output, ArtifactType.DECISION_LOG)


def _default_run_command(command: str, cwd: str | None) -> tuple[int, str]:
    completed = subprocess.run(
        command,
        shell=True,
        cwd=cwd or None,
        capture_output=True,
        text=True,
        timeout=300,
    )
    output = (completed.stdout or "") + (completed.stderr or "")
    return completed.returncode, output


class WorkflowRunner:
    """Runs a planned task's workflow, recording agent runs and artifacts.

    `run_refinement` and `run_command` are injectable for testing.
    """

    def __init__(
        self,
        store: FileStore,
        *,
        run_refinement: Callable[[RefineRequest], object] | None = None,
        run_command: Callable[[str, str | None], tuple[int, str]] | None = None,
    ) -> None:
        self._store = store
        self._run_refinement = run_refinement or _default_run_refinement
        self._run_command = run_command or _default_run_command

    def run(self, task: Task, options: RunOptions | None = None) -> WorkflowRun:
        options = options or RunOptions()
        if task.plan is None:
            raise ValueError("task has no plan; call /api/tasks/{id}/plan first")
        workflow = get_workflow(task.plan.selected_workflow_id)
        if workflow is None:
            raise ValueError(f"unknown workflow: {task.plan.selected_workflow_id}")

        matcher = AgentMatcher(options.provider, options.model)
        run = WorkflowRun(
            id=f"wr_{uuid4().hex[:12]}",
            task_id=task.id,
            workflow_id=workflow.id,
            status=WorkflowRunStatus.RUNNING,
            provider=matcher._provider.value,  # noqa: SLF001 — internal helper
        )
        self._store.save_workflow_run(run.model_dump())

        prior: list[Artifact] = []
        all_ok = True
        for phase in workflow.phases:
            pr = PhaseRun(
                id=f"pr_{uuid4().hex[:10]}",
                phase_id=phase.id,
                phase_name=phase.id.replace("_", " ").title(),
                type=phase.type.value,
                status=WorkflowRunStatus.RUNNING,
            )
            run.current_phase_id = phase.id
            try:
                if phase.type == PhaseType.COMMAND:
                    artifact = self._run_command_phase(task, phase, run, pr, options)
                    if artifact:
                        pr.artifact_ids.append(artifact.id)
                        prior.append(artifact)
                else:
                    agent_run_ids, artifact = self._run_agent_phase(
                        task, phase, run, pr, prior, matcher, options
                    )
                    pr.agent_run_ids = agent_run_ids
                    if artifact:
                        pr.artifact_ids.append(artifact.id)
                        prior.append(artifact)
                pr.status = WorkflowRunStatus.COMPLETED
            except Exception as exc:  # noqa: BLE001 — record and continue
                pr.status = WorkflowRunStatus.FAILED
                pr.error = str(exc)
                all_ok = False
            pr.finished_at = _now()
            run.phases.append(pr)
            run.updated_at = _now()
            self._store.save_workflow_run(run.model_dump())

        run.status = WorkflowRunStatus.COMPLETED if all_ok else WorkflowRunStatus.FAILED
        run.current_phase_id = None
        run.updated_at = _now()
        self._store.save_workflow_run(run.model_dump())
        return run

    def _build_request(
        self, task: Task, phase: PhaseDefinition, prior: list[Artifact], agents, options: RunOptions
    ) -> RefineRequest:
        context = "\n\n".join(
            f"## {a.title}\n{_truncate(a.content, 1500)}" for a in prior
        )
        outputs = ", ".join(phase.outputs) or phase.id
        instruction = (
            (f"これまでの成果物:\n{context}\n\n" if context else "")
            + f"このフェーズの目的: {phase.id} → 出力: {outputs}"
        )
        is_coding = phase.type == PhaseType.CLI_AGENT
        repo = task.request.repository_path or ""
        code_context = (
            CodeContext(repository=repo, working_directory=repo)
            if is_coding and repo
            else CodeContext()
        )
        return RefineRequest(
            workflow_mode=WorkflowMode.CODING if is_coding else WorkflowMode.WRITING,
            orchestration_mode=OrchestrationMode.SEQUENTIAL,
            source_text=task.request.description,
            objective=f"{phase.id} phase",
            global_instruction=instruction,
            code_context=code_context,
            knowledge_context=[],
            rounds=options.rounds,
            agents=agents,
        )

    def _run_agent_phase(
        self, task, phase, run, pr, prior, matcher: AgentMatcher, options
    ) -> tuple[list[str], Artifact | None]:
        agents = matcher.match_all(phase.roles())
        request = self._build_request(task, phase, prior, agents, options)
        response = self._run_refinement(request)
        agent_by_id = {a.id: a for a in agents}

        agent_run_ids: list[str] = []
        turns = [turn for rnd in response.rounds for turn in rnd.turns]
        for turn in turns:
            agent = agent_by_id.get(turn.agent_id)
            snapshot = (
                snapshot_from_agent(agent)
                if agent is not None
                else AgentSnapshot(
                    id=turn.agent_id,
                    name=turn.agent_name,
                    provider=turn.provider.value,
                    phase_roles=[turn.org_role.value],
                )
            )
            agent_run = AgentRun(
                id=f"ar_{uuid4().hex[:12]}",
                task_id=task.id,
                workflow_run_id=run.id,
                phase_run_id=pr.id,
                agent_id=turn.agent_id,
                agent_snapshot=snapshot,
                input_text=request.source_text,
                system_prompt="",
                output_text=turn.output,
                status=RunStatus.FAILED if turn.error else RunStatus.COMPLETED,
                error=turn.error,
                finished_at=_now(),
            )
            self._store.save_agent_run(agent_run.model_dump())
            agent_run_ids.append(agent_run.id)

        output_name = phase.outputs[0] if phase.outputs else phase.id
        artifact = make_artifact(
            _artifact_type_for(output_name),
            f"{output_name}.md",
            response.final_text or "",
            task_id=task.id,
            workflow_run_id=run.id,
            phase_run_id=pr.id,
            agent_run_id=agent_run_ids[-1] if agent_run_ids else None,
            metadata={"phase": phase.id, "output": output_name},
        )
        self._store.save_artifact(artifact.model_dump())
        return agent_run_ids, artifact

    def _run_command_phase(self, task, phase, run, pr, options: RunOptions) -> Artifact | None:
        command = options.test_command
        repo = task.request.repository_path
        if not command:
            content = "（test_command 未指定のため検証はスキップされました）"
        else:
            code, output = self._run_command(command, repo)
            content = f"$ {command}\n(exit {code})\n\n{_truncate(output, 6000)}"
        artifact = make_artifact(
            ArtifactType.TEST_REPORT,
            "test_report.md",
            content,
            task_id=task.id,
            workflow_run_id=run.id,
            phase_run_id=pr.id,
            metadata={"phase": phase.id, "command": command},
        )
        self._store.save_artifact(artifact.model_dump())
        return artifact
