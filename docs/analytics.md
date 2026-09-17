# Google Analytics 4

Measurement ID: `G-C2SPKSH8HJ`.

The React entrypoint (`index.html`) loads one Google tag with
`send_page_view: false`. `AnalyticsTracker` is mounted once in `MainLayout`,
inside React Router, outside the keyed page transition. It sends the initial
view and subsequent pathname/search changes after page title effects run.
Hash-only changes and repeated renders do not send views. Returning to a
previous route does send a new view. The synchronous gtag queue supports the
Google script loading asynchronously.

GitHub Pages' redirect restoration remains unchanged. Views use the restored
URL rather than the temporary `/?redirect=...` URL. The 404 redirect document
deliberately has no tag. The standalone BASS quiz and Headbang Dealers game
each load one Google tag with the default automatic initial view; they do not
mount the React tracker.

## Required GA4 setting to avoid duplicate SPA views

In GA4, open **Admin → Data streams → the web stream for G-C2SPKSH8HJ →
Enhanced measurement → Settings → Page views → Show advanced settings**.
Disable **Page changes based on browser history events**, then save.
Keep other desired enhanced measurements enabled.

This account setting cannot be changed by this repository. `send_page_view:
false` suppresses the config view, but does not disable enhanced measurement's
history listener. Do not add another page-view tag in Google Tag Manager.

Reference: https://developers.google.com/analytics/devguides/collection/ga4/views

## Future custom events

`public/analytics-events.js` exposes the shared guarded helper:

```js
window.trackLicanEvent('click_buy_tickets', { event_id: 'example' });
```

Prepared names: `click_buy_tickets`, `click_contact`, `newsletter_signup`,
`language_change`, `event_filter`, `gallery_open`, `click_instagram`,
`click_service_request`. No handlers for these events are wired yet.

## Verification

Run `node --test tests/analytics.test.mjs` and `npm.cmd run build`.
After deployment and the GA4 setting above, use Tag Assistant / DebugView to
verify one view per initial load and navigation, including back/forward,
query parameters, and all language prefixes. Blocked Google scripts or
extensions can prevent delivery even when the local queue works correctly.
