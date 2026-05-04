"""Skill Package Manager tests (parser / store / resolver / API / orchestrator)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_skill_store
from app.models import AgentConfig, OrgRole, ProviderKind
from app.orchestrator import _build_system_directive
from app.skills import (
    SkillReference,
    SkillSource,
    SkillStore,
    SkillVersionRequirement,
    parse_skill_markdown,
    render_skills,
)
from app.skills.parser import SkillParseError, build_skill_document


# -- Parser ----------------------------------------------------------------


def test_parse_extracts_front_matter_and_body():
    parsed = parse_skill_markdown(
        """---
id: my-skill
name: My Skill
version: 1.0.0
providers: [openai_api, codex_cli]
roles: [worker, qa]
tags: [python, fastapi]
---

Common body.

## Provider: openai_api

Use the API.
"""
    )
    assert parsed.front_matter["id"] == "my-skill"
    assert parsed.array_value("providers") == ["openai_api", "codex_cli"]
    assert parsed.array_value("roles") == ["worker", "qa"]
    assert parsed.array_value("tags") == ["python", "fastapi"]
    assert parsed.body.startswith("\nCommon body.")


def test_parser_handles_missing_front_matter():
    parsed = parse_skill_markdown("# heading\n\ntext")
    assert parsed.front_matter == {}
    assert "heading" in parsed.body


def test_build_skill_document_requires_id():
    with pytest.raises(SkillParseError):
        build_skill_document(
            markdown="---\nname: noid\n---\nbody",
            source=SkillSource.USER,
            root_directory=None,
        )


# -- Store -----------------------------------------------------------------


SAMPLE_SKILL = """---
id: sample-skill
name: Sample Skill
version: 1.2.0
description: example
providers: [openai_api]
roles: [worker]
---

Common guidance.

## Provider: openai_api

Use OpenAI specifics.

## Role: worker

Worker specifics.
"""


def test_install_and_load_skill(tmp_path):
    store = SkillStore(base_directory=tmp_path)
    installed = store.install_skill_markdown(SAMPLE_SKILL, source=SkillSource.USER)
    assert installed.metadata.id == "sample-skill"
    skills = store.load_installed_skills()
    assert len(skills) == 1
    assert skills[0].metadata.version == "1.2.0"
    assert skills[0].source == SkillSource.USER


def test_install_multiple_versions_merges_index(tmp_path):
    store = SkillStore(base_directory=tmp_path)
    for version in ("1.0.0", "1.1.0"):
        store.install_skill_markdown(
            f"---\nid: api-design\nname: API Design\nversion: {version}\n---\nbody {version}\n",
            source=SkillSource.USER,
        )
    skills = store.load_installed_skills()
    versions = {doc.metadata.version for doc in skills}
    assert versions == {"1.0.0", "1.1.0"}


def test_remove_skill_version_updates_index(tmp_path):
    store = SkillStore(base_directory=tmp_path)
    for version in ("1.0.0", "1.1.0"):
        store.install_skill_markdown(
            f"---\nid: api-design\nname: API Design\nversion: {version}\n---\nbody\n",
            source=SkillSource.USER,
        )
    store.remove_skill_version("api-design", "1.0.0")
    skills = store.load_installed_skills()
    versions = [doc.metadata.version for doc in skills]
    assert versions == ["1.1.0"]


def test_import_local_directory_creates_candidates(tmp_path):
    store = SkillStore(base_directory=tmp_path)
    external = tmp_path / "external" / "api-design"
    external.mkdir(parents=True)
    (external / "SKILL.md").write_text(
        "---\nid: api-design\nname: API Design\nversion: 1.0.0\n---\n# API Design\n",
        encoding="utf-8",
    )
    candidates = store.import_local_directory_as_candidates(
        tmp_path / "external"
    )
    assert [doc.metadata.id for doc in candidates] == ["api-design"]
    assert store.load_installed_skills() == []


def test_approve_candidate_moves_to_library(tmp_path):
    store = SkillStore(base_directory=tmp_path)
    external = tmp_path / "external" / "api-design"
    external.mkdir(parents=True)
    (external / "SKILL.md").write_text(
        "---\nid: api-design\nname: API Design\nversion: 1.0.0\n---\nbody\n",
        encoding="utf-8",
    )
    store.import_local_directory_as_candidates(tmp_path / "external")
    batches = store.load_candidates()
    assert batches and batches[0].skills

    batch_id = batches[0].id
    approved = store.approve_candidate(skill_id="api-design", batch_id=batch_id)
    assert approved.metadata.id == "api-design"

    installed = store.load_installed_skills()
    assert [doc.metadata.id for doc in installed] == ["api-design"]


# -- Resolver --------------------------------------------------------------


def test_render_skills_includes_common_provider_role():
    document = build_skill_document(
        markdown=SAMPLE_SKILL,
        source=SkillSource.USER,
        root_directory=None,
    )
    rendered = render_skills(
        skills=[document],
        references=[
            SkillReference(
                id="sample-skill",
                source=SkillSource.USER,
                version_requirement=SkillVersionRequirement(kind="latest"),
            )
        ],
        provider="openai_api",
        role="worker",
    )
    assert "[Sample Skill]" in rendered
    assert "Common guidance." in rendered
    assert "Use OpenAI specifics." in rendered
    assert "Worker specifics." in rendered


def test_render_skills_skips_when_provider_role_unmatched():
    document = build_skill_document(
        markdown=SAMPLE_SKILL,
        source=SkillSource.USER,
        root_directory=None,
    )
    rendered = render_skills(
        skills=[document],
        references=[
            SkillReference(
                id="sample-skill",
                source=SkillSource.USER,
                version_requirement=SkillVersionRequirement(kind="latest"),
            )
        ],
        provider="claude_cli",
        role="qa",
    )
    # common body still resolves
    assert "Common guidance." in rendered
    assert "Use OpenAI specifics." not in rendered
    assert "Worker specifics." not in rendered


def test_render_skills_returns_empty_for_unknown_reference():
    rendered = render_skills(
        skills=[],
        references=[
            SkillReference(
                id="missing",
                source=SkillSource.USER,
                version_requirement=SkillVersionRequirement(kind="latest"),
            )
        ],
        provider="openai_api",
        role="worker",
    )
    assert rendered == ""


# -- Orchestrator integration ---------------------------------------------


def test_system_directive_includes_resolved_skill():
    document = build_skill_document(
        markdown=SAMPLE_SKILL,
        source=SkillSource.USER,
        root_directory=None,
    )
    agent = AgentConfig(
        id="a",
        name="A",
        org_role="worker",
        provider=ProviderKind.OPENAI_API,
        skill_refs=[
            SkillReference(
                id="sample-skill",
                source=SkillSource.USER,
                version_requirement=SkillVersionRequirement(kind="latest"),
            )
        ],
    )
    directive = _build_system_directive(agent, installed_skills=[document])
    assert "インストール済みスキル" in directive
    assert "[Sample Skill]" in directive
    assert "Worker specifics." in directive


def test_system_directive_omits_skills_when_no_refs():
    agent = AgentConfig(
        id="a",
        name="A",
        org_role="worker",
        provider=ProviderKind.OPENAI_API,
    )
    directive = _build_system_directive(agent, installed_skills=[])
    assert "インストール済みスキル" not in directive


def test_legacy_agent_config_accepts_missing_skill_refs():
    agent = AgentConfig.model_validate(
        {
            "id": "legacy",
            "name": "Legacy",
            "org_role": "worker",
            "provider": "claude_cli",
        }
    )
    assert agent.skill_refs == []


# -- API ------------------------------------------------------------------


@pytest.fixture
def api_client(tmp_path):
    store = SkillStore(base_directory=tmp_path)
    app.dependency_overrides[get_skill_store] = lambda: store
    yield TestClient(app), store
    app.dependency_overrides.pop(get_skill_store, None)


def test_api_install_list_and_delete(api_client):
    client, _ = api_client
    resp = client.post(
        "/api/skills/install",
        json={"markdown": SAMPLE_SKILL, "source": "user"},
    )
    assert resp.status_code == 201
    assert resp.json()["metadata"]["id"] == "sample-skill"

    listing = client.get("/api/skills").json()
    assert len(listing) == 1
    assert listing[0]["metadata"]["version"] == "1.2.0"

    delete_resp = client.delete("/api/skills/sample-skill")
    assert delete_resp.status_code == 204
    assert client.get("/api/skills").json() == []


def test_api_candidate_flow(api_client, tmp_path):
    client, _store = api_client
    external = tmp_path / "external" / "api-design"
    external.mkdir(parents=True)
    (external / "SKILL.md").write_text(
        "---\nid: api-design\nname: API Design\nversion: 1.0.0\n---\nbody\n",
        encoding="utf-8",
    )
    import_resp = client.post(
        "/api/skills/candidates/import-local",
        json={"path": str(tmp_path / "external")},
    )
    assert import_resp.status_code == 200
    documents = import_resp.json()
    assert documents[0]["metadata"]["id"] == "api-design"

    list_resp = client.get("/api/skills/candidates")
    assert list_resp.status_code == 200
    batches = list_resp.json()
    assert batches and batches[0]["skills"][0]["metadata"]["id"] == "api-design"

    batch_id = batches[0]["id"]
    approve_resp = client.post(
        f"/api/skills/candidates/{batch_id}/api-design/approve"
    )
    assert approve_resp.status_code == 201
    installed = client.get("/api/skills").json()
    assert installed[0]["metadata"]["id"] == "api-design"
