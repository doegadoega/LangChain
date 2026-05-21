# Skill Management Web/Python Brief

This document summarizes the current Skill Management status and gives Claude Code an implementation brief for the Web/Python app.

## Current Status

### Implemented on Mac/Swift

The Mac app already has a working Skill Package Manager design and implementation.

- `AgentRefinementApp/AgentRefinementApp/Models/Skill.swift`
  - `SkillSource`
  - `SkillVersionRequirement`
  - `SkillReference`
  - `SkillMetadata`
  - `SkillDocument`
  - `SKILL.md` front matter parser
- `AgentRefinementApp/AgentRefinementApp/Services/SkillStore.swift`
  - library storage
  - candidates storage
  - multiple versions
  - local directory import as candidates
  - approve candidate
  - remove skill / remove version
- `AgentRefinementApp/AgentRefinementApp/Engine/SkillPromptRenderer.swift`
  - resolves `SkillReference` into installed `SkillDocument`
  - injects common body plus provider-specific and role-specific sections
- `AgentRefinementApp/AgentRefinementApp/Engine/PromptBuilder.swift`
  - adds rendered installed skills to the system directive
- Tests exist in:
  - `AgentRefinementApp/AgentRefinementAppTests/Services/SkillStoreTests.swift`
  - `AgentRefinementApp/AgentRefinementAppTests/Engine/PromptBuilderTests.swift`
  - `AgentRefinementApp/AgentRefinementAppTests/Models/MasterAgentCodableTests.swift`

### Current Web/Python State

The Web/Python app does not yet have the package-based Skill Manager.

- `app/models.py`
  - `AgentConfig.skills: list[str]` exists.
  - There is no `SkillReference`, `SkillDocument`, `SkillStore`, or candidate model yet.
- `app/orchestrator.py`
  - `_build_system_directive()` only renders `agent.skills` as plain text tags.
  - Installed `SKILL.md` content is not resolved or injected.
- `app/web/src/types.ts`
  - `AgentConfig.skills: string[]` exists.
  - There is no `skillRefs` type yet.
- `app/web/src/screens/AgentStudio.tsx`
  - Skills are edited as free-form strings.
  - There is no Skill Library / Candidate approval UI.
- `docs/TODO.md`
  - The Web/Python Skill Package Manager is listed as pending.

## Goal

Port the Mac Skill Package Manager concept into the Web/Python app first.

Skills should stop being only loose tags. Agents should be able to reference installed Skill packages, and the orchestrator should inject the resolved Skill content into each agent's system prompt at runtime.

Keep backward compatibility:

- Existing `skills: list[str]` remains as tags / lightweight labels.
- New `skill_refs` carries package references.
- Existing saved agents without `skill_refs` must continue to load.

## Target Behavior

1. A `SKILL.md` file can be installed into a local Skill Library.
2. A `SKILL.md` from external/local sources is imported as a Candidate first, not directly installed.
3. The user can approve a Candidate into the Skill Library.
4. Each Agent can reference installed Skills with:
   - skill id
   - source
   - version requirement
   - enabled flag
5. During a run, the orchestrator resolves each enabled `skill_ref` and injects the matching Skill content into the agent system directive.
6. Provider-specific and role-specific sections are included when available.
7. If no matching Skill exists, the run should continue and omit that Skill, while surfacing a warning in logs or API response if practical.

## Data Model

Add Python models equivalent to the Swift implementation.

Suggested names:

- `SkillSource`
  - `bundled`
  - `user`
  - `imported`
  - `discovered`
- `SkillVersionRequirement`
  - `kind: exact | latest_compatible | latest`
  - `version?: str`
- `SkillReference`
  - `id: str`
  - `source: SkillSource`
  - `version_requirement: SkillVersionRequirement`
  - `enabled: bool = True`
- `SkillMetadata`
  - `id`
  - `name`
  - `version`
  - `description`
  - `providers`
  - `roles`
  - `tags`
- `SkillDocument`
  - `metadata`
  - `source`
  - `markdown`
  - `body`
  - `root_directory`
- `CandidateBatch`
  - `id`
  - `directory`
  - `skills`

Extend `AgentConfig`:

```python
skills: list[str] = Field(default_factory=list)
skill_refs: list[SkillReference] = Field(default_factory=list)
```

## Filesystem Layout

Use the same layout as the Mac spec.

```text
~/.agent-refinement/
  skills/
    library/
      <skill-id>/
        index.json
        versions/
          <version>/
            SKILL.md
    candidates/
      <batch-id>/
        <skill-id>/
          SKILL.md
```

For tests, the base directory must be injectable so tests can use a temporary directory.

## Backend Implementation Plan

Create:

- `app/skills/__init__.py`
- `app/skills/models.py`
- `app/skills/parser.py`
- `app/skills/store.py`
- `app/skills/resolver.py`

Required behavior:

- Parse `SKILL.md` front matter.
- Required front matter: `id`.
- Defaults:
  - `name = id`
  - `version = 0.0.0`
  - `description = ""`
  - `providers = []`
  - `roles = []`
  - `tags = []`
- Support array syntax:
  - `[a, b]`
  - `a, b`
- Split prompt body by:
  - `## Provider: <provider>`
  - `## Role: <role>`
- Render common body plus matching provider and role sections.
- Store library versions and update `index.json`.
- Import local directory as candidates by recursively finding `SKILL.md`.
- Approve candidate into library.
- Remove skill and remove skill version.

Integrate into `app/orchestrator.py`:

- Load installed skills once per run.
- For each agent, resolve `agent.skill_refs`.
- Add rendered block after the existing plain `skills` tag list:

```text
インストール済みスキル:
[Skill Name]
...
```

## API Plan

Add endpoints under `/api/skills`.

Minimum useful endpoints:

- `GET /api/skills`
  - list installed Skill documents / metadata
- `POST /api/skills/install`
  - install raw markdown directly as user Skill
- `DELETE /api/skills/{skill_id}`
  - remove all versions
- `DELETE /api/skills/{skill_id}/versions/{version}`
  - remove one version
- `GET /api/skills/candidates`
  - list candidate batches
- `POST /api/skills/candidates/import-local`
  - import local path as candidate batch
- `POST /api/skills/candidates/{batch_id}/{skill_id}/approve`
  - approve candidate
- `DELETE /api/skills/candidates/{batch_id}/{skill_id}`
  - discard candidate

Keep GitHub import and AI discovery out of the first pass unless already easy. They can be added after local import works.

## Web UI Plan

Add Skill management to the Web UI after backend support exists.

Suggested navigation:

- Add `Skill Library` under Settings or Agent Studio.

Screens:

1. Library
   - list installed Skills
   - filter by provider / role / tag
   - view metadata, markdown body, versions
   - delete skill / delete version
2. Candidates
   - list candidate batches
   - preview `SKILL.md`
   - approve
   - discard
3. Agent Studio integration
   - keep existing free-form `skills`
   - add `skill_refs` editor
   - choose installed Skill
   - choose version requirement
   - toggle enabled
   - warn when provider or role does not match the selected agent

## Acceptance Criteria

- Existing agents with only `skills: string[]` still load and run.
- Installing a valid `SKILL.md` creates the expected library directory and index.
- Importing a local directory creates candidates and does not install them automatically.
- Approving a candidate installs it and removes the candidate entry.
- Removing a version updates `index.json`; removing the last version removes the skill.
- An agent with `skill_refs` gets the rendered Skill content in its system prompt.
- Provider and role sections are included only when they match.
- Tests cover parser, store, resolver, API, and orchestrator prompt injection.
- Web build passes after adding `skillRefs` types and UI.

## Suggested Claude Code Prompt

```text
Implement the Web/Python Skill Package Manager using docs/specs/skill-management-web-python-brief.md and docs/specs/skill-package-manager.md as the source of truth.

Scope:
- Backend first.
- Add Python skill models/parser/store/resolver.
- Extend AgentConfig with backward-compatible skill_refs.
- Inject resolved Skill content into app/orchestrator.py system directives.
- Add minimal /api/skills endpoints for installed skills, candidates, install, approve, delete.
- Add focused tests for parser, store, resolver, API, and orchestrator prompt injection.

Constraints:
- Keep existing skills: list[str] behavior.
- Do not break existing saved agents or templates.
- External/local imports must go to candidates first.
- Keep the diff focused.
- Do not implement GitHub import or AI discovery in this pass.

After backend tests pass, add a minimal Web UI:
- Skill Library list/detail.
- Candidate approval list.
- Agent Studio skill_refs editor.
```
