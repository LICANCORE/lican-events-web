const PERFECT_ASSET = "/headbangdealers_the_game/assets/ui/feedback/HD_BT_UI_PERFECT_WORDMARK_v022.png";

const $ = (selector) => document.querySelector(selector);

function syncPerfectFeedback() {
  const feedback = $("#feedback");
  if (!feedback) return;
  const judgement = `${feedback.dataset.kind || ""} ${feedback.textContent || ""}`.trim().toUpperCase();
  const isPerfect = judgement.includes("PERFECT");
  if (feedback.classList.contains("feedback--perfect-wordmark") !== isPerfect) {
    feedback.classList.toggle("feedback--perfect-wordmark", isPerfect);
  }
  if (isPerfect) {
    if (feedback.style.getPropertyValue("--perfect-wordmark") !== `url("${PERFECT_ASSET}")`) {
      feedback.style.setProperty("--perfect-wordmark", `url("${PERFECT_ASSET}")`);
    }
    if (feedback.getAttribute("aria-label") !== "PERFECT") feedback.setAttribute("aria-label", "PERFECT");
  } else {
    if (feedback.style.getPropertyValue("--perfect-wordmark")) feedback.style.removeProperty("--perfect-wordmark");
    if (feedback.hasAttribute("aria-label")) feedback.removeAttribute("aria-label");
  }
}

function syncTutorialLayout() {
  const card = $("#tutorial-hurt-card");
  const items = $("#tutorial-screen .tutorial-items");
  if (!card || !items) return;
  const noHurt = card.classList.contains("is-disabled");
  if (card.hidden !== noHurt) card.hidden = noHurt;
  if (items.classList.contains("tutorial-items--no-hurt") !== noHurt) {
    items.classList.toggle("tutorial-items--no-hurt", noHurt);
  }
}

function syncLockedCharacterCopy() {
  const locale = $("#language-select")?.value || document.documentElement.lang || "es";
  const labels = {
    es: "🔒 DESBLOQUEA NIVELES",
    en: "🔒 UNLOCK IN LEVELS",
    de: "🔒 IN LEVELS FREISCHALTEN",
    eo: "🔒 MALŜLOSU EN NIVELOJ",
  };
  document.querySelectorAll(".character-card.is-locked .character-lock").forEach((lock) => {
    const replacement = labels[locale] || labels.es;
    if (lock.textContent !== replacement) lock.textContent = replacement;
  });
}

function syncPickupCopy() {
  const control = $("#usb-pickup-control");
  const prompt = $("#usb-pickup-prompt");
  const scene = window.__HEADBANG_GAME__?.scene?.getScenes?.(false)?.find((entry) => entry?.run);
  if (!control || !prompt || !scene) return;
  const twoPendingItems = Boolean(
    scene.usb?.visible && !scene.run?.usbCollected &&
    scene.collectibleObject?.visible && !scene.run?.objectCollected
  );
  if (twoPendingItems && control.textContent !== "RECOGE LOS ITEMS CON S / ↓") {
    control.textContent = "RECOGE LOS ITEMS CON S / ↓";
    if (!prompt.classList.contains("usb-pickup-prompt--multiple")) prompt.classList.add("usb-pickup-prompt--multiple");
  } else if (!twoPendingItems && prompt.classList.contains("usb-pickup-prompt--multiple")) {
    prompt.classList.remove("usb-pickup-prompt--multiple");
  }
}

function fitResultHeadings() {
  for (const element of [$("#result-kind"), $("#results-title")]) {
    if (!element || element.closest(".screen")?.classList.contains("is-hidden")) continue;
    element.style.removeProperty("font-size");
    let size = Number.parseFloat(getComputedStyle(element).fontSize) || 24;
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight) || size;
    const maxHeight = lineHeight * 2.08;
    for (let attempts = 0; attempts < 14 && (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > maxHeight); attempts += 1) {
      size *= 0.91;
      element.style.fontSize = `${Math.max(9, size).toFixed(2)}px`;
    }
  }
}

function syncResponsiveState() {
  syncPerfectFeedback();
  syncTutorialLayout();
  syncLockedCharacterCopy();
  syncPickupCopy();
  fitResultHeadings();
}

function initialize() {
  const observer = new MutationObserver(syncResponsiveState);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "data-kind"],
  });
  window.addEventListener("resize", fitResultHeadings, { passive: true });
  window.visualViewport?.addEventListener("resize", fitResultHeadings, { passive: true });
  window.setInterval(syncPickupCopy, 160);
  syncResponsiveState();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
else initialize();
