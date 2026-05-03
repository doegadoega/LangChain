const state = {
  snapshot: null,
  lastReleaseCheckAt: null,
  countdownTimerId: null,
  releasePollId: null,
  snapshotPollId: null,
};

const dom = {
  updatePolicy: document.getElementById("updatePolicy"),
  rightsNotice: document.getElementById("rightsNotice"),
  editorialBoard: document.getElementById("editorialBoard"),
  metricSeries: document.getElementById("metricSeries"),
  metricPages: document.getElementById("metricPages"),
  metricNextRelease: document.getElementById("metricNextRelease"),
  metricNextTitle: document.getElementById("metricNextTitle"),
  metricAgents: document.getElementById("metricAgents"),
  serverClock: document.getElementById("serverClock"),
  liveAlerts: document.getElementById("liveAlerts"),
  releaseFeed: document.getElementById("releaseFeed"),
  seriesGrid: document.getElementById("seriesGrid"),
  agentGrid: document.getElementById("agentGrid"),
  queueGrid: document.getElementById("queueGrid"),
  subscriptionForm: document.getElementById("subscriptionForm"),
  displayName: document.getElementById("displayName"),
  channel: document.getElementById("channel"),
  target: document.getElementById("target"),
  enableBrowserBtn: document.getElementById("enableBrowserBtn"),
  subscriptionMessage: document.getElementById("subscriptionMessage"),
  subscriptionList: document.getElementById("subscriptionList"),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClock(value) {
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function countdownText(target) {
  const diffMs = new Date(target).getTime() - Date.now();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderEditorial(board) {
  dom.editorialBoard.innerHTML = board
    .map(
      (item) => `
        <article class="editorial-item">
          <span class="section-note">${escapeHtml(item.role)} / ${escapeHtml(item.status)}</span>
          <strong>${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.note)}</p>
        </article>
      `,
    )
    .join("");
}

function renderMetrics(snapshot) {
  dom.metricSeries.textContent = `${snapshot.series.length}本`;
  dom.metricPages.textContent = `${snapshot.series.length * 20}P`;
  dom.metricAgents.textContent = `${snapshot.studio_agents.length}基`;

  const nextSeries = snapshot.series[0];
  if (nextSeries) {
    dom.metricNextRelease.textContent = countdownText(nextSeries.next_release_at);
    dom.metricNextTitle.textContent = `${nextSeries.title} / ${formatDateTime(nextSeries.next_release_at)}`;
  }
}

function renderReleases(releases) {
  if (!releases.length) {
    dom.releaseFeed.innerHTML = '<div class="empty-state">まだ更新履歴がありません。</div>';
    return;
  }

  dom.releaseFeed.innerHTML = releases
    .map(
      (item) => `
        <article class="release-item">
          <h3>${escapeHtml(item.series_title)}</h3>
          <p>${escapeHtml(item.headline)}</p>
          <div class="release-meta">
            <span>公開時刻</span>
            <strong>${escapeHtml(formatDateTime(item.released_at))}</strong>
            <span>更新回</span>
            <strong>第${item.batch_number}更新</strong>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderSeries(series) {
  dom.seriesGrid.innerHTML = series
    .map(
      (item) => `
        <article class="series-card">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.premise)}</p>
          <div class="badge-row">
            ${item.genre_tags.map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="series-meta">
            <span>最新更新</span>
            <strong>${escapeHtml(item.latest_batch_label)}</strong>
            <span>次回公開</span>
            <strong>${escapeHtml(formatDateTime(item.next_release_at))}</strong>
            <span>次の20ページ</span>
            <strong>${escapeHtml(item.next_page_window)}</strong>
          </div>
          <div class="series-footer">
            <span class="stage-pill">${escapeHtml(item.current_stage)}</span>
            <span class="time-pill">残り ${escapeHtml(countdownText(item.next_release_at))}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderAgents(agents) {
  dom.agentGrid.innerHTML = agents
    .map(
      (item) => `
        <article class="agent-card">
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.specialty)}</p>
          <div class="series-meta">
            <span>成果物</span>
            <strong>${escapeHtml(item.deliverable)}</strong>
            <span>更新タイミング</span>
            <strong>${escapeHtml(item.cadence)}</strong>
          </div>
          <div class="agent-footer">
            <span class="stage-pill">${escapeHtml(item.guardrail)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderQueue(queue, agents) {
  const agentMap = new Map(agents.map((item) => [item.id, item]));
  dom.queueGrid.innerHTML = queue
    .map((item) => {
      const agent = agentMap.get(item.lead_agent_id);
      return `
        <article class="queue-card">
          <h3>${escapeHtml(item.series_title)}</h3>
          <p>${escapeHtml(item.current_stage)}</p>
          <div class="queue-meta">
            <span>担当</span>
            <strong>${escapeHtml(agent?.name || item.lead_agent_id)}</strong>
            <span>次回更新</span>
            <strong>${escapeHtml(formatDateTime(item.next_release_at))}</strong>
          </div>
          <div class="series-footer">
            <span class="badge">${item.pages_in_batch}ページ</span>
            <span class="time-pill">残り ${escapeHtml(countdownText(item.next_release_at))}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSubscriptions(items) {
  if (!items.length) {
    dom.subscriptionList.innerHTML = '<div class="empty-state">通知登録はまだありません。</div>';
    return;
  }

  dom.subscriptionList.innerHTML = items
    .map(
      (item) => `
        <article>
          <h3>${escapeHtml(item.display_name)}</h3>
          <p>${escapeHtml(item.channel)} / ${escapeHtml(item.target)}</p>
          <p>${escapeHtml(formatDateTime(item.created_at))} に登録</p>
        </article>
      `,
    )
    .join("");
}

function renderAlerts(messages) {
  if (!messages.length) {
    dom.liveAlerts.innerHTML = "";
    return;
  }

  dom.liveAlerts.innerHTML = messages
    .map((message) => `<div class="live-alert">${escapeHtml(message)}</div>`)
    .join("");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(await response.text() || `HTTP ${response.status}`);
  }
  return response.json();
}

async function loadSnapshot({ preserveReleaseCheckpoint = false } = {}) {
  const snapshot = await fetchJson("/api/platform");
  state.snapshot = snapshot;

  dom.updatePolicy.textContent = snapshot.update_policy;
  dom.rightsNotice.textContent = snapshot.rights_notice;
  dom.serverClock.textContent = formatClock(snapshot.server_now);

  renderEditorial(snapshot.editorial_board);
  renderMetrics(snapshot);
  renderReleases(snapshot.recent_releases);
  renderSeries(snapshot.series);
  renderAgents(snapshot.studio_agents);
  renderQueue(snapshot.studio_queue, snapshot.studio_agents);
  renderSubscriptions(snapshot.subscriptions);

  if (!preserveReleaseCheckpoint) {
    state.lastReleaseCheckAt = snapshot.server_now;
  }
}

function refreshCountdowns() {
  if (!state.snapshot) {
    return;
  }

  const nextSeries = state.snapshot.series[0];
  if (nextSeries) {
    dom.metricNextRelease.textContent = countdownText(nextSeries.next_release_at);
  }

  document.querySelectorAll(".time-pill").forEach((node) => {
    const card = node.closest("[data-next-release]");
    if (!card) {
      return;
    }
    node.textContent = `残り ${countdownText(card.dataset.nextRelease)}`;
  });
}

function wireCountdownTargets() {
  document.querySelectorAll(".series-card").forEach((card, index) => {
    const series = state.snapshot?.series?.[index];
    if (series) {
      card.dataset.nextRelease = series.next_release_at;
    }
  });

  document.querySelectorAll(".queue-card").forEach((card, index) => {
    const item = state.snapshot?.studio_queue?.[index];
    if (item) {
      card.dataset.nextRelease = item.next_release_at;
    }
  });
}

async function pollReleases() {
  if (!state.lastReleaseCheckAt) {
    return;
  }

  const encodedSince = encodeURIComponent(state.lastReleaseCheckAt);
  const feed = await fetchJson(`/api/releases?since=${encodedSince}`);
  state.lastReleaseCheckAt = feed.server_now;

  if (!feed.releases.length) {
    dom.serverClock.textContent = formatClock(feed.server_now);
    return;
  }

  const alerts = feed.releases
    .slice()
    .reverse()
    .map((item) => `${item.series_title} が更新された。第${item.batch_number}更新を公開。`);
  renderAlerts(alerts);

  for (const item of feed.releases) {
    if (Notification.permission === "granted") {
      new Notification("HOUR SERIAL 更新通知", {
        body: `${item.series_title} が更新された。20ページ追加。`,
      });
    }
  }

  await loadSnapshot({ preserveReleaseCheckpoint: true });
  wireCountdownTargets();
}

async function handleSubscription(event) {
  event.preventDefault();
  const channel = dom.channel.value;
  const targetValue = channel === "browser" ? "browser-session" : dom.target.value.trim();

  const payload = {
    display_name: dom.displayName.value.trim(),
    channel,
    target: targetValue,
  };

  try {
    const response = await fetchJson("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    dom.subscriptionMessage.textContent = response.message;
    renderSubscriptions(response.subscriptions);
  } catch (error) {
    dom.subscriptionMessage.textContent = error.message;
  }
}

function syncTargetInput() {
  const isBrowser = dom.channel.value === "browser";
  dom.target.value = isBrowser ? "browser-session" : "";
  dom.target.disabled = isBrowser;
  dom.target.placeholder = isBrowser ? "browser-session" : "you@example.com または https://...";
}

async function enableBrowserNotifications() {
  if (!("Notification" in window)) {
    dom.subscriptionMessage.textContent = "このブラウザは通知APIに対応していません。";
    return;
  }

  const result = await Notification.requestPermission();
  if (result === "granted") {
    dom.subscriptionMessage.textContent = "ブラウザ通知を有効化しました。";
    dom.enableBrowserBtn.textContent = "ブラウザ通知は有効です";
  } else {
    dom.subscriptionMessage.textContent = "ブラウザ通知は拒否されました。";
  }
}

async function boot() {
  syncTargetInput();
  await loadSnapshot();
  wireCountdownTargets();

  dom.channel.addEventListener("change", syncTargetInput);
  dom.subscriptionForm.addEventListener("submit", handleSubscription);
  dom.enableBrowserBtn.addEventListener("click", enableBrowserNotifications);

  state.countdownTimerId = window.setInterval(() => {
    if (state.snapshot) {
      dom.serverClock.textContent = formatClock(new Date().toISOString());
    }
    refreshCountdowns();
  }, 1000);

  state.releasePollId = window.setInterval(async () => {
    try {
      await pollReleases();
    } catch (error) {
      dom.subscriptionMessage.textContent = error.message;
    }
  }, 30000);

  state.snapshotPollId = window.setInterval(async () => {
    try {
      await loadSnapshot({ preserveReleaseCheckpoint: true });
      wireCountdownTargets();
    } catch (error) {
      dom.subscriptionMessage.textContent = error.message;
    }
  }, 120000);
}

boot().catch((error) => {
  dom.subscriptionMessage.textContent = error.message;
});
