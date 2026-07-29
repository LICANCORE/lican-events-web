const LEADERBOARD_UI_VERSION = "1.0.0";

const leaderboardState = {
  cloud: null,
  loading: false,
  previousFocus: null,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatScore(value) {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));
}

function formatSubmittedAt(value) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return "—";
  }
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function loadingMarkup() {
  return `
    <div class="leaderboard-state leaderboard-state--loading" role="status">
      <span aria-hidden="true">▓▒░</span>
      CARGANDO PUNTUACIONES VERIFICADAS...
    </div>
  `;
}

function emptyMarkup() {
  return `
    <div class="leaderboard-state">
      <strong>NO HAY SEÑAL DE PUNTUACIÓN</strong>
      <p>Todavía no hay puntuaciones verificadas en el Top 10.</p>
    </div>
  `;
}

function errorMarkup(message) {
  return `
    <div class="leaderboard-state leaderboard-state--error" role="alert">
      <strong>ERROR DE CLASIFICACIÓN</strong>
      <p>${escapeHtml(message)}</p>
      <button class="leaderboard-secondary" type="button" data-leaderboard-action="retry">REINTENTAR</button>
    </div>
  `;
}

function scoresMarkup(scores) {
  return `
    <ol class="leaderboard-list" aria-label="SCORE TOP 10">
      ${scores
        .map(
          (entry) => `
        <li class="leaderboard-entry">
          <strong class="leaderboard-position" aria-label="Posición ${entry.ranking_position}">#${entry.ranking_position}</strong>
          <div class="leaderboard-player">
            <strong>${escapeHtml(entry.player_name)}</strong>
            <span>${escapeHtml(entry.level_id)} · ${escapeHtml(entry.game_build_version ?? "BUILD —")}</span>
          </div>
          <strong class="leaderboard-score">${formatScore(entry.score)}</strong>
          <time datetime="${escapeHtml(entry.submitted_at ?? "")}">${formatSubmittedAt(entry.submitted_at)}</time>
        </li>
      `,
        )
        .join("")}
    </ol>
  `;
}

function createLeaderboardInterface() {
  const menuActions = document.querySelector("#menu-screen .menu-actions");
  if (!menuActions || document.getElementById("leaderboard-button")) {
    return;
  }

  const button = document.createElement("button");
  button.id = "leaderboard-button";
  button.className = "menu-button leaderboard-menu-button";
  button.type = "button";
  button.innerHTML = "<span>CLASIFICACIÓN</span><strong>SCORE TOP 10</strong>";
  menuActions.append(button);

  const overlay = document.createElement("div");
  overlay.id = "leaderboard-overlay";
  overlay.className = "leaderboard-overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="leaderboard-backdrop" data-leaderboard-action="close"></div>
    <section
      id="leaderboard-dialog"
      class="leaderboard-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-title"
      tabindex="-1"
    >
      <div class="leaderboard-scanlines" aria-hidden="true"></div>
      <button class="leaderboard-close" type="button" data-leaderboard-action="close" aria-label="Cerrar clasificación">×</button>
      <p class="leaderboard-eyebrow">HEADBANG NETWORK // VERIFIED SCORES</p>
      <h2 id="leaderboard-title">SCORE TOP 10</h2>
      <p class="leaderboard-copy">Una posición por jugador. Solo cuenta su mejor puntuación verificada.</p>
      <div id="leaderboard-content">${loadingMarkup()}</div>
      <p id="leaderboard-feedback" class="leaderboard-feedback" aria-live="polite"></p>
      <button class="leaderboard-secondary" type="button" data-leaderboard-action="close">VOLVER AL JUEGO</button>
      <small class="leaderboard-version">PUBLIC BOARD // ${LEADERBOARD_UI_VERSION}</small>
    </section>
  `;
  document.body.append(overlay);

  button.addEventListener("click", openLeaderboard);
  overlay.addEventListener("click", handleLeaderboardClick);
  document.addEventListener("keydown", handleLeaderboardKeydown, true);
}

async function loadLeaderboard() {
  if (leaderboardState.loading) {
    return;
  }
  leaderboardState.loading = true;
  const content = document.getElementById("leaderboard-content");
  const feedback = document.getElementById("leaderboard-feedback");
  content.innerHTML = loadingMarkup();
  feedback.textContent = "";

  const result = await leaderboardState.cloud.getScoreTop10();
  leaderboardState.loading = false;

  if (!result.success) {
    content.innerHTML = errorMarkup(result.message);
    feedback.textContent = result.message;
    return;
  }
  if (result.scores.length === 0) {
    content.innerHTML = emptyMarkup();
    feedback.textContent = result.message;
    return;
  }
  content.innerHTML = scoresMarkup(result.scores);
  feedback.textContent = result.message;
}

async function openLeaderboard() {
  const overlay = document.getElementById("leaderboard-overlay");
  if (!overlay) {
    return;
  }
  leaderboardState.previousFocus = document.activeElement;
  const newsletterGate = document.getElementById("newsletter-gate");
  if (newsletterGate) {
    newsletterGate.dataset.leaderboardPreviousInert = String(
      newsletterGate.inert,
    );
    newsletterGate.inert = true;
  }
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("leaderboard-modal-open");
  document.querySelector(".leaderboard-close")?.focus();
  await loadLeaderboard();
}

function closeLeaderboard() {
  const overlay = document.getElementById("leaderboard-overlay");
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("leaderboard-modal-open");
  const newsletterGate = document.getElementById("newsletter-gate");
  if (newsletterGate) {
    newsletterGate.inert =
      newsletterGate.dataset.leaderboardPreviousInert === "true";
    delete newsletterGate.dataset.leaderboardPreviousInert;
  }
  leaderboardState.previousFocus?.focus?.();
}

async function handleLeaderboardClick(event) {
  const action = event.target.closest("[data-leaderboard-action]")?.dataset
    .leaderboardAction;
  if (action === "close") {
    closeLeaderboard();
  } else if (action === "retry") {
    await loadLeaderboard();
  }
}

function handleLeaderboardKeydown(event) {
  const overlay = document.getElementById("leaderboard-overlay");
  if (!overlay || overlay.hidden) {
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeLeaderboard();
    return;
  }
  if (event.key !== "Tab") {
    return;
  }
  const focusable = [
    ...overlay.querySelectorAll("button:not([disabled])"),
  ].filter((element) => element.offsetParent !== null);
  if (focusable.length === 0) {
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function initializeLeaderboard() {
  createLeaderboardInterface();
  if (!window.HeadbangCloud) {
    await new Promise((resolve) => {
      window.addEventListener("headbang-cloud-ready", resolve, { once: true });
      window.setTimeout(resolve, 8000);
    });
  }
  leaderboardState.cloud = window.HeadbangCloud ?? null;
  if (!leaderboardState.cloud?.getScoreTop10) {
    document.getElementById("leaderboard-button")?.remove();
  }
}

void initializeLeaderboard();
