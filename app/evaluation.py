"""Evaluation logic for agent performance scoring."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


def create_evaluation(
    evaluator_role: str,
    score: int,
    comment: str | None = None,
    round_number: int | None = None,
    is_final: bool = False,
) -> dict[str, Any]:
    clamped_score = max(1, min(10, score))
    return {
        "id": str(uuid4()),
        "evaluator_role": evaluator_role,
        "score": clamped_score,
        "comment": comment,
        "round_number": round_number,
        "is_final": is_final,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def add_evaluation_to_project(
    project: dict[str, Any],
    snapshot_id: str,
    evaluation: dict[str, Any],
) -> dict[str, Any]:
    updated_snapshots = []
    for snap in project.get("agent_snapshots", []):
        if snap.get("id") == snapshot_id:
            evals = list(snap.get("evaluations", []))
            evals.append(evaluation)
            updated_snapshots.append({**snap, "evaluations": evals})
        else:
            updated_snapshots.append(snap)
    return {**project, "agent_snapshots": updated_snapshots}


def get_agent_evaluations_across_projects(
    projects: list[dict[str, Any]],
    agent_id: str,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for project in projects:
        for snap in project.get("agent_snapshots", []):
            if snap.get("master_agent_id") == agent_id:
                for ev in snap.get("evaluations", []):
                    results.append({
                        **ev,
                        "project_id": project.get("id"),
                        "project_name": project.get("name"),
                    })
    return results
