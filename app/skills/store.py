"""Skill Library and Candidate storage."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from app.skills.models import CandidateBatch, SkillDocument, SkillMetadata, SkillSource
from app.skills.parser import SkillParseError, build_skill_document, parse_skill_markdown


class SkillStoreError(Exception):
    pass


@dataclass
class _LibraryIndex:
    id: str
    name: str
    source: SkillSource
    installed_versions: list[str]
    latest_installed_version: str

    def to_json(self) -> dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "source": self.source.value,
            "installedVersions": self.installed_versions,
            "latestInstalledVersion": self.latest_installed_version,
        }


class SkillStore:
    """File-backed Skill library compatible with the Mac app layout.

    Layout::

        <base>/skills/library/<id>/index.json
        <base>/skills/library/<id>/versions/<version>/SKILL.md
        <base>/skills/candidates/<batch_id>/<skill_id>/SKILL.md
    """

    def __init__(self, base_directory: Path | str | None = None) -> None:
        if base_directory is None:
            base_directory = Path.home() / ".agent-refinement"
        self.base_directory = Path(base_directory)

    @property
    def library_dir(self) -> Path:
        return self.base_directory / "skills" / "library"

    @property
    def candidates_dir(self) -> Path:
        return self.base_directory / "skills" / "candidates"

    # -- Library ---------------------------------------------------------

    def load_installed_skills(self) -> list[SkillDocument]:
        if not self.library_dir.exists():
            return []
        skills: list[SkillDocument] = []
        for skill_dir in sorted(self.library_dir.iterdir()):
            if not skill_dir.is_dir():
                continue
            versions_dir = skill_dir / "versions"
            if not versions_dir.exists():
                continue
            for version_dir in sorted(versions_dir.iterdir()):
                skill_file = version_dir / "SKILL.md"
                if not skill_file.exists():
                    continue
                markdown = skill_file.read_text(encoding="utf-8")
                skills.append(
                    build_skill_document(
                        markdown=markdown,
                        source=self._source_for(skill_dir.name),
                        root_directory=str(version_dir),
                    )
                )
        skills.sort(key=lambda doc: doc.metadata.name.casefold())
        return skills

    def install_skill_markdown(
        self, markdown: str, source: SkillSource = SkillSource.USER
    ) -> SkillDocument:
        parsed = build_skill_document(markdown=markdown, source=source, root_directory=None)
        version_dir = (
            self.library_dir
            / parsed.metadata.id
            / "versions"
            / parsed.metadata.version
        )
        version_dir.mkdir(parents=True, exist_ok=True)
        (version_dir / "SKILL.md").write_text(markdown, encoding="utf-8")
        self._merge_index(parsed, source)
        return build_skill_document(
            markdown=markdown,
            source=source,
            root_directory=str(version_dir),
        )

    def remove_skill(self, skill_id: str) -> None:
        skill_dir = self.library_dir / skill_id
        if skill_dir.exists():
            _rmtree(skill_dir)

    def remove_skill_version(self, skill_id: str, version: str) -> None:
        version_dir = self.library_dir / skill_id / "versions" / version
        if version_dir.exists():
            _rmtree(version_dir)
        versions_dir = self.library_dir / skill_id / "versions"
        if not versions_dir.exists():
            return
        remaining = sorted(
            (entry.name for entry in versions_dir.iterdir() if entry.is_dir()),
            reverse=True,
        )
        if not remaining:
            self.remove_skill(skill_id)
            return
        self._update_index(skill_id, remaining)

    # -- Candidates ------------------------------------------------------

    def load_candidates(self) -> list[CandidateBatch]:
        if not self.candidates_dir.exists():
            return []
        batches: list[CandidateBatch] = []
        for batch_dir in sorted(self.candidates_dir.iterdir()):
            if not batch_dir.is_dir():
                continue
            skills: list[SkillDocument] = []
            for skill_dir in sorted(batch_dir.iterdir()):
                skill_file = skill_dir / "SKILL.md"
                if not skill_file.exists():
                    continue
                markdown = skill_file.read_text(encoding="utf-8")
                skills.append(
                    build_skill_document(
                        markdown=markdown,
                        source=SkillSource.DISCOVERED,
                        root_directory=str(skill_dir),
                    )
                )
            if not skills:
                continue
            skills.sort(key=lambda doc: doc.metadata.name.casefold())
            batches.append(
                CandidateBatch(
                    id=batch_dir.name,
                    directory=str(batch_dir),
                    skills=skills,
                )
            )
        return batches

    def import_local_directory_as_candidates(
        self, source_directory: Path | str
    ) -> list[SkillDocument]:
        source_path = Path(source_directory)
        if not source_path.exists():
            raise SkillStoreError(f"source directory not found: {source_path}")
        skill_files = [path for path in source_path.rglob("SKILL.md") if path.is_file()]
        if not skill_files:
            return []
        batch_dir = self.candidates_dir / f"local-{_timestamp()}"
        batch_dir.mkdir(parents=True, exist_ok=True)
        results: list[SkillDocument] = []
        for skill_file in skill_files:
            markdown = skill_file.read_text(encoding="utf-8")
            parsed = build_skill_document(
                markdown=markdown,
                source=SkillSource.DISCOVERED,
                root_directory=str(skill_file.parent),
            )
            target_dir = batch_dir / parsed.metadata.id
            target_dir.mkdir(parents=True, exist_ok=True)
            (target_dir / "SKILL.md").write_text(markdown, encoding="utf-8")
            results.append(
                build_skill_document(
                    markdown=markdown,
                    source=SkillSource.DISCOVERED,
                    root_directory=str(target_dir),
                )
            )
        results.sort(key=lambda doc: doc.metadata.name.casefold())
        return results

    def discover_directory_skills(
        self, source_directory: Path | str
    ) -> list[SkillDocument]:
        source_path = Path(source_directory).expanduser()
        if not source_path.exists() or not source_path.is_dir():
            return []
        skill_files = [path for path in source_path.rglob("SKILL.md") if path.is_file()]
        results: list[SkillDocument] = []
        for skill_file in skill_files:
            try:
                markdown = skill_file.read_text(encoding="utf-8")
                results.append(
                    build_skill_document(
                        markdown=markdown,
                        source=SkillSource.IMPORTED,
                        root_directory=str(skill_file.parent),
                    )
                )
            except OSError:
                continue
            except SkillParseError:
                parsed = parse_skill_markdown(markdown)
                derived_id = skill_file.parent.name.strip() or "skill"
                name = (parsed.front_matter.get("name") or derived_id).strip() or derived_id
                version = (parsed.front_matter.get("version") or "0.0.0").strip() or "0.0.0"
                description = (parsed.front_matter.get("description") or "").strip()
                results.append(
                    SkillDocument(
                        metadata=SkillMetadata(
                            id=derived_id,
                            name=name,
                            version=version,
                            description=description,
                            providers=parsed.array_value("providers"),
                            roles=parsed.array_value("roles"),
                            tags=parsed.array_value("tags"),
                        ),
                        source=SkillSource.IMPORTED,
                        markdown=markdown,
                        body=parsed.body,
                        root_directory=str(skill_file.parent),
                    )
                )
        results.sort(key=lambda doc: doc.metadata.name.casefold())
        return results

    def import_markdown_as_candidate(
        self,
        markdown: str,
        *,
        batch_prefix: str = "external",
        source_directory: str = "external",
    ) -> SkillDocument:
        parsed = build_skill_document(
            markdown=markdown,
            source=SkillSource.DISCOVERED,
            root_directory=source_directory,
        )
        safe_prefix = "".join(
            ch for ch in batch_prefix.lower() if ch.isalnum() or ch in {"-", "_"}
        )[:24] or "external"
        batch_dir = self.candidates_dir / f"{safe_prefix}-{_timestamp()}"
        target_dir = batch_dir / parsed.metadata.id
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / "SKILL.md").write_text(markdown, encoding="utf-8")
        return build_skill_document(
            markdown=markdown,
            source=SkillSource.DISCOVERED,
            root_directory=str(target_dir),
        )

    def approve_candidate(
        self,
        skill_id: str,
        batch_id: str,
        source: SkillSource = SkillSource.USER,
    ) -> SkillDocument:
        candidate_path = (
            self.candidates_dir / batch_id / skill_id / "SKILL.md"
        )
        if not candidate_path.exists():
            raise SkillStoreError(
                f"candidate '{skill_id}' not found in batch '{batch_id}'"
            )
        markdown = candidate_path.read_text(encoding="utf-8")
        installed = self.install_skill_markdown(markdown, source=source)
        candidate_dir = candidate_path.parent
        if candidate_dir.exists():
            _rmtree(candidate_dir)
        return installed

    def discard_candidate(self, skill_id: str, batch_id: str) -> None:
        candidate_dir = self.candidates_dir / batch_id / skill_id
        if candidate_dir.exists():
            _rmtree(candidate_dir)

    # -- Internal --------------------------------------------------------

    def _source_for(self, skill_id: str) -> SkillSource:
        index_path = self.library_dir / skill_id / "index.json"
        if not index_path.exists():
            return SkillSource.USER
        try:
            data = json.loads(index_path.read_text(encoding="utf-8"))
            value = data.get("source")
            if isinstance(value, str):
                try:
                    return SkillSource(value)
                except ValueError:
                    return SkillSource.USER
        except (OSError, json.JSONDecodeError):
            pass
        return SkillSource.USER

    def _merge_index(self, document: SkillDocument, source: SkillSource) -> None:
        index_path = self.library_dir / document.metadata.id / "index.json"
        index_path.parent.mkdir(parents=True, exist_ok=True)
        existing_versions: set[str] = {document.metadata.version}
        existing_name = document.metadata.name
        existing_source = source
        if index_path.exists():
            try:
                raw = json.loads(index_path.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    versions = raw.get("installedVersions")
                    if isinstance(versions, list):
                        existing_versions.update(
                            v for v in versions if isinstance(v, str)
                        )
                    name = raw.get("name")
                    if isinstance(name, str) and name:
                        existing_name = name
                    raw_source = raw.get("source")
                    if isinstance(raw_source, str):
                        try:
                            existing_source = SkillSource(raw_source)
                        except ValueError:
                            pass
            except (OSError, json.JSONDecodeError):
                pass
        sorted_versions = sorted(existing_versions, reverse=True)
        index = _LibraryIndex(
            id=document.metadata.id,
            name=existing_name,
            source=existing_source,
            installed_versions=sorted_versions,
            latest_installed_version=sorted_versions[0]
            if sorted_versions
            else document.metadata.version,
        )
        index_path.write_text(
            json.dumps(index.to_json(), ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )

    def _update_index(self, skill_id: str, versions: list[str]) -> None:
        index_path = self.library_dir / skill_id / "index.json"
        if not index_path.exists():
            return
        try:
            raw = json.loads(index_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        sorted_versions = sorted(versions, reverse=True)
        raw["installedVersions"] = sorted_versions
        raw["latestInstalledVersion"] = sorted_versions[0] if sorted_versions else ""
        index_path.write_text(
            json.dumps(raw, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )


def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S")


def _rmtree(path: Path) -> None:
    if path.is_file() or path.is_symlink():
        path.unlink()
        return
    for child in path.iterdir():
        _rmtree(child)
    try:
        path.rmdir()
    except OSError:
        pass
