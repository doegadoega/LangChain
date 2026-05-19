from __future__ import annotations

import logging
import os
import re
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_DIR = Path(
    os.environ.get("AGENT_REFINEMENT_LOG_DIR")
    or (Path.home() / ".agent-refinement" / "logs")
)
LOG_FILE = LOG_DIR / "server.log"
AGENT_LOG_DIR = LOG_DIR / "agents"
_AGENT_LOGGERS: dict[str, logging.Logger] = {}
_SAFE_AGENT_ID = re.compile(r"[^A-Za-z0-9._-]")

_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
_configured = False


def configure_logging() -> Path:
    global _configured
    if _configured:
        return LOG_FILE

    LOG_DIR.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    if not any(
        isinstance(h, RotatingFileHandler) and getattr(h, "_agent_refinement", False)
        for h in root.handlers
    ):
        handler = RotatingFileHandler(
            LOG_FILE,
            maxBytes=2_000_000,
            backupCount=5,
            encoding="utf-8",
        )
        handler.setFormatter(logging.Formatter(_FORMAT))
        handler._agent_refinement = True  # type: ignore[attr-defined]
        root.addHandler(handler)

    if not any(isinstance(h, logging.StreamHandler) and not isinstance(h, RotatingFileHandler) for h in root.handlers):
        stream = logging.StreamHandler()
        stream.setFormatter(logging.Formatter(_FORMAT))
        root.addHandler(stream)

    level_name = os.environ.get("AGENT_REFINEMENT_LOG_LEVEL", "INFO").upper()
    root.setLevel(getattr(logging, level_name, logging.INFO))

    _configured = True
    logging.getLogger("app").info("logging configured file=%s level=%s", LOG_FILE, level_name)
    return LOG_FILE


def read_log_tail(max_bytes: int = 64 * 1024) -> str:
    return _read_tail(LOG_FILE, max_bytes)


def _read_tail(path: Path, max_bytes: int) -> str:
    if not path.exists():
        return ""
    size = path.stat().st_size
    with path.open("rb") as fh:
        if size > max_bytes:
            fh.seek(size - max_bytes)
            fh.readline()
        data = fh.read()
    return data.decode("utf-8", errors="replace")


def _safe_agent_id(agent_id: str) -> str:
    cleaned = _SAFE_AGENT_ID.sub("_", agent_id)[:80]
    return cleaned or "anonymous"


def agent_log_path(agent_id: str) -> Path:
    AGENT_LOG_DIR.mkdir(parents=True, exist_ok=True)
    return AGENT_LOG_DIR / f"{_safe_agent_id(agent_id)}.log"


def get_agent_logger(agent_id: str) -> logging.Logger:
    """Return a logger that writes to ~/.agent-refinement/logs/agents/<agent_id>.log.

    Each agent gets its own RotatingFileHandler so users can audit per-agent
    activity. The logger also propagates to the root so events still appear in
    server.log with the agent_id in the message.
    """
    safe_id = _safe_agent_id(agent_id)
    if safe_id in _AGENT_LOGGERS:
        return _AGENT_LOGGERS[safe_id]

    AGENT_LOG_DIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(f"app.agent.{safe_id}")
    logger.propagate = True
    logger.setLevel(logging.INFO)

    if not any(getattr(h, "_agent_refinement_agent", False) for h in logger.handlers):
        handler = RotatingFileHandler(
            AGENT_LOG_DIR / f"{safe_id}.log",
            maxBytes=1_000_000,
            backupCount=3,
            encoding="utf-8",
        )
        handler.setFormatter(logging.Formatter(_FORMAT))
        handler._agent_refinement_agent = True  # type: ignore[attr-defined]
        logger.addHandler(handler)

    _AGENT_LOGGERS[safe_id] = logger
    return logger


def list_agent_logs() -> list[dict[str, object]]:
    if not AGENT_LOG_DIR.exists():
        return []
    items: list[dict[str, object]] = []
    for path in sorted(AGENT_LOG_DIR.glob("*.log")):
        try:
            stat = path.stat()
        except OSError:
            continue
        items.append(
            {
                "agent_id": path.stem,
                "path": str(path),
                "size": stat.st_size,
                "modified_at": stat.st_mtime,
            }
        )
    return items


def read_agent_log_tail(agent_id: str, max_bytes: int = 64 * 1024) -> str:
    return _read_tail(agent_log_path(agent_id), max_bytes)
