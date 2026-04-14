from __future__ import annotations

import json
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from app.models import RefineRequest, RefineResponse
from app.orchestrator import iter_refinement_events, run_refinement
from app.store import FileStore


BASE_DIR = Path(__file__).resolve().parent


def get_store() -> FileStore:
    return FileStore()
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
def create_agent(agent: dict, store: FileStore = Depends(get_store)):
    store.save_agent(agent)
    return agent


@app.get("/api/agents/{agent_id}")
def get_agent(agent_id: str, store: FileStore = Depends(get_store)):
    result = store.load_agent(agent_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return result


@app.put("/api/agents/{agent_id}")
def update_agent(agent_id: str, agent: dict, store: FileStore = Depends(get_store)):
    agent["id"] = agent_id
    store.save_agent(agent)
    return agent


@app.delete("/api/agents/{agent_id}", status_code=204)
def delete_agent(agent_id: str, store: FileStore = Depends(get_store)):
    store.delete_agent(agent_id)


# -- Project CRUD --
@app.get("/api/projects")
def list_projects(store: FileStore = Depends(get_store)):
    return store.load_projects()


@app.post("/api/projects", status_code=201)
def create_project(project: dict, store: FileStore = Depends(get_store)):
    store.save_project(project)
    return project


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: str, store: FileStore = Depends(get_store)):
    store.delete_project(project_id)


# -- Template CRUD --
@app.get("/api/templates")
def list_templates(store: FileStore = Depends(get_store)):
    return store.load_templates()


@app.post("/api/templates", status_code=201)
def create_template(template: dict, store: FileStore = Depends(get_store)):
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
def create_workflow(workflow: dict, store: FileStore = Depends(get_store)):
    store.save_workflow(workflow)
    return workflow


@app.delete("/api/workflows/{workflow_id}", status_code=204)
def delete_workflow(workflow_id: str, store: FileStore = Depends(get_store)):
    store.delete_workflow(workflow_id)
