from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from app.evaluation import (
    add_evaluation_to_project,
    create_evaluation,
    get_agent_evaluations_across_projects,
)
from app.models import AgentConfig, RefineRequest, RefineResponse
from app.orchestrator import iter_refinement_events, run_refinement
from app.providers import ProviderError, resolve_provider
from app.store import FileStore


BASE_DIR = Path(__file__).resolve().parent
JSONDict = dict[str, Any]


def get_store() -> FileStore:
    return FileStore()


def _with_id(payload: JSONDict, record_id: str) -> JSONDict:
    return {**payload, "id": record_id}


def _validate_record_id(record_id: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", record_id):
        raise HTTPException(status_code=400, detail="Invalid record id")
    return record_id


def _truncate_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n...(truncated)"


def _safe_text(value: Any, *, max_chars: int) -> str:
    if not isinstance(value, str):
        return ""
    return _truncate_text(value.strip(), max_chars)


def _chat_session_id(agent_id: str) -> str:
    safe_agent_id = re.sub(r"[^A-Za-z0-9_-]", "_", agent_id)[:48] or "agent"
    return f"chat_{safe_agent_id}"


def _extract_duckduckgo_results(html: str, *, limit: int = 5) -> list[JSONDict]:
    pattern = re.compile(
        r'<a[^>]+class="result__a"[^>]+href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>',
        re.DOTALL,
    )
    results: list[JSONDict] = []
    seen: set[str] = set()
    for match in pattern.finditer(html):
        raw_url = match.group("href")
        parsed = urllib.parse.urlparse(raw_url)
        query = urllib.parse.parse_qs(parsed.query)
        url = query.get("uddg", [raw_url])[0]
        title = re.sub(r"<[^>]+>", "", match.group("title"))
        title = re.sub(r"\s+", " ", title).strip()
        if not url.startswith(("http://", "https://")) or url in seen:
            continue
        seen.add(url)
        results.append({"title": title or url, "url": url})
        if len(results) >= limit:
            break
    return results


def _search_web(query: str) -> tuple[list[JSONDict], str | None]:
    if not query.strip():
        return [], None
    url = "https://duckduckgo.com/html/?" + urllib.parse.urlencode({"q": query})
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "AgentRefinementPlatform/0.1"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            html = response.read().decode("utf-8", errors="replace")
        return _extract_duckduckgo_results(html), None
    except Exception as exc:  # pragma: no cover - depends on network
        return [], f"web search unavailable: {exc}"


def _build_chat_prompt(
    *,
    agent: AgentConfig,
    question: str,
    attachments: list[JSONDict],
    sources: list[JSONDict],
    search_error: str | None,
    history: list[JSONDict],
) -> str:
    attachment_block = "\n\n".join(
        f"[{item.get('kind', 'context')}] {item.get('title', '添付')}\n"
        f"{_truncate_text(str(item.get('content', '')), 4000)}"
        for item in attachments
    ) or "なし"
    source_block = "\n".join(
        f"- {source.get('title') or source.get('url')}: {source.get('url')}"
        for source in sources
    ) or "なし"
    history_block = "\n\n".join(
        f"{message.get('role', 'user')}: {_truncate_text(str(message.get('content', '')), 1500)}"
        for message in history[-8:]
    ) or "なし"
    search_note = f"\nWeb検索エラー: {search_error}" if search_error else ""
    return (
        f"あなたは {agent.name} です。\n"
        f"ロール: {agent.org_role.value}\n"
        f"ペルソナ:\n{agent.persona or 'なし'}\n\n"
        "ユーザーと普通のチャットとして会話してください。"
        "専門用語は必要な場合だけ使い、初心者にも分かる説明にしてください。"
        "Web検索結果を使う場合は、回答内で根拠URLに触れてください。\n\n"
        f"直近の会話:\n{history_block}\n\n"
        f"添付コンテキスト:\n{attachment_block}\n\n"
        f"Web検索ソース:\n{source_block}{search_note}\n\n"
        f"ユーザーの質問:\n{question}\n"
    )


def _make_chat_message(
    *,
    role: str,
    content: str,
    agent_id: str | None = None,
    agent_name: str | None = None,
    web_search_enabled: bool = False,
    sources: list[JSONDict] | None = None,
    attachments: list[JSONDict] | None = None,
    error: str | None = None,
) -> JSONDict:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": f"msg_{now.replace(':', '').replace('.', '_')}",
        "role": role,
        "content": content,
        "agent_id": agent_id,
        "agent_name": agent_name,
        "web_search_enabled": web_search_enabled,
        "sources": sources or [],
        "attachments": attachments or [],
        "error": error,
        "created_at": now,
    }


def _find_project_or_404(projects: list[JSONDict], project_id: str) -> JSONDict:
    project = next((project for project in projects if project["id"] == project_id), None)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Agent Refinement Platform", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def home() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/api/refine", response_model=RefineResponse)
def refine(payload: RefineRequest) -> RefineResponse:
    try:
        return run_refinement(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/refine/stream")
def refine_stream(payload: RefineRequest) -> StreamingResponse:
    def event_stream():
        try:
            for event in iter_refinement_events(payload):
                yield json.dumps(event, ensure_ascii=False) + "\n"
        except Exception as exc:  # pragma: no cover
            yield json.dumps(
                {"type": "run_failed", "error": str(exc)},
                ensure_ascii=False,
            ) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


# -- Agent CRUD --
@app.get("/api/agents")
def list_agents(store: FileStore = Depends(get_store)):
    return store.load_agents()


@app.post("/api/agents", status_code=201)
def create_agent(agent: JSONDict, store: FileStore = Depends(get_store)):
    _validate_record_id(agent["id"])
    store.save_agent(agent)
    return agent


@app.get("/api/agents/{agent_id}")
def get_agent(agent_id: str, store: FileStore = Depends(get_store)):
    result = store.load_agent(_validate_record_id(agent_id))
    if result is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return result


@app.put("/api/agents/{agent_id}")
def update_agent(agent_id: str, agent: JSONDict, store: FileStore = Depends(get_store)):
    safe_id = _validate_record_id(agent_id)
    updated_agent = _with_id(agent, safe_id)
    store.save_agent(updated_agent)
    return updated_agent


@app.delete("/api/agents/{agent_id}", status_code=204)
def delete_agent(agent_id: str, store: FileStore = Depends(get_store)):
    store.delete_agent(_validate_record_id(agent_id))


# -- Project CRUD --
@app.get("/api/projects")
def list_projects(store: FileStore = Depends(get_store)):
    return store.load_projects()


@app.post("/api/projects", status_code=201)
def create_project(project: JSONDict, store: FileStore = Depends(get_store)):
    store.save_project(project)
    return project


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: str, store: FileStore = Depends(get_store)):
    store.delete_project(project_id)


# -- Request CRUD --
@app.get("/api/requests")
def list_requests(store: FileStore = Depends(get_store)):
    return store.load_requests()


@app.post("/api/requests", status_code=201)
def create_request(request_record: JSONDict, store: FileStore = Depends(get_store)):
    _validate_record_id(request_record["id"])
    store.save_request(request_record)
    return request_record


@app.get("/api/requests/{request_id}")
def get_request(request_id: str, store: FileStore = Depends(get_store)):
    result = store.load_request(_validate_record_id(request_id))
    if result is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return result


@app.put("/api/requests/{request_id}")
def update_request(request_id: str, request_record: JSONDict, store: FileStore = Depends(get_store)):
    safe_id = _validate_record_id(request_id)
    updated_request = _with_id(request_record, safe_id)
    store.save_request(updated_request)
    return updated_request


@app.delete("/api/requests/{request_id}", status_code=204)
def delete_request(request_id: str, store: FileStore = Depends(get_store)):
    store.delete_request(_validate_record_id(request_id))


# -- Chat CRUD --
@app.get("/api/chats")
def list_chats(store: FileStore = Depends(get_store)):
    return store.load_chats()


@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: str, store: FileStore = Depends(get_store)):
    result = store.load_chat(_validate_record_id(chat_id))
    if result is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return result


@app.delete("/api/chats/{chat_id}", status_code=204)
def delete_chat(chat_id: str, store: FileStore = Depends(get_store)):
    store.delete_chat(_validate_record_id(chat_id))


@app.post("/api/chats/message")
def post_chat_message(payload: JSONDict, store: FileStore = Depends(get_store)):
    from datetime import datetime, timezone

    raw_question = _safe_text(payload.get("question"), max_chars=8000)
    if not raw_question:
        raise HTTPException(status_code=400, detail="question is required")

    try:
        agent = AgentConfig.model_validate(payload.get("agent"))
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    raw_session_id = payload.get("session_id")
    session_id = (
        _validate_record_id(raw_session_id)
        if isinstance(raw_session_id, str) and raw_session_id
        else _chat_session_id(agent.id)
    )
    web_search_enabled = bool(payload.get("web_search_enabled", False))

    attachments: list[JSONDict] = []
    for item in payload.get("attachments") or []:
        if not isinstance(item, dict):
            continue
        content = _safe_text(item.get("content"), max_chars=12000)
        if not content:
            continue
        attachments.append(
            {
                "kind": _safe_text(item.get("kind"), max_chars=40) or "context",
                "title": _safe_text(item.get("title"), max_chars=120) or "添付",
                "content": content,
            }
        )
        if len(attachments) >= 6:
            break

    existing = store.load_chat(session_id)
    now = datetime.now(timezone.utc).isoformat()
    chat = existing or {
        "id": session_id,
        "agent_id": agent.id,
        "agent_name": agent.name,
        "messages": [],
        "created_at": now,
    }
    messages = list(chat.get("messages") or [])

    sources: list[JSONDict] = []
    search_error = None
    if web_search_enabled:
        sources, search_error = _search_web(raw_question)

    user_message = _make_chat_message(
        role="user",
        content=raw_question,
        agent_id=agent.id,
        agent_name=agent.name,
        web_search_enabled=web_search_enabled,
        attachments=attachments,
    )

    prompt = _build_chat_prompt(
        agent=agent,
        question=raw_question,
        attachments=attachments,
        sources=sources,
        search_error=search_error,
        history=messages,
    )

    assistant_error = None
    try:
        provider = resolve_provider(
            provider_kind=agent.provider,
            command_template=agent.command_template,
            coding_mode=False,
        )
        answer = provider.generate(
            prompt=prompt,
            model=agent.model,
            mcp_config_path=agent.mcp_config_path,
            mcp_servers=agent.mcp_servers,
        ).strip()
    except ProviderError as exc:
        assistant_error = str(exc)
        answer = (
            "回答の生成中に問題が発生しました。\n"
            f"{assistant_error}\n\n"
            "エージェント設定の provider / command_template / CLI の認証状態を確認してください。"
        )

    assistant_message = _make_chat_message(
        role="assistant",
        content=answer,
        agent_id=agent.id,
        agent_name=agent.name,
        web_search_enabled=web_search_enabled,
        sources=sources,
        error=assistant_error or search_error,
    )

    chat.update(
        {
            "id": session_id,
            "agent_id": agent.id,
            "agent_name": agent.name,
            "messages": [*messages, user_message, assistant_message],
            "updated_at": now,
        }
    )
    store.save_chat(chat)
    return chat


# -- Template CRUD --
@app.get("/api/templates")
def list_templates(store: FileStore = Depends(get_store)):
    return store.load_templates()


@app.post("/api/templates", status_code=201)
def create_template(template: JSONDict, store: FileStore = Depends(get_store)):
    store.save_template(template)
    return template


@app.delete("/api/templates/{template_id}", status_code=204)
def delete_template(template_id: str, store: FileStore = Depends(get_store)):
    store.delete_template(template_id)


# -- Workflow CRUD --
@app.get("/api/workflows")
def list_workflows(store: FileStore = Depends(get_store)):
    return store.load_workflows()


@app.post("/api/workflows", status_code=201)
def create_workflow(workflow: JSONDict, store: FileStore = Depends(get_store)):
    store.save_workflow(workflow)
    return workflow


@app.delete("/api/workflows/{workflow_id}", status_code=204)
def delete_workflow(workflow_id: str, store: FileStore = Depends(get_store)):
    store.delete_workflow(workflow_id)


# -- Evaluation endpoints --
@app.post("/api/evaluations", status_code=201)
def submit_evaluation(payload: JSONDict, store: FileStore = Depends(get_store)):
    project_id = payload["project_id"]
    projects = store.load_projects()
    project = _find_project_or_404(projects, project_id)

    evaluation = create_evaluation(
        evaluator_role=payload["evaluator_role"],
        score=payload["score"],
        comment=payload.get("comment"),
        round_number=payload.get("round_number"),
        is_final=payload.get("is_final", False),
    )

    updated = add_evaluation_to_project(project, payload["snapshot_id"], evaluation)
    store.save_project(updated)
    return evaluation


@app.get("/api/agents/{agent_id}/evaluations")
def get_agent_evaluations(agent_id: str, store: FileStore = Depends(get_store)):
    projects = store.load_projects()
    return get_agent_evaluations_across_projects(projects, agent_id)
