// Shared by the React site and standalone pages. No custom events fire by default.
window.trackLicanEvent = function (eventName, params = {}) {
  window.licanConsent?.trackEvent(eventName, params);
};
