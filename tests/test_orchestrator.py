from app.models import (
    AgentConfig,
    CodeContext,
    KnowledgeContextItem,
    OrchestrationMode,
    ProviderKind,
    RefineRequest,
    WorkflowMode,
)
import app.orchestrator as orchestrator
import subprocess


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


def test_direct_edit_coding_without_file_changes_keeps_agent_output(monkeypatch, tmp_path):
    prompts: list[str] = []

    def fake_resolve_provider(**kwargs):
        return DummyProvider("実装方針\nファイル変更なしで方針を返します。", prompts)

    monkeypatch.setattr(orchestrator, "resolve_provider", fake_resolve_provider)

    request = RefineRequest(
        workflow_mode=WorkflowMode.CODING,
        orchestration_mode=OrchestrationMode.SEQUENTIAL,
        source_text="SwiftでTODOリストを作る。",
        code_context=CodeContext(
            working_directory=str(tmp_path),
            target_paths=["Todo.swift"],
        ),
        agents=[
            AgentConfig(
                id="codex-worker",
                name="Codex Worker",
                org_role="worker",
                provider=ProviderKind.CODEX_CLI,
            )
        ],
    )

    result = orchestrator.run_refinement(request)

    assert "ファイル変更なしで方針を返します。" in result.final_text
    assert result.file_changes == ""


def test_capture_git_diff_is_limited_to_selected_working_directory(tmp_path):
    subprocess.run(["git", "init"], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(
        ["git", "config", "user.email", "test@example.com"],
        cwd=tmp_path,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "config", "user.name", "Test"],
        cwd=tmp_path,
        check=True,
        capture_output=True,
    )
    nested = tmp_path / "Workspace" / "test"
    nested.mkdir(parents=True)
    root_file = tmp_path / "README.md"
    nested_file = nested / "Todo.swift"
    root_file.write_text("root\n", encoding="utf-8")
    nested_file.write_text("old\n", encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "initial"], cwd=tmp_path, check=True, capture_output=True)

    root_file.write_text("root changed\n", encoding="utf-8")
    nested_file.write_text("new\n", encoding="utf-8")
    (nested / "NewFile.swift").write_text("struct NewFile {}\n", encoding="utf-8")

    diff = orchestrator._capture_git_diff(str(nested))
    staged = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        cwd=tmp_path,
        check=True,
        capture_output=True,
        text=True,
    ).stdout

    assert "Todo.swift" in diff
    assert "NewFile.swift" in diff
    assert "README.md" not in diff
    assert staged == ""


def test_coding_request_allows_larger_custom_team(tmp_path):
    agents = [
        AgentConfig(
            id=f"custom-{index}",
            name=f"Custom {index}",
            org_role="worker",
            provider=ProviderKind.LM_STUDIO,
            is_custom=True,
        )
        for index in range(7)
    ]

    request = RefineRequest(
        workflow_mode=WorkflowMode.CODING,
        source_text="SwiftでTODOリストを作る。",
        code_context=CodeContext(working_directory=str(tmp_path)),
        agents=agents,
    )

    assert len(request.agents) == 7


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


def test_research_context_is_only_embedded_for_allowed_agent(monkeypatch):
    prompts: list[str] = []

    class SequenceProvider:
        def generate(self, prompt: str, **kwargs) -> str:
            prompts.append(prompt)
            return "done"

    def fake_resolve_provider(**kwargs):
        return SequenceProvider()

    monkeypatch.setattr(orchestrator, "resolve_provider", fake_resolve_provider)

    request = RefineRequest(
        workflow_mode=WorkflowMode.WRITING,
        orchestration_mode=OrchestrationMode.SEQUENTIAL,
        source_text="SwiftUIの最新仕様を確認して議論したい",
        agents=[
            AgentConfig(
                id="researcher",
                name="Researcher",
                org_role="worker",
                provider=ProviderKind.LM_STUDIO,
                allow_web_search=True,
                research_sources=[
                    "https://developer.apple.com/documentation/swiftui",
                    "https://swift.org/documentation/",
                ],
                max_search_results=3,
                require_citations=True,
            ),
            AgentConfig(
                id="offline",
                name="Offline",
                org_role="qa",
                provider=ProviderKind.LM_STUDIO,
                allow_web_search=False,
                research_sources=["https://example.com/should-not-appear"],
            ),
        ],
    )

    orchestrator.run_refinement(request)

    assert len(prompts) == 2
    assert "Research Context" in prompts[0]
    assert "developer.apple.com/documentation/swiftui" in prompts[0]
    assert "swift.org/documentation" in prompts[0]
    assert "最大検索件数: 3" in prompts[0]
    assert "参照URLを回答に残す" in prompts[0]
    assert "Research Context" not in prompts[1]
    assert "should-not-appear" not in prompts[1]


def test_allowed_agent_fetches_registered_research_sources(monkeypatch):
    prompts: list[str] = []

    class SequenceProvider:
        def generate(self, prompt: str, **kwargs) -> str:
            prompts.append(prompt)
            return "researched output"

    def fake_resolve_provider(**kwargs):
        return SequenceProvider()

    def fake_fetch_research_sources(sources, *, max_results):
        assert sources == ["https://developer.apple.com/documentation/swiftui"]
        assert max_results == 1
        return [
            orchestrator.ResearchSourceResult(
                source="https://developer.apple.com/documentation/swiftui",
                url="https://developer.apple.com/documentation/swiftui",
                title="SwiftUI Documentation",
                snippet="SwiftUI helps you build interfaces across Apple platforms.",
            )
        ]

    monkeypatch.setattr(orchestrator, "resolve_provider", fake_resolve_provider)
    monkeypatch.setattr(orchestrator, "fetch_research_sources", fake_fetch_research_sources)

    request = RefineRequest(
        workflow_mode=WorkflowMode.WRITING,
        orchestration_mode=OrchestrationMode.SEQUENTIAL,
        source_text="SwiftUIの最新仕様を確認して議論したい",
        agents=[
            AgentConfig(
                id="researcher",
                name="Researcher",
                org_role="worker",
                provider=ProviderKind.LM_STUDIO,
                allow_web_search=True,
                research_sources=["https://developer.apple.com/documentation/swiftui"],
                max_search_results=1,
            )
        ],
    )

    result = orchestrator.run_refinement(request)

    assert "SwiftUI Documentation" in prompts[0]
    assert "SwiftUI helps you build interfaces" in prompts[0]
    turn = result.rounds[0].turns[0]
    assert turn.research_context_used is True
    assert turn.research_results[0].title == "SwiftUI Documentation"


def test_debate_request_prompts_agents_to_react_instead_of_siloing(monkeypatch):
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
    assert "縦割りコメントは禁止" in prompts[0]
    assert "他エージェントの主張に必ず反応" in prompts[0]
    assert "同意" in prompts[0]
    assert "反論" in prompts[0]
    assert "補強" in prompts[0]
    assert "目的に照らして" in prompts[0]
    assert "ユーザー確認前に最終決定" in prompts[0]


def test_discussion_carries_previous_round_outputs_into_next_round(monkeypatch):
    prompts: list[str] = []

    class SequenceProvider:
        def generate(self, prompt: str, **kwargs) -> str:
            prompts.append(prompt)
            return f"agent-output-{len(prompts)}"

    def fake_resolve_provider(**kwargs):
        return SequenceProvider()

    monkeypatch.setattr(orchestrator, "resolve_provider", fake_resolve_provider)

    request = RefineRequest(
        workflow_mode=WorkflowMode.WRITING,
        orchestration_mode=OrchestrationMode.SEQUENTIAL,
        rounds=2,
        source_text="新機能を入れるべきか検討したい",
        objective="議論して、合意点と未決点をまとめる",
        global_instruction="縦割りではなく会話として進めてください。",
        agents=[
            AgentConfig(
                id="ceo",
                name="CEO",
                org_role="ceo",
                provider=ProviderKind.LM_STUDIO,
            ),
            AgentConfig(
                id="manager",
                name="Manager",
                org_role="manager",
                provider=ProviderKind.LM_STUDIO,
            ),
        ],
    )

    orchestrator.run_refinement(request)

    assert len(prompts) == 4
    assert "議論履歴" in prompts[2]
    assert "agent-output-1" in prompts[2]
    assert "agent-output-2" in prompts[2]


def test_knowledge_context_is_embedded_without_raw_image_data(monkeypatch):
    prompts: list[str] = []

    def fake_resolve_provider(**kwargs):
        return DummyProvider("knowledge output", prompts)

    monkeypatch.setattr(orchestrator, "resolve_provider", fake_resolve_provider)

    image_data = "data:image/png;base64," + ("a" * 100)
    request = RefineRequest(
        workflow_mode=WorkflowMode.WRITING,
        source_text="SwiftUIの設計を相談したい",
        knowledge_context=[
            KnowledgeContextItem(
                id="swift-md",
                title="Swift Guidelines",
                kind="markdown",
                content="# Swift\nUse small views.",
                source="docs/swift.md",
                tags=["swift"],
            ),
            KnowledgeContextItem(
                id="screen",
                title="screen.png",
                kind="image",
                content=image_data,
                content_type="image/png",
            ),
        ],
        agents=[
            AgentConfig(
                id="reviewer",
                name="Reviewer",
                org_role="qa",
                provider=ProviderKind.LM_STUDIO,
            )
        ],
    )

    orchestrator.run_refinement(request)

    assert "Knowledge Context" in prompts[0]
    assert "Swift Guidelines" in prompts[0]
    assert "Use small views." in prompts[0]
    assert "screen.png" in prompts[0]
    assert image_data not in prompts[0]
