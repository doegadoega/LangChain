from app.models import (
    AgentConfig,
    CodeContext,
    OrgRole,
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
