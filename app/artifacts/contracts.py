"""Output Contracts: structured JSON each phase returns, rendered to Markdown.

Agents emit validated JSON (not free text) so downstream phases get stable
inputs. The render_* functions turn that JSON into the Markdown artifact stored
in the artifact store.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---- spec / requirements phase ----
class Requirement(BaseModel):
    id: str
    description: str
    priority: str = "should"  # must / should / could


class AcceptanceCriterion(BaseModel):
    id: str
    given: str
    when: str
    then: str


class RequirementsOutput(BaseModel):
    summary: str = ""
    requirements: list[Requirement] = Field(default_factory=list)
    acceptance_criteria: list[AcceptanceCriterion] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    blocking_issues: list[str] = Field(default_factory=list)


# ---- review phase ----
class Suggestion(BaseModel):
    id: str
    severity: str = "minor"  # blocker / major / minor / nit
    file: str | None = None
    description: str = ""


class ReviewOutput(BaseModel):
    decision: str = "PASS"  # PASS / REWORK / ESCALATE
    summary: str = ""
    blocking_issues: list[str] = Field(default_factory=list)
    suggestions: list[Suggestion] = Field(default_factory=list)


def _bullets(items: list[str]) -> list[str]:
    return [f"- {item}" for item in items] if items else ["_なし_"]


def render_requirements_markdown(output: RequirementsOutput) -> str:
    lines: list[str] = ["# 要件 / Requirements", ""]
    if output.summary:
        lines += [output.summary, ""]
    lines += ["## Requirements", ""]
    if output.requirements:
        for req in output.requirements:
            lines.append(f"- **{req.id}** ({req.priority}) — {req.description}")
    else:
        lines.append("_なし_")
    lines += ["", "## Acceptance Criteria", ""]
    if output.acceptance_criteria:
        for ac in output.acceptance_criteria:
            lines.append(
                f"- **{ac.id}** — Given {ac.given} / When {ac.when} / Then {ac.then}"
            )
    else:
        lines.append("_なし_")
    lines += ["", "## Open Questions", "", *_bullets(output.open_questions)]
    lines += ["", "## Blocking Issues", "", *_bullets(output.blocking_issues)]
    return "\n".join(lines) + "\n"


def render_review_markdown(output: ReviewOutput) -> str:
    lines: list[str] = [
        "# レビュー / Code Review",
        "",
        f"**Decision: {output.decision}**",
        "",
    ]
    if output.summary:
        lines += [output.summary, ""]
    lines += ["## Blocking Issues", "", *_bullets(output.blocking_issues), ""]
    lines += ["## Suggestions", ""]
    if output.suggestions:
        for s in output.suggestions:
            where = f" `{s.file}`" if s.file else ""
            lines.append(f"- **{s.id}** [{s.severity}]{where} — {s.description}")
    else:
        lines.append("_なし_")
    return "\n".join(lines) + "\n"
