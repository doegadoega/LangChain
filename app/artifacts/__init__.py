"""Artifact store: structured, hashed work products passed between phases.

Phases hand off Artifacts (requirements.md, implementation_plan.md, diff.patch,
review.md, ...) rather than raw conversation logs, so downstream phases consume
stable, inspectable inputs. Output Contracts (structured JSON per phase) are
rendered into Markdown artifacts here.

Sprint 3 ships the models, contracts/renderers, store and read APIs. Producing
artifacts during a run is wired into the phase runner in Sprint 4.
"""

from app.artifacts.contracts import (
    ReviewOutput,
    RequirementsOutput,
    render_requirements_markdown,
    render_review_markdown,
)
from app.artifacts.models import (
    Artifact,
    ArtifactType,
    content_hash,
    make_artifact,
)

__all__ = [
    "Artifact",
    "ArtifactType",
    "RequirementsOutput",
    "ReviewOutput",
    "content_hash",
    "make_artifact",
    "render_requirements_markdown",
    "render_review_markdown",
]
