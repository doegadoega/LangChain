"""Skill Package Manager data models."""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class SkillSource(str, Enum):
    BUNDLED = "bundled"
    USER = "user"
    IMPORTED = "imported"
    DISCOVERED = "discovered"


VersionRequirementKind = Literal["exact", "latest_compatible", "latest"]


class SkillVersionRequirement(BaseModel):
    kind: VersionRequirementKind = "latest"
    version: str | None = Field(default=None, max_length=64)

    @model_validator(mode="after")
    def validate_version(self) -> "SkillVersionRequirement":
        if self.kind == "exact" and not (self.version or "").strip():
            raise ValueError("exact requirement needs a version")
        return self


class SkillReference(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    source: SkillSource = SkillSource.USER
    version_requirement: SkillVersionRequirement = Field(
        default_factory=SkillVersionRequirement
    )
    enabled: bool = True


class SkillMetadata(BaseModel):
    id: str
    name: str
    version: str
    description: str = ""
    providers: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class SkillDocument(BaseModel):
    metadata: SkillMetadata
    source: SkillSource
    markdown: str
    body: str
    root_directory: str | None = None


class CandidateBatch(BaseModel):
    id: str
    directory: str
    skills: list[SkillDocument]
