"""SKILL.md parser.

Reads a `---` delimited YAML-subset front matter and returns the body for
section-level rendering by the resolver.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.skills.models import SkillDocument, SkillMetadata, SkillSource


class SkillParseError(ValueError):
    pass


@dataclass
class ParsedSkillMarkdown:
    front_matter: dict[str, str] = field(default_factory=dict)
    body: str = ""

    def array_value(self, key: str) -> list[str]:
        raw = self.front_matter.get(key)
        if raw is None:
            return []
        return _parse_array(raw)


def parse_skill_markdown(markdown: str) -> ParsedSkillMarkdown:
    """Parse front matter from a SKILL.md string.

    Format:

        ---
        id: my-skill
        version: 1.0.0
        providers: [openai_api, codex_cli]
        ---
        body...
    """
    text = markdown.replace("\r\n", "\n")
    if not text.startswith("---\n"):
        return ParsedSkillMarkdown(body=text)
    rest = text[4:]
    end = rest.find("\n---\n")
    if end == -1:
        return ParsedSkillMarkdown(body=text)
    front_matter_text = rest[:end]
    body = rest[end + len("\n---\n") :]
    return ParsedSkillMarkdown(
        front_matter=_parse_front_matter(front_matter_text),
        body=body,
    )


def build_skill_document(
    markdown: str, source: SkillSource, root_directory: str | None
) -> SkillDocument:
    parsed = parse_skill_markdown(markdown)
    skill_id = (parsed.front_matter.get("id") or "").strip()
    if not skill_id:
        raise SkillParseError("SKILL.md is missing required field: id")
    name = (parsed.front_matter.get("name") or skill_id).strip() or skill_id
    version = (parsed.front_matter.get("version") or "0.0.0").strip() or "0.0.0"
    description = (parsed.front_matter.get("description") or "").strip()
    metadata = SkillMetadata(
        id=skill_id,
        name=name,
        version=version,
        description=description,
        providers=parsed.array_value("providers"),
        roles=parsed.array_value("roles"),
        tags=parsed.array_value("tags"),
    )
    return SkillDocument(
        metadata=metadata,
        source=source,
        markdown=markdown,
        body=parsed.body,
        root_directory=root_directory,
    )


def _parse_front_matter(text: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in text.split("\n"):
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        if not key:
            continue
        result[key] = value.strip()
    return result


def _parse_array(raw: str) -> list[str]:
    trimmed = raw.strip()
    if trimmed.startswith("[") and trimmed.endswith("]"):
        trimmed = trimmed[1:-1]
    parts = [item.strip().strip("\"'") for item in trimmed.split(",")]
    return [item for item in parts if item]
