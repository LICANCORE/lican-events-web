// Shared by the React site and standalone pages. No custom events fire by default.
window.trackLicanEvent = function (eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
};
