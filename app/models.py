from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator


MAX_CUSTOM_AGENTS = 5
MAX_ROUNDS = 5


class AgentMode(str, Enum):
    WRITER = "writer"
    REVIEWER = "reviewer"
    EDITOR = "editor"


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
    CUSTOM_CLI = "custom_cli"


class AgentConfig(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=64)
    mode: AgentMode
    provider: ProviderKind
    persona: str = Field(default="", max_length=2000)
    skills: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)
    command_template: str | None = Field(default=None, max_length=2000)
    model: str | None = Field(default=None, max_length=100)
    is_custom: bool = False

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

        if not any(agent.mode == AgentMode.EDITOR for agent in self.agents):
            raise ValueError("at least one editor agent is required")

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
    mode: AgentMode
    provider: ProviderKind
    output: str
    error: str | None = None
    file_changes: str | None = None


class RoundResult(BaseModel):
    round_index: int
    turns: list[TurnResult]
    draft_after_round: str


class RefineResponse(BaseModel):
    final_text: str
    rounds: list[RoundResult]
    diff: str
    file_changes: str = ""
