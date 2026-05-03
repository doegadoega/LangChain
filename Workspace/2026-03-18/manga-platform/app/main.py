from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.models import PlatformSnapshot, ReleaseFeedResponse, SubscriptionCreate, SubscriptionResponse
from app.platform import build_platform_snapshot, build_release_feed, create_subscription


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Manga Platform", version="1.0.0")
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


@app.get("/api/platform", response_model=PlatformSnapshot)
def get_platform() -> PlatformSnapshot:
    return build_platform_snapshot()


@app.get("/api/releases", response_model=ReleaseFeedResponse)
def get_releases(since: datetime | None = None) -> ReleaseFeedResponse:
    return build_release_feed(since=since)


@app.post("/api/subscriptions", response_model=SubscriptionResponse)
def subscribe(payload: SubscriptionCreate) -> SubscriptionResponse:
    return create_subscription(payload)
