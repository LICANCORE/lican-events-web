const form = document.getElementById("newsletter-form");
const gate = document.getElementById("newsletter-gate");
const email = document.getElementById("newsletter-email");
const consent = document.getElementById("newsletter-consent");
const submit = document.getElementById("newsletter-submit");
const status = document.getElementById("newsletter-status");

function hasEmail() {
  return email.value.trim().length > 0;
}

function syncSubmitState() {
  const consentRequired = hasEmail();
  const blockedByConsent = consentRequired && !consent.checked;
  const visuallyDisabled = submit.disabled || blockedByConsent;
  const ariaDisabled = String(visuallyDisabled);

  if (submit.classList.contains("is-consent-pending") !== blockedByConsent) {
    submit.classList.toggle("is-consent-pending", blockedByConsent);
  }
  if (submit.getAttribute("aria-disabled") !== ariaDisabled) {
    submit.setAttribute("aria-disabled", ariaDisabled);
  }
}

function syncAfterOriginalHandler() {
  queueMicrotask(syncSubmitState);
}

email.addEventListener("input", () => {
  if (!hasEmail() && status.dataset.kind === "error") {
    status.textContent = "";
    status.dataset.kind = "";
  }
  syncSubmitState();
});
consent.addEventListener("change", syncAfterOriginalHandler);

new MutationObserver(syncSubmitState).observe(submit, {
  attributes: true,
  attributeFilter: ["class", "disabled", "aria-disabled"],
});

form.addEventListener(
  "submit",
  (event) => {
    if (hasEmail()) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    status.textContent = "";
    status.dataset.kind = "";
    gate.classList.add("is-hidden");
    document.documentElement.dataset.appVisible = "true";
    email.blur();
    window.dispatchEvent(new CustomEvent("headbang-newsletter-skipped"));
  },
  { capture: true },
);

syncSubmitState();
