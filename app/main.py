from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any
from uuid import uuid4

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
from app.health import check_providers, precheck_agents
from app.logging_setup import (
    LOG_FILE,
    agent_log_path,
    configure_logging,
    list_agent_logs,
    read_agent_log_tail,
    read_log_tail,
)

configure_logging()
from app.intake import (
    Task,
    TaskPlan,
    TaskRequest,
    TaskRouter,
    TaskStatus,
    list_workflow_definitions,
)
from app.models import AgentConfig, KnowledgeContextItem, ProviderKind, RefineRequest, RefineResponse
from app.orchestrator import iter_refinement_events, run_refinement
from app.artifacts import Artifact
from app.runs import AgentRun
from app.providers import ProviderError, list_provider_models, resolve_provider
from app.skills import SkillSource, SkillStore, SkillStoreError
from app.store import FileStore


def get_skill_store() -> SkillStore:
    return SkillStore()


BASE_DIR = Path(__file__).resolve().parent
JSONDict = dict[str, Any]
IGNORED_SOURCE_DIRS = {
    ".git",
    ".venv",
    "__pycache__",
    "node_modules",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "DerivedData",
    "build",
    "dist",
}
SOURCE_TEXT_MAX_BYTES = 512 * 1024
KNOWLEDGE_TEXT_MAX_BYTES = 1024 * 1024
KNOWLEDGE_IMAGE_MAX_BYTES = 2 * 1024 * 1024
SOURCE_TREE_MAX_CHILDREN = 300
WORKTREE_BRANCH_PREFIX = "ai"


def get_store() -> FileStore:
    return FileStore()


def get_task_router() -> TaskRouter:
    return TaskRouter()


def _new_task_id() -> str:
    return f"task_{uuid4().hex[:12]}"


def _with_id(payload: JSONDict, record_id: str) -> JSONDict:
    return {**payload, "id": record_id}


def _validate_record_id(record_id: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", record_id):
        raise HTTPException(status_code=400, detail="Invalid record id")
    return record_id


def _resolve_local_path(raw_path: str) -> Path:
    raw = raw_path.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="path is required")
    try:
        return Path(raw).expanduser().resolve()
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid path: {exc}") from exc


def _source_tree_item(path: Path) -> JSONDict:
    stat = path.stat()
    return {
        "name": path.name,
        "path": str(path),
        "kind": "directory" if path.is_dir() else "file",
        "size": stat.st_size,
        "updated_at": stat.st_mtime,
    }


def _pick_directory_with_osascript() -> str:
    if shutil.which("osascript") is None:
        raise RuntimeError("osascript is not available")
    completed = subprocess.run(
        [
            "osascript",
            "-e",
            'POSIX path of (choose folder with prompt "作業ディレクトリを選択してください")',
        ],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    if completed.returncode != 0:
        message = completed.stderr.strip() or completed.stdout.strip() or "osascript failed"
        if "-128" in message or "User canceled" in message:
            return ""
        raise RuntimeError(message)
    return completed.stdout.strip()


def _pick_directory_with_tkinter() -> str:
    import tkinter
    from tkinter import filedialog

    root = None
    try:
        root = tkinter.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        return filedialog.askdirectory()
    finally:
        if root is not None:
            root.destroy()


def _is_probably_binary(data: bytes) -> bool:
    return b"\x00" in data[:2048]


def _truncate_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n...(truncated)"


def _safe_text(value: Any, *, max_chars: int) -> str:
    if not isinstance(value, str):
        return ""
    return _truncate_text(value.strip(), max_chars)


def _safe_branch_segment(value: str) -> str:
    segment = re.sub(r"[^A-Za-z0-9._-]", "-", value.strip()).strip(".-/")
    return segment[:64] or "coding"


def _run_git(
    repo: Path,
    args: list[str],
    *,
    input_bytes: bytes | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[bytes]:
    completed = subprocess.run(
        ["git", "-C", str(repo), *args],
        input=input_bytes,
        capture_output=True,
        check=False,
    )
    if check and completed.returncode != 0:
        message = completed.stderr.decode("utf-8", errors="replace").strip()
        message = message or completed.stdout.decode("utf-8", errors="replace").strip()
        raise HTTPException(status_code=400, detail=message or "git command failed")
    return completed


def _git_text(repo: Path, args: list[str], *, check: bool = True) -> str:
    completed = _run_git(repo, args, check=check)
    return completed.stdout.decode("utf-8", errors="replace").strip()


def _resolve_git_repo(path: Path) -> Path:
    if shutil.which("git") is None:
        raise HTTPException(status_code=503, detail="git is not available")
    if not path.exists():
        raise HTTPException(status_code=404, detail="path not found")
    target = path if path.is_dir() else path.parent
    try:
        repo_root = _git_text(target, ["rev-parse", "--show-toplevel"])
    except HTTPException as exc:
        raise HTTPException(status_code=400, detail="path is not inside a git repository") from exc
    return Path(repo_root).resolve()


def _parse_git_porcelain(output: str) -> tuple[list[str], list[str]]:
    changed: list[str] = []
    untracked: list[str] = []
    for raw_line in output.splitlines():
        line = raw_line.rstrip()
        if not line:
            continue
        status = line[:2]
        path = line[2:].lstrip()
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        if status == "??":
            untracked.append(path)
        else:
            changed.append(path)
    return changed, untracked


def _git_status_payload(path: Path) -> JSONDict:
    repo_root = _resolve_git_repo(path)
    porcelain = _git_text(repo_root, ["status", "--porcelain=v1"])
    changed_files, untracked_files = _parse_git_porcelain(porcelain)
    branch = _git_text(repo_root, ["branch", "--show-current"], check=False)
    base_commit = _git_text(repo_root, ["rev-parse", "HEAD"])
    return {
        "repo_root": str(repo_root),
        "current_branch": branch or "HEAD",
        "base_commit": base_commit,
        "dirty": bool(changed_files or untracked_files),
        "changed_files": changed_files,
        "untracked_files": untracked_files,
    }


def _prepare_coding_worktree(
    *,
    request_id: str,
    working_directory: str,
    store: FileStore,
) -> JSONDict:
    safe_request_id = _validate_record_id(request_id)
    repo_root = _resolve_git_repo(_resolve_local_path(working_directory))
    status = _git_status_payload(repo_root)
    branch_segment = _safe_branch_segment(safe_request_id)
    ai_branch = f"{WORKTREE_BRANCH_PREFIX}/{branch_segment}"
    worktree_path = (store.worktrees_dir / branch_segment).resolve()
    store.worktrees_dir.mkdir(parents=True, exist_ok=True)

    worktree_created = not worktree_path.exists()
    if worktree_created:
        branch_exists = (
            _run_git(repo_root, ["rev-parse", "--verify", ai_branch], check=False).returncode == 0
        )
        args = ["worktree", "add"]
        if not branch_exists:
            args.extend(["-b", ai_branch])
        args.extend([str(worktree_path), status["base_commit"] if not branch_exists else ai_branch])
        _run_git(repo_root, args)

    # Seed the worktree with the user's uncommitted changes only when it is
    # freshly created. A follow-up run reuses the existing worktree so the AI
    # can continue on code it already implemented; re-applying the source patch
    # there would conflict with work already present.
    user_patch_applied = False
    if worktree_created and status["changed_files"]:
        diff = _run_git(repo_root, ["diff", "--binary", "HEAD"]).stdout
        if diff.strip():
            apply_result = _run_git(
                worktree_path,
                ["apply", "--3way", "--whitespace=nowarn"],
                input_bytes=diff,
                check=False,
            )
            if apply_result.returncode != 0:
                message = apply_result.stderr.decode("utf-8", errors="replace").strip()
                raise HTTPException(
                    status_code=409,
                    detail=f"Failed to apply user changes to AI worktree: {message}",
                )
            user_patch_applied = True

    return {
        "request_id": safe_request_id,
        "repo_root": status["repo_root"],
        "source_working_directory": str(repo_root),
        "worktree_path": str(worktree_path),
        "base_branch": status["current_branch"],
        "base_commit": status["base_commit"],
        "ai_branch": ai_branch,
        "user_dirty": status["dirty"],
        "user_patch_applied": user_patch_applied,
        "user_changed_files": status["changed_files"],
        "user_untracked_files": status["untracked_files"],
        "reused": not worktree_created,
        "status": "reused" if not worktree_created else "prepared",
    }


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


def _normalize_external_skill_url(url: str) -> str:
    raw = url.strip()
    parsed = urllib.parse.urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("http/https URL required")
    if parsed.netloc == "github.com":
        parts = [part for part in parsed.path.split("/") if part]
        if len(parts) >= 5 and parts[2] == "blob":
            owner, repo, _blob, branch = parts[:4]
            path = "/".join(parts[4:])
            return f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
    return raw


def _external_skill_urls_from_payload(payload: JSONDict) -> list[str]:
    raw_urls = payload.get("urls")
    if raw_urls is None:
        raw_url = payload.get("url")
        if isinstance(raw_url, str):
            raw_urls = raw_url.splitlines()
    if not isinstance(raw_urls, list):
        raise HTTPException(status_code=400, detail="urls required")

    urls: list[str] = []
    seen: set[str] = set()
    for value in raw_urls:
        if not isinstance(value, str):
            continue
        for part in re.split(r"[\r\n,]+", value):
            url = part.strip()
            if not url or url in seen:
                continue
            seen.add(url)
            urls.append(url)
    if not urls:
        raise HTTPException(status_code=400, detail="urls required")
    if len(urls) > 20:
        raise HTTPException(status_code=400, detail="too many urls")
    return urls


def _fetch_external_skill_markdown(url: str) -> str:
    normalized = _normalize_external_skill_url(url)
    request = urllib.request.Request(
        normalized,
        headers={"User-Agent": "AgentRefinementPlatform/0.1"},
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        content_type = response.headers.get("content-type", "")
        data = response.read(1024 * 1024 + 1)
    if len(data) > 1024 * 1024:
        raise ValueError("SKILL.md is too large")
    text = data.decode("utf-8", errors="replace")
    if "text/html" in content_type.lower() and not text.lstrip().startswith("---"):
        raise ValueError("URL did not return SKILL.md markdown")
    return text


def _knowledge_id_from_path(path: Path) -> str:
    stem = re.sub(r"[^A-Za-z0-9_-]", "-", path.stem.lower()).strip("-") or "knowledge"
    return f"{stem}-{abs(hash(str(path))) % 100000:05d}"


def _knowledge_kind_for_path(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".md", ".markdown"}:
        return "markdown"
    if suffix in {".txt", ".text"}:
        return "text"
    if suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        return "image"
    if suffix in {".fig"}:
        return "figma"
    if suffix in {".json"} and "mcp" in path.name.lower():
        return "mcp"
    return "note"


def _normalize_knowledge_payload(payload: JSONDict) -> JSONDict:
    try:
        item = KnowledgeContextItem.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return item.model_dump(mode="json")


def _read_local_knowledge_file(path: Path, *, tags: list[str] | None = None) -> JSONDict:
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Knowledge file not found")
    kind = _knowledge_kind_for_path(path)
    try:
        data = path.read_bytes()
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Cannot read knowledge file: {exc}") from exc

    if kind == "image":
        if len(data) > KNOWLEDGE_IMAGE_MAX_BYTES:
            raise HTTPException(status_code=413, detail="Image knowledge file is too large")
        content_type = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }.get(path.suffix.lower(), "image/*")
        content = f"data:{content_type};base64,{base64.b64encode(data).decode('ascii')}"
    else:
        if len(data) > KNOWLEDGE_TEXT_MAX_BYTES:
            raise HTTPException(status_code=413, detail="Knowledge file is too large")
        if _is_probably_binary(data) and kind != "figma":
            raise HTTPException(status_code=415, detail="Binary knowledge file is not supported")
        content_type = "application/octet-stream" if kind == "figma" else "text/plain"
        content = "" if kind == "figma" else data.decode("utf-8", errors="replace")

    return _normalize_knowledge_payload(
        {
            "id": _knowledge_id_from_path(path),
            "title": path.name,
            "kind": kind,
            "content": content,
            "source": str(path),
            "content_type": content_type,
            "tags": tags or [],
        }
    )


def _build_chat_prompt(
    *,
    agent: AgentConfig,
    question: str,
    attachments: list[JSONDict],
    sources: list[JSONDict],
    search_error: str | None,
    history: list[JSONDict],
) -> str:
    def attachment_prompt_text(item: JSONDict) -> str:
        kind = item.get("kind", "context")
        title = item.get("title", "添付")
        if kind == "image":
            content_type = item.get("content_type") or "image/*"
            size = item.get("size")
            size_text = f", {size} bytes" if isinstance(size, int) else ""
            note = item.get("description") or "画像データは履歴に保存済みです。現時点のプロバイダー呼び出しには画像本文を直接送らず、ユーザー説明と周辺コンテキストを元に回答してください。"
            return f"[image] 画像添付: {title} ({content_type}{size_text})\n{note}"
        return (
            f"[{kind}] {title}\n"
            f"{_truncate_text(str(item.get('content', '')), 4000)}"
        )

    attachment_block = "\n\n".join(
        attachment_prompt_text(item)
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
        "人格・振る舞い指示:\n"
        "以下のペルソナを会話全体で維持してください。\n"
        f"{agent.persona.strip() or 'なし'}\n\n"
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
    # Never cache the HTML shell so a rebuilt SPA (new hashed asset names) is
    # always picked up — prevents stale-bundle issues after each frontend build.
    return FileResponse(
        STATIC_DIR / "index.html",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


@app.get("/api/providers/health")
def get_providers_health(providers: str | None = None) -> JSONDict:
    """各 provider が起動/接続可能かをチェック。

    クエリ `providers=codex_cli,ollama` で対象を絞れる。未指定なら全種。
    """
    kinds: list[ProviderKind] | None = None
    if providers:
        wanted = [p.strip() for p in providers.split(",") if p.strip()]
        kinds = []
        for token in wanted:
            try:
                kinds.append(ProviderKind(token))
            except ValueError:
                raise HTTPException(status_code=400, detail=f"unknown provider: {token}")
    results = check_providers(kinds)
    return {
        "providers": [r.to_dict() for r in results],
        "summary": {
            "total": len(results),
            "alive": sum(1 for r in results if r.alive),
            "dead": sum(1 for r in results if not r.alive),
        },
    }


@app.get("/api/logs")
def get_logs(tail_bytes: int = 64 * 1024) -> JSONDict:
    tail_bytes = max(1024, min(int(tail_bytes), 1_000_000))
    return {
        "path": str(LOG_FILE),
        "exists": LOG_FILE.exists(),
        "size": LOG_FILE.stat().st_size if LOG_FILE.exists() else 0,
        "content": read_log_tail(max_bytes=tail_bytes),
    }


@app.get("/api/logs/agents")
def list_agent_log_files() -> JSONDict:
    return {"agents": list_agent_logs()}


@app.get("/api/logs/agents/{agent_id}")
def get_agent_log(agent_id: str, tail_bytes: int = 64 * 1024) -> JSONDict:
    safe_id = _validate_record_id(agent_id)
    tail_bytes = max(1024, min(int(tail_bytes), 1_000_000))
    path = agent_log_path(safe_id)
    return {
        "agent_id": safe_id,
        "path": str(path),
        "exists": path.exists(),
        "size": path.stat().st_size if path.exists() else 0,
        "content": read_agent_log_tail(safe_id, max_bytes=tail_bytes),
    }


@app.post("/api/refine", response_model=RefineResponse)
def refine(payload: RefineRequest) -> RefineResponse:
    try:
        return run_refinement(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/refine/stream")
def refine_stream(payload: RefineRequest, force: bool = False) -> StreamingResponse:
    def event_stream():
        if not force:
            precheck = precheck_agents(payload.agents)
            if not precheck["ok"]:
                yield json.dumps(
                    {"type": "precheck_failed", **precheck},
                    ensure_ascii=False,
                ) + "\n"
                names = ", ".join(d["provider"] for d in precheck["dead"])
                yield json.dumps(
                    {
                        "type": "run_failed",
                        "error": f"事前チェック失敗: 起動していない provider があります ({names})。",
                    },
                    ensure_ascii=False,
                ) + "\n"
                return
        try:
            for event in iter_refinement_events(payload):
                yield json.dumps(event, ensure_ascii=False) + "\n"
        except Exception as exc:  # pragma: no cover
            yield json.dumps(
                {"type": "run_failed", "error": str(exc)},
                ensure_ascii=False,
            ) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.post("/api/runs/precheck")
def runs_precheck(payload: RefineRequest) -> JSONDict:
    """Pre-flight check of provider health for the enabled agents in the request.

    Returns { ok, dead[], checked[] }. Used by the UI to gate the Run button.
    """
    return precheck_agents(payload.agents)


@app.get("/api/providers/{provider}/models")
def provider_models(provider: str):
    try:
        provider_kind = ProviderKind(provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Unsupported provider") from exc
    return list_provider_models(provider_kind)


@app.get("/api/files/tree")
def file_tree(path: str):
    root = _resolve_local_path(path)
    if not root.exists() or not root.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")

    children: list[JSONDict] = []
    try:
        entries = sorted(
            root.iterdir(),
            key=lambda item: (not item.is_dir(), item.name.lower()),
        )
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Cannot read directory: {exc}") from exc

    for entry in entries:
        if entry.name in IGNORED_SOURCE_DIRS:
            continue
        if entry.name.startswith(".") and entry.name not in {".env", ".env.example"}:
            continue
        try:
            children.append(_source_tree_item(entry))
        except OSError:
            continue
        if len(children) >= SOURCE_TREE_MAX_CHILDREN:
            break

    return {
        "name": root.name or str(root),
        "path": str(root),
        "kind": "directory",
        "children": children,
        "truncated": len(children) >= SOURCE_TREE_MAX_CHILDREN,
    }


@app.get("/api/files/pick-directory")
def file_pick_directory():
    errors: list[str] = []
    try:
        selected = _pick_directory_with_tkinter()
        return {"path": selected}
    except Exception as exc:  # pragma: no cover - depends on local Python build / GUI session
        errors.append(f"tkinter: {exc}")

    try:
        selected = _pick_directory_with_osascript()
        return {"path": selected}
    except Exception as exc:  # pragma: no cover - depends on local GUI session
        errors.append(f"osascript: {exc}")

    raise HTTPException(
        status_code=503,
        detail="Folder picker is unavailable. " + " / ".join(errors),
    )


@app.get("/api/files/read")
def file_read(path: str):
    target = _resolve_local_path(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        stat = target.stat()
        if stat.st_size > SOURCE_TEXT_MAX_BYTES:
            raise HTTPException(status_code=413, detail="File is too large")
        data = target.read_bytes()
    except HTTPException:
        raise
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Cannot read file: {exc}") from exc

    if _is_probably_binary(data):
        raise HTTPException(status_code=415, detail="Binary file is not supported")

    return {
        "name": target.name,
        "path": str(target),
        "kind": "file",
        "size": stat.st_size,
        "updated_at": stat.st_mtime,
        "content": data.decode("utf-8", errors="replace"),
    }


# -- Git / Coding worktrees --
@app.get("/api/git/status")
def get_git_status(path: str):
    return _git_status_payload(_resolve_local_path(path))


@app.post("/api/git/worktrees/prepare", status_code=201)
def prepare_coding_worktree(payload: JSONDict, store: FileStore = Depends(get_store)):
    raw_request_id = payload.get("request_id")
    raw_working_directory = payload.get("working_directory")
    if not isinstance(raw_request_id, str) or not raw_request_id.strip():
        raise HTTPException(status_code=400, detail="request_id required")
    if not isinstance(raw_working_directory, str) or not raw_working_directory.strip():
        raise HTTPException(status_code=400, detail="working_directory required")
    return _prepare_coding_worktree(
        request_id=raw_request_id,
        working_directory=raw_working_directory,
        store=store,
    )


# -- Skills --
@app.get("/api/skills")
def list_skills(store: SkillStore = Depends(get_skill_store)):
    return [doc.model_dump(mode="json") for doc in store.load_installed_skills()]


@app.get("/api/skills/installed-local")
def list_local_installed_skills(
    path: str | None = None,
    store: SkillStore = Depends(get_skill_store),
):
    if path and path.strip():
        source_path = _resolve_local_path(path)
    else:
        codex_home = Path(os.getenv("CODEX_HOME", str(Path.home() / ".codex")))
        source_path = codex_home.expanduser() / "skills"
    return [
        doc.model_dump(mode="json")
        for doc in store.discover_directory_skills(source_path)
    ]


@app.post("/api/skills/install", status_code=201)
def install_skill(payload: JSONDict, store: SkillStore = Depends(get_skill_store)):
    markdown = payload.get("markdown")
    if not isinstance(markdown, str) or not markdown.strip():
        raise HTTPException(status_code=400, detail="markdown required")
    raw_source = payload.get("source", SkillSource.USER.value)
    try:
        source = SkillSource(raw_source)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid source") from exc
    try:
        installed = store.install_skill_markdown(markdown, source=source)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return installed.model_dump(mode="json")


@app.delete("/api/skills/{skill_id}", status_code=204)
def delete_skill(skill_id: str, store: SkillStore = Depends(get_skill_store)):
    _validate_record_id(skill_id)
    store.remove_skill(skill_id)


@app.delete("/api/skills/{skill_id}/versions/{version}", status_code=204)
def delete_skill_version(
    skill_id: str, version: str, store: SkillStore = Depends(get_skill_store)
):
    _validate_record_id(skill_id)
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", version):
        raise HTTPException(status_code=400, detail="invalid version")
    store.remove_skill_version(skill_id, version)


@app.get("/api/skills/candidates")
def list_skill_candidates(store: SkillStore = Depends(get_skill_store)):
    return [batch.model_dump(mode="json") for batch in store.load_candidates()]


@app.post("/api/skills/candidates/import-local")
def import_local_skills(
    payload: JSONDict, store: SkillStore = Depends(get_skill_store)
):
    path = payload.get("path")
    if not isinstance(path, str) or not path.strip():
        raise HTTPException(status_code=400, detail="path required")
    try:
        documents = store.import_local_directory_as_candidates(path)
    except SkillStoreError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return [doc.model_dump(mode="json") for doc in documents]


@app.post("/api/skills/candidates/import-url", status_code=201)
def import_external_skill(
    payload: JSONDict, store: SkillStore = Depends(get_skill_store)
):
    url = payload.get("url")
    if not isinstance(url, str) or not url.strip():
        raise HTTPException(status_code=400, detail="url required")
    try:
        markdown = _fetch_external_skill_markdown(url)
        document = store.import_markdown_as_candidate(
            markdown,
            batch_prefix="url",
            source_directory=_normalize_external_skill_url(url),
        )
    except (OSError, ValueError, SkillStoreError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return document.model_dump(mode="json")


@app.post("/api/skills/candidates/import-urls", status_code=201)
def import_external_skills(
    payload: JSONDict, store: SkillStore = Depends(get_skill_store)
):
    urls = _external_skill_urls_from_payload(payload)
    documents: list[JSONDict] = []
    errors: list[JSONDict] = []
    for url in urls:
        try:
            markdown = _fetch_external_skill_markdown(url)
            document = store.import_markdown_as_candidate(
                markdown,
                batch_prefix="url",
                source_directory=_normalize_external_skill_url(url),
            )
            documents.append(document.model_dump(mode="json"))
        except (OSError, ValueError, SkillStoreError) as exc:
            errors.append({"url": url, "message": str(exc)})

    if not documents:
        detail = errors[0]["message"] if len(errors) == 1 else "No skills imported"
        raise HTTPException(status_code=400, detail=detail)
    return {"documents": documents, "errors": errors}


@app.post("/api/skills/candidates/{batch_id}/{skill_id}/approve", status_code=201)
def approve_skill_candidate(
    batch_id: str,
    skill_id: str,
    store: SkillStore = Depends(get_skill_store),
):
    _validate_record_id(batch_id)
    _validate_record_id(skill_id)
    try:
        installed = store.approve_candidate(skill_id=skill_id, batch_id=batch_id)
    except SkillStoreError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return installed.model_dump(mode="json")


@app.delete("/api/skills/candidates/{batch_id}/{skill_id}", status_code=204)
def discard_skill_candidate(
    batch_id: str,
    skill_id: str,
    store: SkillStore = Depends(get_skill_store),
):
    _validate_record_id(batch_id)
    _validate_record_id(skill_id)
    store.discard_candidate(skill_id=skill_id, batch_id=batch_id)


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


# -- Task intake & planning --
@app.get("/api/workflows/definitions")
def get_workflow_definitions() -> JSONDict:
    """List the built-in workflow templates the planner can select."""
    return {"workflows": [wf.model_dump() for wf in list_workflow_definitions()]}


@app.post("/api/tasks/plan", response_model=TaskPlan)
def plan_task(
    request: TaskRequest,
    router: TaskRouter = Depends(get_task_router),
) -> TaskPlan:
    """Stateless planning: classify a request and return a TaskPlan without saving."""
    return router.route(request, task_id=_new_task_id())


@app.get("/api/tasks")
def list_tasks(store: FileStore = Depends(get_store)) -> list[JSONDict]:
    tasks = store.load_tasks()
    return sorted(tasks, key=lambda t: str(t.get("updated_at", "")), reverse=True)


@app.post("/api/tasks", status_code=201, response_model=Task)
def create_task(
    request: TaskRequest,
    store: FileStore = Depends(get_store),
    router: TaskRouter = Depends(get_task_router),
) -> Task:
    """Create a task and immediately attach an inferred plan (status: planned)."""
    task_id = _new_task_id()
    plan = router.route(request, task_id=task_id)
    task = Task(id=task_id, request=request, status=TaskStatus.PLANNED, plan=plan)
    store.save_task(task.model_dump())
    return task


@app.get("/api/tasks/{task_id}", response_model=Task)
def get_task(task_id: str, store: FileStore = Depends(get_store)) -> Task:
    record = store.load_task(_validate_record_id(task_id))
    if record is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task.model_validate(record)


@app.put("/api/tasks/{task_id}", response_model=Task)
def update_task(
    task_id: str,
    request: TaskRequest,
    store: FileStore = Depends(get_store),
    router: TaskRouter = Depends(get_task_router),
) -> Task:
    """Replace a task's request and re-plan it (status: planned)."""
    from datetime import datetime, timezone

    safe_id = _validate_record_id(task_id)
    record = store.load_task(safe_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Task not found")
    existing = Task.model_validate(record)
    plan = router.route(request, task_id=safe_id)
    updated = existing.model_copy(
        update={
            "request": request,
            "plan": plan,
            "status": TaskStatus.PLANNED,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    store.save_task(updated.model_dump())
    return updated


@app.post("/api/tasks/{task_id}/plan", response_model=Task)
def replan_task(
    task_id: str,
    store: FileStore = Depends(get_store),
    router: TaskRouter = Depends(get_task_router),
) -> Task:
    """Re-run planning for a stored task (e.g. after editing its request)."""
    safe_id = _validate_record_id(task_id)
    record = store.load_task(safe_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Task not found")
    from datetime import datetime, timezone

    task = Task.model_validate(record)
    plan = router.route(task.request, task_id=safe_id)
    updated = task.model_copy(
        update={
            "plan": plan,
            "status": TaskStatus.PLANNED,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    store.save_task(updated.model_dump())
    return updated


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, store: FileStore = Depends(get_store)) -> None:
    store.delete_task(_validate_record_id(task_id))


# -- AgentRun ledger (read) --
def _sorted_runs(records: list[JSONDict], *, newest_first: bool) -> list[JSONDict]:
    return sorted(
        records,
        key=lambda r: str(r.get("started_at", "")),
        reverse=newest_first,
    )


@app.get("/api/runs/{run_id}/agent-runs", response_model=list[AgentRun])
def list_run_agent_runs(
    run_id: str, store: FileStore = Depends(get_store)
) -> list[AgentRun]:
    """Agent runs that belong to a workflow run, in execution order."""
    safe_id = _validate_record_id(run_id)
    runs = [r for r in store.load_agent_runs() if r.get("workflow_run_id") == safe_id]
    return [AgentRun.model_validate(r) for r in _sorted_runs(runs, newest_first=False)]


@app.get("/api/agents/{agent_id}/runs", response_model=list[AgentRun])
def list_agent_runs_for_agent(
    agent_id: str, store: FileStore = Depends(get_store)
) -> list[AgentRun]:
    """All ledger entries for one agent, newest first."""
    safe_id = _validate_record_id(agent_id)
    runs = [r for r in store.load_agent_runs() if r.get("agent_id") == safe_id]
    return [AgentRun.model_validate(r) for r in _sorted_runs(runs, newest_first=True)]


@app.get("/api/agent-runs/{agent_run_id}", response_model=AgentRun)
def get_agent_run(
    agent_run_id: str, store: FileStore = Depends(get_store)
) -> AgentRun:
    record = store.load_agent_run(_validate_record_id(agent_run_id))
    if record is None:
        raise HTTPException(status_code=404, detail="Agent run not found")
    return AgentRun.model_validate(record)


# -- Artifact store (read) --
def _artifacts_by(field: str, value: str, store: FileStore) -> list[Artifact]:
    records = [a for a in store.load_artifacts() if a.get(field) == value]
    records.sort(key=lambda a: str(a.get("created_at", "")))
    return [Artifact.model_validate(a) for a in records]


@app.get("/api/runs/{run_id}/artifacts", response_model=list[Artifact])
def list_run_artifacts(
    run_id: str, store: FileStore = Depends(get_store)
) -> list[Artifact]:
    """Artifacts produced by a workflow run, in creation order."""
    return _artifacts_by("workflow_run_id", _validate_record_id(run_id), store)


@app.get("/api/tasks/{task_id}/artifacts", response_model=list[Artifact])
def list_task_artifacts(
    task_id: str, store: FileStore = Depends(get_store)
) -> list[Artifact]:
    """All artifacts for a task across its runs."""
    return _artifacts_by("task_id", _validate_record_id(task_id), store)


@app.get("/api/artifacts/{artifact_id}", response_model=Artifact)
def get_artifact(
    artifact_id: str, store: FileStore = Depends(get_store)
) -> Artifact:
    record = store.load_artifact(_validate_record_id(artifact_id))
    if record is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return Artifact.model_validate(record)


# -- Knowledge CRUD --
@app.get("/api/knowledge")
def list_knowledge(store: FileStore = Depends(get_store)):
    return store.load_knowledge()


@app.post("/api/knowledge", status_code=201)
def create_knowledge(resource: JSONDict, store: FileStore = Depends(get_store)):
    normalized = _normalize_knowledge_payload(resource)
    _validate_record_id(normalized["id"])
    store.save_knowledge(normalized)
    return normalized


@app.put("/api/knowledge/{knowledge_id}")
def update_knowledge(
    knowledge_id: str, resource: JSONDict, store: FileStore = Depends(get_store)
):
    safe_id = _validate_record_id(knowledge_id)
    normalized = _normalize_knowledge_payload({**resource, "id": safe_id})
    store.save_knowledge(normalized)
    return normalized


@app.delete("/api/knowledge/{knowledge_id}", status_code=204)
def delete_knowledge(knowledge_id: str, store: FileStore = Depends(get_store)):
    store.delete_knowledge(_validate_record_id(knowledge_id))


@app.post("/api/knowledge/import-local", status_code=201)
def import_local_knowledge(payload: JSONDict, store: FileStore = Depends(get_store)):
    raw_path = payload.get("path")
    if not isinstance(raw_path, str) or not raw_path.strip():
        raise HTTPException(status_code=400, detail="path required")
    raw_tags = payload.get("tags")
    tags = [tag for tag in raw_tags if isinstance(tag, str)] if isinstance(raw_tags, list) else []
    resource = _read_local_knowledge_file(_resolve_local_path(raw_path), tags=tags)
    store.save_knowledge(resource)
    return resource


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


def _prepare_chat_turn(payload: JSONDict, store: FileStore) -> tuple[JSONDict, str, AgentConfig, str, JSONDict, list[JSONDict], list[JSONDict], str | None, bool]:
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
        kind = _safe_text(item.get("kind"), max_chars=40) or "context"
        max_chars = 2_000_000 if kind == "image" else 12000
        content = _safe_text(item.get("content"), max_chars=max_chars)
        if not content:
            continue
        attachment = {
            "kind": kind,
            "title": _safe_text(item.get("title"), max_chars=120) or "添付",
            "content": content,
        }
        if kind == "image":
            attachment["content_type"] = (
                _safe_text(item.get("content_type"), max_chars=80) or "image/*"
            )
            attachment["description"] = _safe_text(
                item.get("description"), max_chars=1000
            )
            attachment["size"] = len(content.encode("utf-8"))
        attachments.append(attachment)
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
    search_error: str | None = None
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

    return chat, session_id, agent, prompt, user_message, messages, sources, search_error, web_search_enabled


def _finalize_chat_turn(
    *,
    chat: JSONDict,
    session_id: str,
    agent: AgentConfig,
    user_message: JSONDict,
    messages: list[JSONDict],
    answer: str,
    assistant_error: str | None,
    search_error: str | None,
    sources: list[JSONDict],
    web_search_enabled: bool,
    store: FileStore,
) -> JSONDict:
    from datetime import datetime, timezone

    assistant_message = _make_chat_message(
        role="assistant",
        content=answer,
        agent_id=agent.id,
        agent_name=agent.name,
        web_search_enabled=web_search_enabled,
        sources=sources,
        error=assistant_error or search_error,
    )
    now = datetime.now(timezone.utc).isoformat()
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


def _run_provider_for_chat(agent: AgentConfig, prompt: str) -> tuple[str, str | None]:
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
        return answer, None
    except ProviderError as exc:
        assistant_error = str(exc)
        answer = (
            "回答の生成中に問題が発生しました。\n"
            f"{assistant_error}\n\n"
            "エージェント設定の provider / model / command_template と、CLI またはローカルLLMサーバーの起動状態を確認してください。"
        )
        return answer, assistant_error


@app.post("/api/chats/message")
def post_chat_message(payload: JSONDict, store: FileStore = Depends(get_store)):
    (
        chat,
        session_id,
        agent,
        prompt,
        user_message,
        messages,
        sources,
        search_error,
        web_search_enabled,
    ) = _prepare_chat_turn(payload, store)
    answer, assistant_error = _run_provider_for_chat(agent, prompt)
    return _finalize_chat_turn(
        chat=chat,
        session_id=session_id,
        agent=agent,
        user_message=user_message,
        messages=messages,
        answer=answer,
        assistant_error=assistant_error,
        search_error=search_error,
        sources=sources,
        web_search_enabled=web_search_enabled,
        store=store,
    )


@app.post("/api/chats/message/stream")
def post_chat_message_stream(payload: JSONDict, store: FileStore = Depends(get_store)) -> StreamingResponse:
    import threading
    import time as _time

    (
        chat,
        session_id,
        agent,
        prompt,
        user_message,
        messages,
        sources,
        search_error,
        web_search_enabled,
    ) = _prepare_chat_turn(payload, store)

    result: dict[str, Any] = {}

    def worker() -> None:
        try:
            answer, assistant_error = _run_provider_for_chat(agent, prompt)
            result["answer"] = answer
            result["error"] = assistant_error
        except Exception as exc:  # safety net
            result["answer"] = f"内部エラー: {exc}"
            result["error"] = str(exc)

    def event_stream():
        started = _time.monotonic()
        yield json.dumps({"type": "started", "session_id": session_id}, ensure_ascii=False) + "\n"

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        while thread.is_alive():
            thread.join(timeout=5.0)
            elapsed = _time.monotonic() - started
            yield json.dumps({"type": "heartbeat", "elapsed": round(elapsed, 1)}, ensure_ascii=False) + "\n"

        answer = result.get("answer", "")
        assistant_error = result.get("error")
        final_chat = _finalize_chat_turn(
            chat=chat,
            session_id=session_id,
            agent=agent,
            user_message=user_message,
            messages=messages,
            answer=answer,
            assistant_error=assistant_error,
            search_error=search_error,
            sources=sources,
            web_search_enabled=web_search_enabled,
            store=store,
        )
        yield json.dumps({"type": "completed", "chat": final_chat}, ensure_ascii=False) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


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
