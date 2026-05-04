from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator

from app.skills.models import SkillReference


MAX_CUSTOM_AGENTS = 5
MAX_ROUNDS = 5


class OrgRole(str, Enum):
    CEO = "ceo"
    MANAGER = "manager"
    WORKER = "worker"
    PMO = "pmo"
    QA = "qa"
    UI_DESIGNER = "ui_designer"
    SYSTEM_DESIGNER = "system_designer"
    OPS_DESIGNER = "ops_designer"
    OTHER = "other"


class WorkflowMode(str, Enum):
    WRITING = "writing"
    CODING = "coding"


class OrchestrationMode(str, Enum):
    SEQUENTIAL = "sequential"
    ROLE_BASED = "role_based"
    DEPENDENCY_GRAPH = "dependency_graph"


class ProviderKind(str, Enum):
    GEMINI_CLI = "gemini_cli"
    CLAUDE_CLI = "claude_cli"
    CODEX_CLI = "codex_cli"
    OPENAI_API = "openai_api"
    ANTHROPIC_API = "anthropic_api"
    OLLAMA = "ollama"
    LM_STUDIO = "lm_studio"
    CUSTOM_CLI = "custom_cli"


class AgentConfig(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=64)
    org_role: OrgRole = OrgRole.WORKER
    provider: ProviderKind
    persona: str = Field(default="", max_length=2000)
    skills: list[str] = Field(default_factory=list)
    skill_refs: list[SkillReference] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)
    command_template: str | None = Field(default=None, max_length=2000)
    model: str | None = Field(default=None, max_length=100)
    mcp_enabled: bool = False
    mcp_config_path: str | None = Field(default=None, max_length=500)
    mcp_servers: list[str] = Field(default_factory=list)
    mcp_instruction: str = Field(default="", max_length=3000)
    mcp_context_command: str | None = Field(default=None, max_length=2000)
    mcp_timeout_sec: int = Field(default=60, ge=5, le=600)
    is_custom: bool = False

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_mode(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data
        if "org_role" in data:
            return data
        legacy_mode = data.get("mode")
        if legacy_mode is None:
            return data
        migrated = dict(data)
        migrated["org_role"] = legacy_mode
        return migrated

    @field_validator("skills")
    @classmethod
    def validate_skills(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        if len(cleaned) > 20:
            raise ValueError("skills can contain at most 20 entries")
        return cleaned

    @field_validator("depends_on")
    @classmethod
    def validate_depends_on(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        unique: list[str] = []
        seen: set[str] = set()
        for dep in cleaned:
            if dep in seen:
                continue
            seen.add(dep)
            unique.append(dep)
        if len(unique) > 20:
            raise ValueError("depends_on can contain at most 20 entries")
        return unique

    @field_validator("mcp_servers")
    @classmethod
    def validate_mcp_servers(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        unique: list[str] = []
        seen: set[str] = set()
        for server in cleaned:
            if server in seen:
                continue
            seen.add(server)
            unique.append(server)
        if len(unique) > 20:
            raise ValueError("mcp_servers can contain at most 20 entries")
        return unique

    @field_validator("mcp_config_path", "mcp_context_command", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = str(value).strip()
        return stripped or None

    @field_validator("org_role", mode="before")
    @classmethod
    def normalize_org_role(cls, value: object) -> object:
        if value is None:
            return OrgRole.WORKER.value
        if isinstance(value, OrgRole):
            return value.value
        raw = str(value).strip().lower()
        legacy_map = {
            "writer": OrgRole.WORKER.value,
            "reviewer": OrgRole.QA.value,
            "editor": OrgRole.MANAGER.value,
        }
        return legacy_map.get(raw, raw)


class CodeContext(BaseModel):
    repository: str = Field(default="", max_length=300)
    working_directory: str = Field(default="", max_length=500)
    target_paths: list[str] = Field(default_factory=list)
    tech_stack: str = Field(default="", max_length=3000)
    acceptance_criteria: str = Field(default="", max_length=5000)
    test_command: str = Field(default="", max_length=500)

    @field_validator("target_paths")
    @classmethod
    def validate_target_paths(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        if len(cleaned) > 50:
            raise ValueError("target_paths can contain at most 50 entries")
        for item in cleaned:
            if len(item) > 300:
                raise ValueError("each target path must be <= 300 chars")
        return cleaned


class RefineRequest(BaseModel):
    workflow_mode: WorkflowMode = WorkflowMode.WRITING
    orchestration_mode: OrchestrationMode = OrchestrationMode.SEQUENTIAL
    source_text: str = Field(min_length=1, max_length=30000)
    objective: str = Field(default="", max_length=3000)
    global_instruction: str = Field(default="", max_length=3000)
    code_context: CodeContext = Field(default_factory=CodeContext)
    rounds: int = Field(default=1, ge=1, le=MAX_ROUNDS)
    agents: list[AgentConfig] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def validate_agents(self) -> "RefineRequest":
        custom_count = sum(1 for agent in self.agents if agent.is_custom)
        if custom_count > MAX_CUSTOM_AGENTS:
            raise ValueError(f"custom agents must be <= {MAX_CUSTOM_AGENTS}")

        agent_ids = {agent.id for agent in self.agents}
        if len(agent_ids) != len(self.agents):
            raise ValueError("agent ids must be unique")

        deps_map = {agent.id: set(agent.depends_on) for agent in self.agents}
        for agent in self.agents:
            unknown = [dep for dep in agent.depends_on if dep not in agent_ids]
            if unknown:
                raise ValueError(
                    f"agent '{agent.id}' has unknown dependencies: {', '.join(unknown)}"
                )
            if agent.id in deps_map[agent.id]:
                raise ValueError(f"agent '{agent.id}' cannot depend on itself")

        if self.orchestration_mode == OrchestrationMode.DEPENDENCY_GRAPH:
            indegree: dict[str, int] = {agent_id: 0 for agent_id in agent_ids}
            reverse: dict[str, set[str]] = {agent_id: set() for agent_id in agent_ids}
            for agent_id, deps in deps_map.items():
                indegree[agent_id] = len(deps)
                for dep in deps:
                    reverse[dep].add(agent_id)

            ready = [agent_id for agent_id, deg in indegree.items() if deg == 0]
            visited = 0
            while ready:
                current = ready.pop()
                visited += 1
                for nxt in reverse[current]:
                    indegree[nxt] -= 1
                    if indegree[nxt] == 0:
                        ready.append(nxt)

            if visited != len(agent_ids):
                raise ValueError("dependency_graph has a cycle in depends_on")
        return self


class TurnResult(BaseModel):
    agent_id: str
    agent_name: str
    org_role: OrgRole
    provider: ProviderKind
    output: str
    error: str | None = None
    file_changes: str | None = None
    mcp_enabled: bool = False
    mcp_context_used: bool = False
    mcp_context_error: str | None = None


class RoundResult(BaseModel):
    round_index: int
    turns: list[TurnResult]
    draft_after_round: str


class RefineResponse(BaseModel):
    final_text: str
    rounds: list[RoundResult]
    diff: str
    file_changes: str = ""
