from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, model_validator


class NotificationChannel(str, Enum):
    BROWSER = "browser"
    EMAIL = "email"
    WEBHOOK = "webhook"


class EditorialCredit(BaseModel):
    role: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    status: str = Field(min_length=1, max_length=40)
    note: str = Field(default="", max_length=300)


class StudioAgent(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=80)
    specialty: str = Field(min_length=1, max_length=120)
    deliverable: str = Field(min_length=1, max_length=160)
    cadence: str = Field(min_length=1, max_length=80)
    guardrail: str = Field(min_length=1, max_length=240)


class ReleaseEvent(BaseModel):
    series_slug: str = Field(min_length=1, max_length=80)
    series_title: str = Field(min_length=1, max_length=120)
    batch_number: int = Field(ge=1)
    page_count: int = Field(ge=1)
    released_at: datetime
    headline: str = Field(min_length=1, max_length=180)


class SeriesSummary(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=120)
    premise: str = Field(min_length=1, max_length=300)
    genre_tags: list[str] = Field(default_factory=list, max_length=8)
    update_interval_minutes: int = Field(default=60, ge=1)
    pages_per_update: int = Field(default=20, ge=1)
    launch_offset_minute: int = Field(ge=0, le=59)
    released_batches: int = Field(ge=0)
    total_pages_published: int = Field(ge=0)
    latest_batch_label: str = Field(min_length=1, max_length=80)
    latest_release_at: datetime
    next_release_at: datetime
    next_page_window: str = Field(min_length=1, max_length=40)
    current_stage: str = Field(min_length=1, max_length=80)
    lead_agent_id: str = Field(min_length=1, max_length=64)


class StudioAssignment(BaseModel):
    series_slug: str = Field(min_length=1, max_length=80)
    series_title: str = Field(min_length=1, max_length=120)
    current_stage: str = Field(min_length=1, max_length=80)
    lead_agent_id: str = Field(min_length=1, max_length=64)
    minutes_to_release: int = Field(ge=0)
    next_release_at: datetime
    pages_in_batch: int = Field(default=20, ge=1)


class SubscriptionSummary(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    display_name: str = Field(min_length=1, max_length=80)
    channel: NotificationChannel
    target: str = Field(min_length=1, max_length=240)
    created_at: datetime


class SubscriptionCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    channel: NotificationChannel
    target: str = Field(default="browser-session", max_length=240)

    @model_validator(mode="after")
    def validate_target(self) -> "SubscriptionCreate":
        target = self.target.strip() or "browser-session"
        self.target = target

        if self.channel == NotificationChannel.EMAIL and "@" not in target:
            raise ValueError("email channel requires a valid email-like target")
        if self.channel == NotificationChannel.WEBHOOK and not (
            target.startswith("http://") or target.startswith("https://")
        ):
            raise ValueError("webhook channel requires an http(s) URL")
        return self


class SubscriptionResponse(BaseModel):
    message: str = Field(min_length=1, max_length=240)
    subscription: SubscriptionSummary
    subscriptions: list[SubscriptionSummary] = Field(default_factory=list)


class ReleaseFeedResponse(BaseModel):
    server_now: datetime
    releases: list[ReleaseEvent] = Field(default_factory=list)


class PlatformSnapshot(BaseModel):
    platform_name: str = Field(min_length=1, max_length=120)
    tagline: str = Field(min_length=1, max_length=200)
    timezone: str = Field(min_length=1, max_length=80)
    server_now: datetime
    update_policy: str = Field(min_length=1, max_length=240)
    stagger_policy: str = Field(min_length=1, max_length=240)
    rights_notice: str = Field(min_length=1, max_length=400)
    editorial_board: list[EditorialCredit] = Field(default_factory=list)
    studio_agents: list[StudioAgent] = Field(default_factory=list)
    studio_queue: list[StudioAssignment] = Field(default_factory=list)
    series: list[SeriesSummary] = Field(default_factory=list)
    recent_releases: list[ReleaseEvent] = Field(default_factory=list)
    subscriptions: list[SubscriptionSummary] = Field(default_factory=list)
