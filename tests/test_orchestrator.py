from app.models import (
    AgentConfig,
    CodeContext,
    OrchestrationMode,
    ProviderKind,
    RefineRequest,
    WorkflowMode,
)
import app.orchestrator as orchestrator


class DummyProvider:
    def __init__(self, output: str, prompts: list[str]) -> None:
        self.output = output
        self.prompts = prompts

    def generate(
        self,
        *,
        prompt: str,
        model: str | None = None,
        cwd: str | None = None,
        mcp_config_path: str | None = None,
        mcp_servers: list[str] | None = None,
    ) -> str:
        self.prompts.append(prompt)
        return self.output


def test_local_llm_coding_with_working_dir_returns_diff_proposal(monkeypatch, tmp_path):
    prompts: list[str] = []

    def fake_resolve_provider(**kwargs):
        return DummyProvider("変更概要\nlocal diff proposal\nCodex向け指示\nDo the small fix.", prompts)

    monkeypatch.setattr(orchestrator, "resolve_provider", fake_resolve_provider)

    request = RefineRequest(
        workflow_mode=WorkflowMode.CODING,
        orchestration_mode=OrchestrationMode.SEQUENTIAL,
        source_text="Fix the login validation bug.",
        objective="Create a small patch proposal.",
        code_context=CodeContext(
            working_directory=str(tmp_path),
            target_paths=["LoginViewModel.swift"],
            test_command="swift test",
        ),
        agents=[
            AgentConfig(
                id="local-coder",
                name="Local Coder",
                org_role="worker",
                provider=ProviderKind.LM_STUDIO,
                model="qwen2.5-coder-3b-instruct",
            )
        ],
    )

    result = orchestrator.run_refinement(request)

    assert "local diff proposal" in result.final_text
    assert result.file_changes == ""
    assert prompts
    assert "直接ファイルを書き換えられません" in prompts[0]
    assert "diff案" in prompts[0]


def test_agent_persona_is_embedded_as_behavior_instruction(monkeypatch):
    prompts: list[str] = []

    def fake_resolve_provider(**kwargs):
        return DummyProvider("done", prompts)

    monkeypatch.setattr(orchestrator, "resolve_provider", fake_resolve_provider)

    request = RefineRequest(
        workflow_mode=WorkflowMode.WRITING,
        orchestration_mode=OrchestrationMode.SEQUENTIAL,
        source_text="相談内容",
        agents=[
            AgentConfig(
                id="mako",
                name="まこ",
                org_role="worker",
                provider=ProviderKind.LM_STUDIO,
                persona="短く明確に答える。",
            )
        ],
    )

    orchestrator.run_refinement(request)

    assert prompts
    assert "人格・振る舞い指示" in prompts[0]
    assert "以下のペルソナを会話全体で維持してください。" in prompts[0]
    assert "短く明確に答える。" in prompts[0]


def test_debate_request_prompts_agents_to_respond_from_their_viewpoint(monkeypatch):
    prompts: list[str] = []

    def fake_resolve_provider(**kwargs):
        return DummyProvider("debate output", prompts)

    monkeypatch.setattr(orchestrator, "resolve_provider", fake_resolve_provider)

    request = RefineRequest(
        workflow_mode=WorkflowMode.WRITING,
        orchestration_mode=OrchestrationMode.ROLE_BASED,
        source_text="新機能を入れるべきか検討したい",
        objective="ディベートして、各エージェントの観点から賛否と判断材料をまとめる",
        global_instruction="反論と合意点を分けてください。",
        agents=[
            AgentConfig(
                id="manager",
                name="Manager",
                org_role="manager",
                provider=ProviderKind.LM_STUDIO,
            )
        ],
    )

    orchestrator.run_refinement(request)

    assert prompts
    assert "自分のロールの観点" in prompts[0]
    assert "他エージェントの出力" in prompts[0]
    assert "反論" in prompts[0]
