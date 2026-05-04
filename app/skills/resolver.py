"""Skill prompt resolver.

Mirrors the Mac app `SkillPromptRenderer.swift`.
"""

from __future__ import annotations

from app.skills.models import (
    SkillDocument,
    SkillReference,
    SkillVersionRequirement,
)


def render_skills(
    skills: list[SkillDocument],
    references: list[SkillReference],
    provider: str,
    role: str,
) -> str:
    """Resolve enabled SkillReferences and return the prompt block.

    Returns "" when nothing resolves so callers can decide whether to add a
    section header.
    """
    enabled = [ref for ref in references if ref.enabled]
    if not enabled:
        return ""
    rendered: list[str] = []
    for ref in enabled:
        document = _resolve_reference(skills, ref)
        if document is None:
            continue
        sections = _sections_for_prompt(document.body, provider, role)
        if not sections:
            continue
        rendered.append(
            "[" + document.metadata.name + "]\n" + "\n\n".join(sections)
        )
    return "\n\n".join(rendered)


def _resolve_reference(
    skills: list[SkillDocument], reference: SkillReference
) -> SkillDocument | None:
    candidates = [
        doc
        for doc in skills
        if doc.metadata.id == reference.id and doc.source == reference.source
    ]
    if not candidates:
        return None
    return _select_version(candidates, reference.version_requirement)


def _select_version(
    candidates: list[SkillDocument],
    requirement: SkillVersionRequirement,
) -> SkillDocument | None:
    if requirement.kind == "exact":
        target = (requirement.version or "").strip()
        for doc in candidates:
            if doc.metadata.version == target:
                return doc
        return None
    # latest / latest_compatible: simple lexicographic max for now.
    return max(candidates, key=lambda doc: doc.metadata.version)


def _sections_for_prompt(
    body: str, provider: str, role: str
) -> list[str]:
    common, sections = _parse_sections(body)
    result: list[str] = []
    if common.strip():
        result.append(common.strip())
    provider_key = f"provider: {provider}".lower()
    section = sections.get(provider_key, "").strip()
    if section:
        result.append(f"Provider {provider}:\n{section}")
    role_key = f"role: {role}".lower()
    role_section = sections.get(role_key, "").strip()
    if role_section:
        result.append(f"Role {role}:\n{role_section}")
    return result


def _parse_sections(body: str) -> tuple[str, dict[str, str]]:
    common_lines: list[str] = []
    sections: dict[str, list[str]] = {}
    current_key: str | None = None
    for line in body.replace("\r\n", "\n").split("\n"):
        if line.startswith("## "):
            heading = line[3:].strip().lower()
            if heading.startswith("provider: ") or heading.startswith("role: "):
                current_key = heading
                sections.setdefault(current_key, [])
                continue
        if current_key:
            sections.setdefault(current_key, []).append(line)
        else:
            common_lines.append(line)
    return (
        "\n".join(common_lines),
        {key: "\n".join(value) for key, value in sections.items()},
    )
