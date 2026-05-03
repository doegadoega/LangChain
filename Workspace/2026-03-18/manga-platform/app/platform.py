from __future__ import annotations

import math
from datetime import datetime, timedelta
from itertools import count
from threading import Lock
from zoneinfo import ZoneInfo

from app.models import (
    EditorialCredit,
    NotificationChannel,
    PlatformSnapshot,
    ReleaseEvent,
    ReleaseFeedResponse,
    SeriesSummary,
    StudioAgent,
    StudioAssignment,
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionSummary,
)


TOKYO = ZoneInfo("Asia/Tokyo")
UPDATE_INTERVAL = timedelta(hours=1)
PAGES_PER_UPDATE = 20
RECENT_RELEASE_WINDOW = timedelta(hours=3)

SERIES_BLUEPRINTS = [
    {
        "slug": "reikai-drift",
        "title": "霊界ドリフト",
        "premise": "霊障を燃料に走る配達屋チームが、都市を食う異界裂け目に挑む。",
        "genre_tags": ["霊能", "バトル", "都市伝奇"],
        "offset": 0,
    },
    {
        "slug": "ryusei-grid",
        "title": "流星グリッド",
        "premise": "重力スポーツで惑星間リーグを勝ち上がる反逆児たちの宇宙戦記。",
        "genre_tags": ["宇宙", "競技", "群像"],
        "offset": 6,
    },
    {
        "slug": "gekko-oracle",
        "title": "月虹オラクル",
        "premise": "未来視を失うごとに真実へ近づく巫女と護衛剣士の追跡譚。",
        "genre_tags": ["神話", "剣劇", "ロマンス"],
        "offset": 12,
    },
    {
        "slug": "tetsuto-eden",
        "title": "鉄都エデン",
        "premise": "空中都市の下層で拾われた王子が、機械庭園の秘密を暴いていく。",
        "genre_tags": ["メカ", "陰謀", "王道"],
        "offset": 18,
    },
    {
        "slug": "shin-en-dial",
        "title": "深淵ダイヤル",
        "premise": "異界につながる黒電話に選ばれた高校生が、毎夜ひとつ世界を救う。",
        "genre_tags": ["ホラー", "学園", "救済"],
        "offset": 24,
    },
    {
        "slug": "kyokko-saga",
        "title": "極光サーガ",
        "premise": "凍土の王国を再起動するため、失われた太陽炉を追う遠征隊の叙事詩。",
        "genre_tags": ["冒険", "ファンタジー", "遠征"],
        "offset": 30,
    },
    {
        "slug": "black-tide-reverse",
        "title": "黒潮リバース",
        "premise": "海底国境を越える密航士が、沈んだ王家の兵器争奪戦へ巻き込まれる。",
        "genre_tags": ["海洋", "追跡", "謀略"],
        "offset": 36,
    },
    {
        "slug": "jackal-protocol",
        "title": "ジャッカル・プロトコル",
        "premise": "犯罪予測AIに反旗を翻した巡査が、都市ネットワーク全域を敵に回す。",
        "genre_tags": ["近未来", "逃亡", "サスペンス"],
        "offset": 42,
    },
    {
        "slug": "zero-kite",
        "title": "零カイト",
        "premise": "空戦孤児たちが、雷雲上空に封印された巨艦の起動権を争う。",
        "genre_tags": ["空戦", "友情", "成長"],
        "offset": 48,
    },
    {
        "slug": "seishin-lattice",
        "title": "星辰ラティス",
        "premise": "星図を縫い直す職人一族が、時間歪曲で消えた故郷を取り戻す。",
        "genre_tags": ["SF", "家族", "旅"],
        "offset": 54,
    },
]

EDITORIAL_BOARD = [
    EditorialCredit(
        role="原作タッグ",
        name="冨樫義博 / 鳥山明",
        status="編成",
        note="週次会議と全体構想レビューを担う体制。",
    ),
    EditorialCredit(
        role="編集統括",
        name="武内直子",
        status="編成",
        note="連載進行、トーン統制、シリーズ横断の品質管理を担当。",
    ),
]

STUDIO_AGENTS = [
    StudioAgent(
        id="plot-architect",
        name="Plot Architect",
        specialty="物語設計",
        deliverable="1時間ごとの20ページ構成と感情導線",
        cadence="毎時00分開始",
        guardrail="各話で必ず1つ大きな引きを残し、前話との因果を切らさない。",
    ),
    StudioAgent(
        id="name-director",
        name="Name Director",
        specialty="ネームとコマ割り",
        deliverable="20ページ分のページレイアウトと見開き山場",
        cadence="毎時05分更新",
        guardrail="1更新あたり最低1見開き、最大2見開きまでに抑える。",
    ),
    StudioAgent(
        id="motion-renderer",
        name="Motion Renderer",
        specialty="キャラクター作画",
        deliverable="アクション、表情、芝居の主線",
        cadence="毎時15分更新",
        guardrail="キャラクターの可読性を最優先し、1コマ内の主動作は1つに絞る。",
    ),
    StudioAgent(
        id="world-forge",
        name="World Forge",
        specialty="背景・メカ・舞台",
        deliverable="背景線画と舞台ギミックの整合",
        cadence="毎時25分更新",
        guardrail="前話からの位置関係を壊さず、設定変更は編集承認後に限定する。",
    ),
    StudioAgent(
        id="ink-finish",
        name="Ink Finish",
        specialty="ペン入れと効果線",
        deliverable="主線の強弱とアクション演出",
        cadence="毎時35分更新",
        guardrail="効果線は読み方向を邪魔しない角度に固定する。",
    ),
    StudioAgent(
        id="tone-lettering",
        name="Tone & Lettering",
        specialty="トーン・写植・SFX",
        deliverable="濃淡設計、写植、擬音の配置",
        cadence="毎時45分更新",
        guardrail="台詞密度が高いページは余白を2割以上確保する。",
    ),
    StudioAgent(
        id="continuity-editor",
        name="Continuity Editor",
        specialty="校正と連載整合",
        deliverable="ページ順、人物設定、伏線、台詞修正",
        cadence="毎時55分更新",
        guardrail="リリース前の5分で必ず前後話の矛盾を潰す。",
    ),
]

AGENT_INDEX = {agent.id: agent for agent in STUDIO_AGENTS}
SUBSCRIPTIONS: list[SubscriptionSummary] = []
SUBSCRIPTIONS_LOCK = Lock()
SUBSCRIPTION_COUNTER = count(1)


def _now() -> datetime:
    return datetime.now(TOKYO)


def _release_anchor(now: datetime) -> datetime:
    return now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=12)


def _batch_page_window(batch_number: int) -> str:
    start = ((batch_number - 1) * PAGES_PER_UPDATE) + 1
    end = batch_number * PAGES_PER_UPDATE
    return f"P{start:03d}-P{end:03d}"


def _minutes_to_release(now: datetime, next_release_at: datetime) -> int:
    delta_seconds = max(0.0, (next_release_at - now).total_seconds())
    return int(math.ceil(delta_seconds / 60))


def _stage_for_minutes(minutes_to_release: int) -> tuple[str, str]:
    if minutes_to_release > 50:
        return ("plot-architect", "プロット固定")
    if minutes_to_release > 40:
        return ("name-director", "ネーム構築")
    if minutes_to_release > 30:
        return ("motion-renderer", "主役芝居とアクション")
    if minutes_to_release > 20:
        return ("world-forge", "背景・舞台投入")
    if minutes_to_release > 10:
        return ("ink-finish", "ペン入れと速度線")
    if minutes_to_release > 5:
        return ("tone-lettering", "トーン・写植")
    return ("continuity-editor", "最終校正")


def _series_runtime(now: datetime, blueprint: dict[str, object]) -> SeriesSummary:
    anchor = _release_anchor(now)
    offset_minutes = int(blueprint["offset"])
    first_release_at = anchor + timedelta(minutes=offset_minutes)

    elapsed = now - first_release_at
    released_batches = max(1, int(elapsed // UPDATE_INTERVAL) + 1)
    latest_release_at = first_release_at + ((released_batches - 1) * UPDATE_INTERVAL)
    next_release_at = latest_release_at + UPDATE_INTERVAL
    minutes_to_release = _minutes_to_release(now, next_release_at)
    lead_agent_id, current_stage = _stage_for_minutes(minutes_to_release)

    return SeriesSummary(
        slug=str(blueprint["slug"]),
        title=str(blueprint["title"]),
        premise=str(blueprint["premise"]),
        genre_tags=[str(item) for item in blueprint["genre_tags"]],
        update_interval_minutes=60,
        pages_per_update=PAGES_PER_UPDATE,
        launch_offset_minute=offset_minutes,
        released_batches=released_batches,
        total_pages_published=released_batches * PAGES_PER_UPDATE,
        latest_batch_label=f"第{released_batches}更新 {_batch_page_window(released_batches)}",
        latest_release_at=latest_release_at,
        next_release_at=next_release_at,
        next_page_window=_batch_page_window(released_batches + 1),
        current_stage=current_stage,
        lead_agent_id=lead_agent_id,
    )


def _all_series(now: datetime) -> list[SeriesSummary]:
    series = [_series_runtime(now, blueprint) for blueprint in SERIES_BLUEPRINTS]
    return sorted(series, key=lambda item: item.next_release_at)


def _build_release_events(now: datetime, since: datetime | None = None) -> list[ReleaseEvent]:
    anchor = _release_anchor(now)
    releases: list[ReleaseEvent] = []

    for blueprint in SERIES_BLUEPRINTS:
        offset_minutes = int(blueprint["offset"])
        release_at = anchor + timedelta(minutes=offset_minutes)
        batch_number = 1

        while release_at <= now:
            if since is None or release_at > since:
                page_window = _batch_page_window(batch_number)
                releases.append(
                    ReleaseEvent(
                        series_slug=str(blueprint["slug"]),
                        series_title=str(blueprint["title"]),
                        batch_number=batch_number,
                        page_count=PAGES_PER_UPDATE,
                        released_at=release_at,
                        headline=(
                            f"{blueprint['title']} の第{batch_number}更新を公開 "
                            f"({page_window}, 20ページ)"
                        ),
                    )
                )

            release_at += UPDATE_INTERVAL
            batch_number += 1

    return sorted(releases, key=lambda item: item.released_at, reverse=False)


def _recent_releases(now: datetime) -> list[ReleaseEvent]:
    recent = _build_release_events(now, since=now - RECENT_RELEASE_WINDOW)
    return sorted(recent, key=lambda item: item.released_at, reverse=True)[:12]


def _studio_queue(series: list[SeriesSummary], now: datetime) -> list[StudioAssignment]:
    queue = [
        StudioAssignment(
            series_slug=item.slug,
            series_title=item.title,
            current_stage=item.current_stage,
            lead_agent_id=item.lead_agent_id,
            minutes_to_release=_minutes_to_release(now, item.next_release_at),
            next_release_at=item.next_release_at,
            pages_in_batch=item.pages_per_update,
        )
        for item in series
    ]
    return sorted(queue, key=lambda item: item.next_release_at)


def list_subscriptions() -> list[SubscriptionSummary]:
    with SUBSCRIPTIONS_LOCK:
        return list(sorted(SUBSCRIPTIONS, key=lambda item: item.created_at, reverse=True))


def build_platform_snapshot() -> PlatformSnapshot:
    now = _now()
    series = _all_series(now)
    return PlatformSnapshot(
        platform_name="HOUR SERIAL",
        tagline="10本の新規連載を、毎時20ページずつ切らさず配信する漫画連載基盤。",
        timezone="Asia/Tokyo",
        server_now=now,
        update_policy="各連載は60分ごとに20ページ更新。全10連載で毎時200ページを公開。",
        stagger_policy="10連載を6分刻みでずらして配信し、1時間を通して更新通知を発火させる。",
        rights_notice="編集体制の公開運用では、契約、権利処理、許諾確認を完了した前提で配信する。",
        editorial_board=EDITORIAL_BOARD,
        studio_agents=STUDIO_AGENTS,
        studio_queue=_studio_queue(series, now),
        series=series,
        recent_releases=_recent_releases(now),
        subscriptions=list_subscriptions(),
    )


def build_release_feed(since: datetime | None = None) -> ReleaseFeedResponse:
    now = _now()
    if since is not None and since.tzinfo is None:
        since = since.replace(tzinfo=TOKYO)
    return ReleaseFeedResponse(server_now=now, releases=_build_release_events(now, since))


def create_subscription(payload: SubscriptionCreate) -> SubscriptionResponse:
    now = _now()
    normalized_target = payload.target.strip() or "browser-session"

    with SUBSCRIPTIONS_LOCK:
        for existing in SUBSCRIPTIONS:
            if existing.channel == payload.channel and existing.target == normalized_target:
                return SubscriptionResponse(
                    message="同じ通知先はすでに登録済みです。",
                    subscription=existing,
                    subscriptions=list(sorted(SUBSCRIPTIONS, key=lambda item: item.created_at, reverse=True)),
                )

        subscription = SubscriptionSummary(
            id=f"sub-{next(SUBSCRIPTION_COUNTER):03d}",
            display_name=payload.display_name.strip(),
            channel=payload.channel,
            target=normalized_target,
            created_at=now,
        )
        SUBSCRIPTIONS.append(subscription)
        subscriptions = list(sorted(SUBSCRIPTIONS, key=lambda item: item.created_at, reverse=True))

    channel_label = {
        NotificationChannel.BROWSER: "ブラウザ通知",
        NotificationChannel.EMAIL: "メール通知",
        NotificationChannel.WEBHOOK: "Webhook通知",
    }[payload.channel]
    return SubscriptionResponse(
        message=f"{channel_label} を登録しました。更新ごとに通知対象へ積み上げます。",
        subscription=subscription,
        subscriptions=subscriptions,
    )
