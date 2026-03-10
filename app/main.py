from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from app.models import RefineRequest, RefineResponse
from app.orchestrator import iter_refinement_events, run_refinement


BASE_DIR = Path(__file__).resolve().parent
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
